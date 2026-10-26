import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, GitCommitHorizontal, Loader2, RefreshCcw, RotateCcw, Save } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage, withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { parseApiDate } from "@/lib/health";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  createBotVersion,
  getBotVersionGitPreview,
  listBotVersions,
  releaseBotVersion,
  type BotVersionGitPreview,
  type CreateBotVersionPayload,
} from "@/services/api/bot-versions";
import { listAllBots } from "@/services/api/bots";
import { toast } from "@/store/toast-store";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

// Próxima versão a partir da maior já cadastrada (1.0.1 -> 1.0.2); sem nenhuma, 1.0.0.
function nextVersion(versions: string[]) {
  let best: [number, number, number] | null = null;
  for (const v of versions) {
    const m = SEMVER_RE.exec(v);
    if (!m) continue;
    const key: [number, number, number] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (
      !best ||
      key[0] > best[0] ||
      (key[0] === best[0] && (key[1] > best[1] || (key[1] === best[1] && key[2] > best[2])))
    ) {
      best = key;
    }
  }
  return best ? `${best[0]}.${best[1]}.${best[2] + 1}` : "1.0.0";
}

function formatCommitDate(value?: string | null) {
  return formatDateTime(parseApiDate(value));
}

type ReleaseTarget = { id: number; version: string };

export function BotVersionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [botId, setBotId] = useState("");
  // null = ainda não editado: mostra o que veio do Git (ou a sugestão do cadastro manual).
  const [versionDraft, setVersionDraft] = useState<string | null>(null);
  const [changelogDraft, setChangelogDraft] = useState<string | null>(null);
  // Sem Git (repositório fora do ar, sem URL...): cadastro manual como antes.
  const [manualMode, setManualMode] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<ReleaseTarget | null>(null);

  const selectedBotId = Number(botId);
  const hasBot = Number.isFinite(selectedBotId) && selectedBotId > 0;

  const botsQuery = useQuery({
    queryKey: ["bots-select-for-create-version"],
    queryFn: () => listAllBots(),
  });

  const versionsQuery = useQuery({
    queryKey: ["bot-versions"],
    queryFn: listBotVersions,
  });

  const previewQuery = useQuery({
    queryKey: ["bot-version-git-preview", selectedBotId],
    queryFn: () => getBotVersionGitPreview(selectedBotId),
    enabled: hasBot && !manualMode,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const preview: BotVersionGitPreview | undefined = previewQuery.data;

  const sortedBots = useMemo(() => {
    return [...(botsQuery.data?.items ?? [])].sort((a, b) => {
      if (a.active !== b.active) return Number(b.active) - Number(a.active);
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [botsQuery.data]);

  const selectedBotName = sortedBots.find((bot) => bot.id === selectedBotId)?.name ?? `Bot #${selectedBotId}`;

  const manualSuggestion = useMemo(() => {
    const ofBot = (versionsQuery.data ?? []).filter((v) => v.bot_id === selectedBotId);
    return nextVersion(ofBot.map((v) => v.version));
  }, [versionsQuery.data, selectedBotId]);

  // Resultado do Git preenche o formulário; o usuário ainda pode ajustar versão e changelog.
  const version = versionDraft ?? (manualMode ? manualSuggestion : (preview?.suggested_version ?? ""));
  const changelog = changelogDraft ?? (manualMode ? "" : (preview?.changelog ?? ""));

  const createMutation = useMutation({
    mutationFn: (payload: CreateBotVersionPayload) => createBotVersion(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["bot-versions"] });
      toast.success(`Versão ${created.version} criada. Ela passa a ser a executada pelo orquestrador.`);
      navigate("/bot-versions");
    },
    onError: (error) => {
      setConfirmCreate(false);
      toast.error(withApiDetail("Não foi possível cadastrar a versão.", error));
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (versionId: number) => releaseBotVersion(versionId),
    onSuccess: (released) => {
      queryClient.invalidateQueries({ queryKey: ["bot-versions"] });
      toast.success(`Release feito: o orquestrador passa a executar a versão ${released.version}.`);
      navigate("/bot-versions");
    },
    onError: (error) => {
      setReleaseTarget(null);
      toast.error(withApiDetail("Não foi possível fazer o Release.", error));
    },
  });

  function handleSelectBot(value: string) {
    setBotId(value);
    setManualMode(false);
    setVersionDraft(null);
    setChangelogDraft(null);
    setSubmitted(false);
  }

  function handleManualMode(on: boolean) {
    setManualMode(on);
    setVersionDraft(null);
    setChangelogDraft(null);
    setSubmitted(false);
  }

  const versionError = !version.trim()
    ? "Informe a versão."
    : !SEMVER_RE.test(version.trim())
      ? "Use o formato maior.menor.correção (ex.: 1.0.2)."
      : null;

  const canSave = manualMode ? hasBot && !versionError : preview?.status === "nova_versao" && !versionError;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!canSave) return;
    setConfirmCreate(true);
  }

  function confirmAndCreate() {
    const payload: CreateBotVersionPayload =
      manualMode || !preview
        ? {
            bot_id: selectedBotId,
            version: version.trim(),
            storage_type: "manual",
            changelog: changelog.trim() || null,
            is_active: true,
          }
        : {
            bot_id: selectedBotId,
            version: version.trim(),
            storage_type: "git",
            commit_hash: preview.head.hash,
            branch: preview.branch,
            artifact_path: preview.repository || null,
            changelog: changelog.trim() || null,
            commit_author: preview.head.author,
            committed_at: preview.head.committed_at,
            is_active: true,
          };

    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/bot-versions"
          backLabel="Voltar para versões"
          title="Nova versão de bot"
          description="Escolha o bot: a versão é lida do Git (último commit, mensagens e data) e o número é calculado a partir da última versão."
        />

        <form onSubmit={handleSubmit} noValidate>
          <div className={cn(cardBody, "space-y-5")}>
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <Field label="Bot">
                <SearchableSelect<number>
                  value={botId === "" ? "" : Number(botId)}
                  onChange={(value) => handleSelectBot(value === "" ? "" : String(value))}
                  options={sortedBots.map((bot) => ({
                    value: bot.id,
                    label: bot.name,
                    description: bot.active ? bot.repository_name : "Inativo",
                    disabled: !bot.active,
                  }))}
                  placeholder="Selecione o bot"
                  searchPlaceholder="Buscar bot ou repositório..."
                  loading={botsQuery.isLoading}
                  disabled={botsQuery.isLoading}
                />
              </Field>

              {hasBot && !manualMode ? (
                <button
                  type="button"
                  onClick={() => previewQuery.refetch()}
                  disabled={previewQuery.isFetching}
                  className={btn.secondary}
                >
                  <RefreshCcw className={cn("h-4 w-4", previewQuery.isFetching && "animate-spin")} />
                  Sincronizar com o Git
                </button>
              ) : null}
            </div>

            {hasBot && !manualMode ? (
              <SyncStatus
                loading={previewQuery.isFetching}
                error={
                  previewQuery.isError
                    ? getApiErrorMessage(previewQuery.error, "Não foi possível ler o Git do bot.")
                    : null
                }
                preview={preview}
                onRelease={(target) => setReleaseTarget(target)}
                onManual={() => handleManualMode(true)}
              />
            ) : null}

            {manualMode ? (
              <div className="flex items-start justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Cadastro manual, sem ler o Git: a versão não terá commit registrado.
                </span>
                <button
                  type="button"
                  onClick={() => handleManualMode(false)}
                  className="shrink-0 font-medium underline underline-offset-2"
                >
                  Voltar a usar o Git
                </button>
              </div>
            ) : null}

            {(manualMode || preview) && hasBot ? (
              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Dados da versão</h2>
                </div>

                <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
                  <Field
                    label="Versão"
                    error={submitted ? versionError : null}
                    help={`Calculada a partir da última${preview?.last_version ? ` (${preview.last_version})` : ""}. Pode ajustar.`}
                  >
                    <input
                      value={version}
                      onChange={(e) => setVersionDraft(e.target.value)}
                      className={cn(input, "font-mono")}
                      placeholder="1.0.0"
                    />
                  </Field>

                  {!manualMode && preview ? (
                    <>
                      <ReadOnlyField label="Versão do Git (commit)">
                        <span className="inline-flex items-center gap-2 font-mono">
                          <GitCommitHorizontal className="h-4 w-4 text-slate-400" />
                          {preview.head.short}
                        </span>
                        <span className="ml-2 text-slate-500">branch {preview.branch}</span>
                      </ReadOnlyField>

                      <ReadOnlyField label="Autor do commit">{preview.head.author}</ReadOnlyField>

                      <ReadOnlyField label="Data do commit">{formatCommitDate(preview.head.committed_at)}</ReadOnlyField>

                      <div className="md:col-span-2">
                        <ReadOnlyField label="Repositório">
                          <span className="break-all">{preview.repository}</span>
                        </ReadOnlyField>
                      </div>
                    </>
                  ) : null}

                  <div className="md:col-span-2">
                    <Field label="Changelog">
                      <textarea
                        value={changelog}
                        onChange={(e) => setChangelogDraft(e.target.value)}
                        className={cn(textarea, "min-h-[140px] font-mono text-xs leading-5")}
                        placeholder="O que mudou nesta versão"
                      />
                    </Field>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={() => navigate("/bot-versions")} className={btn.secondary}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || (submitted && !canSave) || (!manualMode && preview?.status !== "nova_versao")}
              className={btn.primary}
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Salvando..." : "Salvar versão"}
            </button>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={confirmCreate}
        title="Criar nova versão"
        confirmLabel="Criar versão"
        isPending={createMutation.isPending}
        onConfirm={confirmAndCreate}
        onCancel={() => {
          if (!createMutation.isPending) setConfirmCreate(false);
        }}
        description={
          <div className="space-y-2">
            <p>
              Bot: <strong>{selectedBotName}</strong>
              <br />
              Versão: <strong className="font-mono">{version.trim()}</strong>
              {!manualMode && preview ? ` (commit ${preview.head.short})` : " (cadastro manual, sem commit)"}
            </p>
            <p>A versão nova passa a ser a executada pelo orquestrador nas próximas tasks desse bot.</p>
          </div>
        }
      />

      <ConfirmDialog
        open={releaseTarget !== null}
        title="Release da versão"
        confirmLabel="Fazer Release"
        isPending={releaseMutation.isPending}
        onConfirm={() => releaseTarget && releaseMutation.mutate(releaseTarget.id)}
        onCancel={() => {
          if (!releaseMutation.isPending) setReleaseTarget(null);
        }}
        description={
          releaseTarget ? (
            <div className="space-y-2">
              <p>
                Bot: <strong>{selectedBotName}</strong>
                <br />
                Versão: <strong className="font-mono">{releaseTarget.version}</strong>
              </p>
              <p>
                O commit atual do Git já está cadastrado nessa versão. As próximas execuções desse bot passam
                a usá-la.
              </p>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

function SyncStatus({
  loading,
  error,
  preview,
  onRelease,
  onManual,
}: {
  loading: boolean;
  error: string | null;
  preview?: BotVersionGitPreview;
  onRelease: (target: ReleaseTarget) => void;
  onManual: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        Sincronizando com o Git... (o primeiro acesso a um repositório pode levar alguns segundos)
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </span>
        <button type="button" onClick={onManual} className="shrink-0 font-medium underline underline-offset-2">
          Cadastrar sem Git
        </button>
      </div>
    );
  }

  if (!preview) return null;

  if (preview.status === "sincronizado") {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        {preview.message} Não há nada novo para criar.
      </div>
    );
  }

  if (preview.status === "ja_registrado") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
        <span className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {preview.message}
        </span>
        {preview.existing_version_id ? (
          <button
            type="button"
            onClick={() =>
              onRelease({ id: preview.existing_version_id as number, version: preview.existing_version ?? "" })
            }
            className={cn(btn.secondary, "h-9 shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100")}
          >
            <RotateCcw className="h-4 w-4" />
            Release da versão {preview.existing_version}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <p className="font-medium">{preview.message}</p>
      <p className="mt-1 text-blue-700">
        {preview.commits.length} commit(s) entram nesta versão. Confira e clique em Salvar versão.
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string | null;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {error ? <p className={fieldError}>{error}</p> : help ? <p className={hint}>{help}</p> : null}
    </div>
  );
}

function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        {children}
      </div>
    </div>
  );
}
