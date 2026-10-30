import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, Clock3, FolderGit2, Globe, ListChecks, Loader2, Pencil, Plus, RefreshCw, Server, Trash2, X } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { getApiErrorMessage } from "@/lib/api-error";
import { EMPTY, formatDateTime, formatRelative } from "@/lib/format";
import { badge, btn, card, input, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listAutomationHealth } from "@/services/api/automation-health";
import {
  createSyncCheck,
  deleteSyncCheck,
  getSyncState,
  pingSyncCheck,
  setSyncPicks,
  updateSyncCheck,
  type SyncCheck,
  type SyncCheckPayload,
  type SyncState,
} from "@/services/api/sync";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/toast-store";
import { getHealthVisual } from "@/lib/health-visual";
import { AutomationHealthPage, DetailField, Fact, Section, type HealthExtraCard } from "../health/automation-health-page";

const STATE_KEY = ["sync-state"];
const ALL_AUTOMATIONS_KEY = ["sync-all-automations"];

const INTERVAL_OPTIONS = [
  { value: 15, label: "15 segundos" },
  { value: 30, label: "30 segundos" },
  { value: 60, label: "1 minuto" },
  { value: 120, label: "2 minutos" },
  { value: 300, label: "5 minutos" },
  { value: 600, label: "10 minutos" },
  { value: 1800, label: "30 minutos" },
];

function intervalLabel(seconds: number) {
  return INTERVAL_OPTIONS.find((o) => o.value === seconds)?.label ?? `${seconds}s`;
}

function checkStatus(check: SyncCheck): { status: "success" | "running" | "error"; label: string } {
  if (check.last_ok === null) return { status: "running", label: "Aguardando" };
  return check.last_ok ? { status: "success", label: "OK" } : { status: "error", label: "Sem resposta" };
}

/** A tela Sync é a tela de Health, com escopo de automações escolhido por quem usa e sistemas de fora como cards extras. */
export function SyncPage() {
  const enabled = Boolean(useAuthStore((state) => state.user?.sync_enabled));

  if (!enabled) {
    return (
      <section className={card}>
        <PageHeader title="Sync" description="Painel pessoal de acompanhamento." />
        <div className="p-5 text-sm text-slate-600">
          O Sync está desligado no seu perfil.{" "}
          <Link to="/profile" className="font-medium text-blue-600 hover:underline">
            Ligar em Meu perfil
          </Link>
          .
        </div>
      </section>
    );
  }

  return <SyncBoard />;
}

type FormState = {
  name: string;
  url: string;
  server: string;
  project: string;
  interval_seconds: number;
  expected_status: string;
  active: boolean;
};

const emptyForm: FormState = { name: "", url: "", server: "", project: "", interval_seconds: 60, expected_status: "", active: true };

function toForm(check: SyncCheck): FormState {
  return {
    name: check.name,
    url: check.url,
    server: check.server ?? "",
    project: check.project ?? "",
    interval_seconds: check.interval_seconds,
    expected_status: check.expected_status ? String(check.expected_status) : "",
    active: check.active,
  };
}

function toPayload(form: FormState, timeoutSeconds: number): SyncCheckPayload {
  const expected = Number(form.expected_status);
  return {
    name: form.name.trim(),
    url: form.url.trim(),
    server: form.server.trim() || null,
    project: form.project.trim() || null,
    interval_seconds: form.interval_seconds,
    expected_status: form.expected_status.trim() && Number.isInteger(expected) ? expected : null,
    timeout_seconds: timeoutSeconds,
    active: form.active,
  };
}

/**
 * Faz o teste de cada sistema ativo no intervalo dele. Só existe enquanto a tela Sync está aberta:
 * fechou a tela, parou de testar.
 */
function useSyncPings(checks: SyncCheck[], onResult: (check: SyncCheck) => void) {
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  // Reinicia os relógios só quando mudar o conjunto de sistemas, o intervalo ou o "ativo".
  const signature = checks.map((c) => `${c.id}:${c.interval_seconds}:${c.active}`).join("|");
  const lastPingRef = useRef<Map<number, string | null>>(new Map());
  useEffect(() => {
    lastPingRef.current = new Map(checks.map((c) => [c.id, c.last_ping_at]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const inFlight = new Set<number>();
    const timers: number[] = [];

    async function run(id: number) {
      if (inFlight.has(id)) return;
      inFlight.add(id);
      try {
        onResultRef.current(await pingSyncCheck(id));
      } catch {
        // falha de rede do próprio painel: tenta de novo no próximo intervalo
      } finally {
        inFlight.delete(id);
      }
    }

    for (const check of checks) {
      if (!check.active) continue;
      const intervalMs = check.interval_seconds * 1000;
      const last = check.last_ping_at ? new Date(check.last_ping_at).getTime() : 0;
      if (Date.now() - last >= intervalMs) {
        // Resultado antigo: testa logo, com folga aleatória para os cards não dispararem juntos.
        timers.push(window.setTimeout(() => void run(check.id), Math.random() * 1500));
      }
      timers.push(window.setInterval(() => void run(check.id), intervalMs));
    }

    return () => timers.forEach((t) => (window.clearTimeout(t), window.clearInterval(t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}

function SyncBoard() {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<SyncCheck | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<SyncCheck | null>(null);

  const stateQuery = useQuery({ queryKey: STATE_KEY, queryFn: getSyncState });
  const automationsQuery = useQuery({
    queryKey: ALL_AUTOMATIONS_KEY,
    queryFn: () => listAutomationHealth({ active: true }),
    enabled: picking,
  });

  const state = stateQuery.data;
  const checks = useMemo(() => state?.checks ?? [], [state]);
  const picked = useMemo(() => new Set(state?.automation_ids ?? []), [state]);
  const selected = checks.find((c) => c.id === selectedId) ?? null;

  const patchChecks = (fn: (list: SyncCheck[]) => SyncCheck[]) =>
    queryClient.setQueryData<SyncState>(STATE_KEY, (old) => (old ? { ...old, checks: fn(old.checks) } : old));

  const applyResult = (updated: SyncCheck) => patchChecks((list) => list.map((c) => (c.id === updated.id ? updated : c)));
  useSyncPings(checks, applyResult);

  const picksMutation = useMutation({
    mutationFn: (ids: number[]) => setSyncPicks(ids),
    onSuccess: (result) =>
      queryClient.setQueryData<SyncState>(STATE_KEY, (old) => (old ? { ...old, automation_ids: result.automation_ids } : old)),
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar a escolha.")),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: SyncCheckPayload) =>
      editing && editing !== "new" ? updateSyncCheck(editing.id, payload) : createSyncCheck(payload),
    onSuccess: async () => {
      toast.success(editing === "new" ? "Sistema adicionado." : "Sistema atualizado.");
      setEditing(null);
      setForm(emptyForm);
      await queryClient.invalidateQueries({ queryKey: STATE_KEY });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar o sistema.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSyncCheck(id),
    onSuccess: async () => {
      toast.success("Sistema removido.");
      setDeleting(null);
      setSelectedId(null);
      await queryClient.invalidateQueries({ queryKey: STATE_KEY });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível remover o sistema.")),
  });

  const testNow = useMutation({
    mutationFn: (id: number) => pingSyncCheck(id),
    onSuccess: applyResult,
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível testar agora.")),
  });

  function togglePick(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    picksMutation.mutate([...next]);
  }

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
  }

  function startEdit(check: SyncCheck) {
    setSelectedId(null);
    setForm(toForm(check));
    setEditing(check);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    const timeout = editing && editing !== "new" ? editing.timeout_seconds : 10;
    saveMutation.mutate(toPayload(form, timeout));
  }

  const extraCards = useMemo<HealthExtraCard[]>(
    () =>
      checks.map((check) => {
        const { status, label } = checkStatus(check);
        const failed = check.last_ok === false;
        return {
          key: `sync-${check.id}`,
          status,
          statusLabel: label,
          title: check.name,
          subtitle: check.project || hostOf(check.url),
          chip: failed
            ? { label: check.last_status_code ? `HTTP ${check.last_status_code}` : "sem resposta", isOverdue: true }
            : check.last_latency_ms != null
              ? { label: `${check.last_latency_ms} ms`, isOverdue: false }
              : null,
          infos: [
            { icon: Activity, label: "Regra", value: `a cada ${intervalLabel(check.interval_seconds)}` },
            { icon: Server, label: "Servidor", value: check.server || EMPTY },
            { icon: Clock3, label: "Último ping", value: check.last_ping_at ? formatDateTime(check.last_ping_at) : EMPTY },
            { icon: FolderGit2, label: "Projeto", value: check.project || EMPTY },
          ],
          searchText: [check.name, check.url, check.server, check.project, label].filter(Boolean).join(" "),
          onClick: () => setSelectedId(check.id),
        };
      }),
    [checks]
  );

  const topContent = (
    <>
      {picking && (
        <div className="mx-5 mt-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-3 text-sm text-slate-600">Marque as automações que você quer ver aqui.</p>
          {automationsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando...</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {(automationsQuery.data?.items ?? []).map((item) => (
                <label key={item.automation_id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={picked.has(item.automation_id)}
                    disabled={picksMutation.isPending}
                    onChange={() => togglePick(item.automation_id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="truncate">{item.automation_label || item.automation_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {editing !== null && (
        <form onSubmit={handleSubmit} className="mx-5 mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
          <Field label="Nome">
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} placeholder="Ex.: API de Insumos" className={input} />
          </Field>
          <Field label="Endereço para testar">
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} maxLength={500} placeholder="https://meusistema.exemplo.com/health" className={cn(input, "font-mono")} inputMode="url" />
          </Field>
          <Field label="Servidor / onde foi publicado">
            <input value={form.server} onChange={(e) => setForm({ ...form, server: e.target.value })} maxLength={120} placeholder="Ex.: Azure" className={input} />
          </Field>
          <Field label="Projeto">
            <input value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} maxLength={120} placeholder="Ex.: Insumos" className={input} />
          </Field>
          <Field label="Testar de quanto em quanto tempo">
            <select value={form.interval_seconds} onChange={(e) => setForm({ ...form, interval_seconds: Number(e.target.value) })} className={input}>
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Código esperado (opcional)">
            <input value={form.expected_status} onChange={(e) => setForm({ ...form, expected_status: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="Vazio = qualquer resposta abaixo de 400" className={input} inputMode="numeric" />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700 md:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            Ativo (testar enquanto a tela estiver aberta)
          </label>
          <div className="flex gap-2 md:col-span-2 md:justify-end">
            <button type="button" onClick={() => setEditing(null)} className={btn.secondary} disabled={saveMutation.isPending}>
              Cancelar
            </button>
            <button type="submit" disabled={saveMutation.isPending || !form.name.trim() || !form.url.trim()} className={btn.primary}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing === "new" ? "Adicionar" : "Salvar"}
            </button>
          </div>
        </form>
      )}
    </>
  );

  const headerActions = (
    <>
      <button type="button" onClick={() => setPicking((v) => !v)} className={btn.secondary}>
        <ListChecks className="h-4 w-4" />
        Escolher automações
      </button>
      <button type="button" onClick={startNew} disabled={editing !== null} className={btn.primary}>
        <Plus className="h-4 w-4" />
        Adicionar health
      </button>
    </>
  );

  const extraModals = (
    <>
      {selected ? (
        <ExternalDetailModal
          check={selected}
          testing={testNow.isPending}
          onTest={() => testNow.mutate(selected.id)}
          onEdit={() => startEdit(selected)}
          onDelete={() => setDeleting(selected)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remover sistema"
        description={deleting ? `Remover "${deleting.name}" do seu Sync? O sistema em si não é afetado.` : ""}
        confirmLabel="Remover"
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </>
  );

  return (
    <AutomationHealthPage
      title="Sync"
      onlyAutomationIds={state ? state.automation_ids : []}
      headerActions={headerActions}
      topContent={topContent}
      extraCards={extraCards}
      extraModals={extraModals}
      emptyTitle="Nada no seu Sync ainda"
      emptyDescription={'Use "Escolher automações" ou "Adicionar health" para montar o seu painel.'}
      viewStorageKey="sync-card-scale"
    />
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Detalhe de um sistema de fora: mesmo desenho do detalhe das automações no Health. */
function ExternalDetailModal({
  check,
  testing,
  onTest,
  onEdit,
  onDelete,
  onClose,
}: {
  check: SyncCheck;
  testing: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { status, label } = checkStatus(check);
  const visual = getHealthVisual(status);
  const Icon = visual.icon;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={cn(card, "relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden shadow-2xl")}>
        <div className={cn("border-b bg-gradient-to-r px-6 py-5", visual.bandClass)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className={cn(badge, visual.badgeClass)}>
                <Icon className={cn("h-3.5 w-3.5", visual.iconClass, status === "running" && "animate-spin")} />
                {label}
              </span>
              <h2 className="mt-2 truncate text-xl font-semibold text-slate-950" title={check.name}>
                {check.name}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Server className="h-4 w-4 text-slate-400" />
                  {check.server || EMPTY}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FolderGit2 className="h-4 w-4 text-slate-400" />
                  {check.project || EMPTY}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-slate-400" />
                  {hostOf(check.url)}
                </span>
              </p>
            </div>
            <button type="button" onClick={onClose} className={btn.icon} aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact
              icon={Clock3}
              label="Último ping"
              value={check.last_ping_at ? formatDateTime(check.last_ping_at) : EMPTY}
              hint={check.last_ping_at ? formatRelative(check.last_ping_at) : "Ainda não testado"}
            />
            <Fact
              icon={Activity}
              label="Resposta"
              value={check.last_status_code ? `HTTP ${check.last_status_code}` : EMPTY}
              hint={check.last_latency_ms != null ? `${check.last_latency_ms} ms` : undefined}
              valueClassName={check.last_ok === false ? "text-red-700" : undefined}
            />
            <Fact icon={RefreshCw} label="Regra" value={`a cada ${intervalLabel(check.interval_seconds)}`} hint={check.active ? "Testando com a tela aberta" : "Desativado"} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Section title="Sistema">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailField label="Endereço" value={<span className="break-all font-mono text-xs">{check.url}</span>} className="col-span-2" />
                <DetailField label="Servidor" value={check.server || EMPTY} />
                <DetailField label="Projeto" value={check.project || EMPTY} />
                <DetailField label="Código esperado" value={check.expected_status ? String(check.expected_status) : "Abaixo de 400"} />
                <DetailField label="Tempo máximo" value={`${check.timeout_seconds}s`} />
              </dl>
            </Section>

            <Section title="Último teste">
              {check.last_ping_at ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DetailField label="Situação" value={<span className={cn(badge, check.last_ok ? tone.success : tone.danger)}>{check.last_ok ? "No ar" : "Sem resposta"}</span>} />
                  <DetailField label="Tempo de resposta" value={check.last_latency_ms != null ? `${check.last_latency_ms} ms` : EMPTY} />
                  {check.last_error ? <DetailField label="Motivo" value={check.last_error} className="col-span-2" /> : null}
                </dl>
              ) : (
                <p className="text-sm text-slate-500">Ainda não testado.</p>
              )}
            </Section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn.secondary} onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Editar
            </button>
            <button type="button" className={cn(btn.secondary, "text-red-700 hover:bg-red-50")} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Remover
            </button>
          </div>
          <button type="button" className={btn.primary} onClick={onTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Testar agora
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
