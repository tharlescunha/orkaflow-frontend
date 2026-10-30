import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Globe, ListChecks, Loader2, Pencil, Plus, RefreshCw, Server, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { TableSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { EMPTY, formatDateTime, formatRelative } from "@/lib/format";
import { badge, btn, card, chip, input, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listAutomationHealth, type AutomationHealthItemRead } from "@/services/api/automation-health";
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

const STATE_KEY = ["sync-state"];
const HEALTH_KEY = ["sync-automation-health"];
const HEALTH_REFRESH_MS = 30_000;

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

const HEALTH_TONE: Record<string, string> = {
  success: tone.success,
  running: tone.info,
  warning: tone.warning,
  error: tone.danger,
};

/** Painel pessoal: automações escolhidas (como no Health) e sistemas de fora do Regente com ping. */
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
  timeout_seconds: number;
  active: boolean;
};

const emptyForm: FormState = { name: "", url: "", server: "", project: "", interval_seconds: 60, expected_status: "", timeout_seconds: 10, active: true };

function toForm(check: SyncCheck): FormState {
  return {
    name: check.name,
    url: check.url,
    server: check.server ?? "",
    project: check.project ?? "",
    interval_seconds: check.interval_seconds,
    expected_status: check.expected_status ? String(check.expected_status) : "",
    timeout_seconds: check.timeout_seconds,
    active: check.active,
  };
}

function toPayload(form: FormState): SyncCheckPayload {
  const expected = Number(form.expected_status);
  return {
    name: form.name.trim(),
    url: form.url.trim(),
    server: form.server.trim() || null,
    project: form.project.trim() || null,
    interval_seconds: form.interval_seconds,
    expected_status: form.expected_status.trim() && Number.isInteger(expected) ? expected : null,
    timeout_seconds: form.timeout_seconds,
    active: form.active,
  };
}

function SyncBoard() {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<SyncCheck | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const stateQuery = useQuery({ queryKey: STATE_KEY, queryFn: getSyncState });
  const healthQuery = useQuery({
    queryKey: HEALTH_KEY,
    queryFn: () => listAutomationHealth(),
    refetchInterval: HEALTH_REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const state = stateQuery.data;
  const allAutomations = healthQuery.data?.items ?? [];
  const picked = useMemo(() => new Set(state?.automation_ids ?? []), [state?.automation_ids]);
  const shown = allAutomations.filter((item) => picked.has(item.automation_id));

  const patchChecks = (fn: (checks: SyncCheck[]) => SyncCheck[]) =>
    queryClient.setQueryData<SyncState>(STATE_KEY, (old) => (old ? { ...old, checks: fn(old.checks) } : old));

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
      await queryClient.invalidateQueries({ queryKey: STATE_KEY });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível remover o sistema.")),
  });

  function togglePick(id: number) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    picksMutation.mutate([...next]);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    saveMutation.mutate(toPayload(form));
  }

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
  }

  function startEdit(check: SyncCheck) {
    setForm(toForm(check));
    setEditing(check);
  }

  const checks = state?.checks ?? [];
  // Poucos itens por pessoa: agrupar a cada render é barato.
  const groups = new Map<string, SyncCheck[]>();
  for (const check of checks) {
    const key = check.project?.trim() || "Sem projeto";
    groups.set(key, [...(groups.get(key) ?? []), check]);
  }
  const grouped = [...groups.entries()];

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Sync"
          description="Seu painel: as automações que você escolher e sistemas de fora do Regente, numa tela só. Os testes dos sistemas só rodam com esta tela aberta."
          actions={
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
          }
        />

        <div className="space-y-6 p-5 md:p-6">
          {picking && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-sm text-slate-600">Marque as automações que você quer ver aqui.</p>
              {healthQuery.isLoading ? (
                <TableSkeleton rows={3} columns={2} />
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {allAutomations.map((item) => (
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
            <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
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

          {stateQuery.isLoading ? (
            <TableSkeleton rows={3} columns={3} />
          ) : stateQuery.isError ? (
            <QueryError error={stateQuery.error} what="o seu Sync" onRetry={() => stateQuery.refetch()} retrying={stateQuery.isFetching} />
          ) : (
            <>
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Automações</h2>
                {shown.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    Nenhuma automação escolhida. Use &ldquo;Escolher automações&rdquo;.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {shown.map((item) => (
                      <AutomationCard key={item.automation_id} item={item} />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Sistemas de fora</h2>
                {checks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    Nenhum sistema cadastrado. Use &ldquo;Adicionar health&rdquo;.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {grouped.map(([project, items]) => (
                      <div key={project}>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{project}</div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {items.map((check) => (
                            <ExternalCard
                              key={check.id}
                              check={check}
                              onUpdated={(updated) => patchChecks((list) => list.map((c) => (c.id === updated.id ? updated : c)))}
                              onEdit={() => startEdit(check)}
                              onDelete={() => deleteMutation.mutate(check.id)}
                              deleting={deleteMutation.isPending}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function AutomationCard({ item }: { item: AutomationHealthItemRead }) {
  const machine = item.machine_display_name || item.machine_label || item.machine_name;
  return (
    <div className={cn(card, "space-y-2 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{item.automation_label || item.automation_name}</div>
          {item.repository_name ? <div className="truncate text-xs text-slate-500">{item.repository_name}</div> : null}
        </div>
        <span className={cn(badge, HEALTH_TONE[item.health_status] ?? tone.neutral, "shrink-0")}>{item.health_label}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Máquina</dt>
        <dd className="truncate text-slate-700">{machine ?? EMPTY}</dd>
        <dt className="text-slate-500">Última execução</dt>
        <dd className="text-slate-700" title={formatDateTime(item.last_execution_at)}>
          {item.last_execution_at ? formatRelative(item.last_execution_at) : EMPTY}
        </dd>
        <dt className="text-slate-500">Regra</dt>
        <dd className="truncate text-slate-700">{item.schedule?.rule_label ?? EMPTY}</dd>
      </dl>
    </div>
  );
}

function ExternalCard({
  check,
  onUpdated,
  onEdit,
  onDelete,
  deleting,
}: {
  check: SyncCheck;
  onUpdated: (check: SyncCheck) => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const pingMutation = useMutation({
    mutationFn: () => pingSyncCheck(check.id),
    onSuccess: onUpdated,
  });

  // O teste só roda enquanto este card existe, ou seja, com a tela aberta. O primeiro vem logo ao abrir
  // (a menos que o último seja recente); os seguintes no intervalo escolhido.
  const pingRef = useRef(pingMutation.mutate);
  useEffect(() => {
    pingRef.current = pingMutation.mutate;
  });

  useEffect(() => {
    if (!check.active) return;
    const intervalMs = check.interval_seconds * 1000;
    const last = check.last_ping_at ? new Date(check.last_ping_at).getTime() : 0;
    const stale = Date.now() - last >= intervalMs;
    // Resultado antigo: testa logo (com uma folga aleatória para os cards não dispararem juntos).
    const first = stale ? window.setTimeout(() => pingRef.current(), Math.random() * 1500) : undefined;
    const timer = window.setInterval(() => pingRef.current(), intervalMs);
    return () => {
      if (first !== undefined) window.clearTimeout(first);
      window.clearInterval(timer);
    };
    // Só reinicia o relógio se o intervalo ou o "ativo" mudarem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check.id, check.active, check.interval_seconds]);

  const status =
    check.last_ok === null
      ? { text: "Aguardando", className: tone.neutral }
      : check.last_ok
        ? { text: "No ar", className: tone.success }
        : { text: "Fora do ar", className: tone.danger };

  return (
    <div className={cn(card, "space-y-2 p-4", !check.active && "opacity-60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{check.name}</div>
          <div className="truncate font-mono text-xs text-slate-500" title={check.url}>
            {check.url}
          </div>
        </div>
        <span className={cn(badge, status.className, "shrink-0")}>{status.text}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500">Servidor</dt>
        <dd className="flex items-center gap-1 truncate text-slate-700">
          <Server className="h-3 w-3 text-slate-400" />
          {check.server ?? EMPTY}
        </dd>
        <dt className="text-slate-500">Último ping</dt>
        <dd className="text-slate-700" title={formatDateTime(check.last_ping_at)}>
          {check.last_ping_at ? formatRelative(check.last_ping_at) : EMPTY}
          {check.last_latency_ms != null ? <span className="ml-1 text-slate-400">({check.last_latency_ms} ms)</span> : null}
        </dd>
        <dt className="text-slate-500">Regra</dt>
        <dd className="text-slate-700">a cada {intervalLabel(check.interval_seconds)}</dd>
      </dl>
      {check.last_ok === false && check.last_error ? <p className="text-xs text-red-700">{check.last_error}</p> : null}
      <div className="flex items-center justify-between gap-2 pt-1">
        <span className={chip}>
          <Globe className="h-3 w-3" />
          {check.project ?? "Sem projeto"}
        </span>
        <span className="inline-flex gap-1">
          <button type="button" onClick={() => pingMutation.mutate()} disabled={pingMutation.isPending} className={cn(btn.icon, "h-8 w-8")} aria-label={`Testar ${check.name} agora`}>
            {pingMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onEdit} className={cn(btn.icon, "h-8 w-8")} aria-label={`Editar ${check.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} disabled={deleting} className={cn(btn.icon, "h-8 w-8 text-red-700 hover:bg-red-50")} aria-label={`Remover ${check.name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </div>
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

