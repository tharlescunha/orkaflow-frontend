import { useEffect, useMemo, useState } from "react";
import { getApiErrorMessage, withApiDetail } from "@/lib/api-error";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  GitCommitHorizontal,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

import {
  createBotVersion,
  getBotVersionGitPreview,
  listBotVersions,
  releaseBotVersion,
  type BotVersionGitPreview,
  type CreateBotVersionPayload,
} from "@/services/api/bot-versions";
import { listAllBots } from "@/services/api/bots";
import { parseApiDate } from "@/lib/health";
import { SearchableSelect } from "@/components/common/searchable-select";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

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

function formatDateTime(value?: string | null) {
  const date = parseApiDate(value);
  return date ? date.toLocaleString("pt-BR") : "---";
}

export function BotVersionCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<ToastState>(null);
  const [botId, setBotId] = useState("");
  // null = ainda não editado: mostra o que veio do Git (ou a sugestão do cadastro manual).
  const [versionDraft, setVersionDraft] = useState<string | null>(null);
  const [changelogDraft, setChangelogDraft] = useState<string | null>(null);
  // Sem Git (repositório fora do ar, sem URL...): cadastro manual como antes.
  const [manualMode, setManualMode] = useState(false);

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

  const manualSuggestion = useMemo(() => {
    const ofBot = (versionsQuery.data ?? []).filter((v) => v.bot_id === selectedBotId);
    return nextVersion(ofBot.map((v) => v.version));
  }, [versionsQuery.data, selectedBotId]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  // Resultado do Git preenche o formulário; o usuário ainda pode ajustar versão e changelog.
  const version =
    versionDraft ?? (manualMode ? manualSuggestion : preview?.suggested_version ?? "");
  const changelog = changelogDraft ?? (manualMode ? "" : preview?.changelog ?? "");

  const createMutation = useMutation({
    mutationFn: (payload: CreateBotVersionPayload) => createBotVersion(payload),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["bot-versions"] });
      setToast({
        type: "success",
        message: `Versão ${created.version} criada. Ela passa a ser a executada pelo orquestrador.`,
      });
      setTimeout(() => navigate("/bot-versions"), 900);
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: withApiDetail("Não foi possível cadastrar a versão.", error),
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (versionId: number) => releaseBotVersion(versionId),
    onSuccess: (released) => {
      queryClient.invalidateQueries({ queryKey: ["bot-versions"] });
      setToast({
        type: "success",
        message: `Release feito: o orquestrador passa a executar a versão ${released.version}.`,
      });
      setTimeout(() => navigate("/bot-versions"), 900);
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: withApiDetail("Não foi possível fazer o Release.", error),
      });
    },
  });

  function handleSelectBot(value: string) {
    setBotId(value);
    setManualMode(false);
    setVersionDraft(null);
    setChangelogDraft(null);
  }

  function handleManualMode(on: boolean) {
    setManualMode(on);
    setVersionDraft(null);
    setChangelogDraft(null);
  }

  const canSave = manualMode
    ? hasBot && version.trim() !== ""
    : preview?.status === "nova_versao" && version.trim() !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

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
      {toast ? (
        <div
          className={`fixed right-6 top-20 z-[80] flex items-start gap-3 border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="pr-4 text-sm font-medium">{toast.message}</div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 transition hover:text-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/bot-versions")}
            className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para versões
          </button>

          <h1 className="text-2xl font-semibold text-slate-950">Nova Versão de Bot</h1>
          <p className="mt-1 text-sm text-slate-500">
            Escolha o bot: a versão é lida do Git (último commit, mensagens e data) e o
            número é calculado a partir da última versão.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-6 py-6">
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <FormField label="Bot">
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
                  required
                />
              </FormField>

              {hasBot && !manualMode ? (
                <button
                  type="button"
                  onClick={() => previewQuery.refetch()}
                  disabled={previewQuery.isFetching}
                  className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <RefreshCcw className={`h-4 w-4 ${previewQuery.isFetching ? "animate-spin" : ""}`} />
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
                releasing={releaseMutation.isPending}
                onRelease={(id) => releaseMutation.mutate(id)}
                onManual={() => handleManualMode(true)}
              />
            ) : null}

            {manualMode ? (
              <div className="flex items-start justify-between gap-4 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <span>Cadastro manual, sem ler o Git: a versão não terá commit registrado.</span>
                <button
                  type="button"
                  onClick={() => handleManualMode(false)}
                  className="shrink-0 font-medium underline"
                >
                  Voltar a usar o Git
                </button>
              </div>
            ) : null}

            {(manualMode || preview) && hasBot ? (
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Dados da versão
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Versão">
                    <input
                      value={version}
                      onChange={(e) => setVersionDraft(e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="1.0.0"
                      required
                    />
                    <span className="mt-1 block text-xs text-slate-500">
                      Calculada a partir da última
                      {preview?.last_version ? ` (${preview.last_version})` : ""}. Pode ajustar.
                    </span>
                  </FormField>

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

                      <ReadOnlyField label="Data do commit">
                        {formatDateTime(preview.head.committed_at)}
                      </ReadOnlyField>

                      <div className="md:col-span-2">
                        <ReadOnlyField label="Repositório">
                          <span className="break-all">{preview.repository}</span>
                        </ReadOnlyField>
                      </div>
                    </>
                  ) : null}

                  <div className="md:col-span-2">
                    <FormField label="Changelog">
                      <textarea
                        value={changelog}
                        onChange={(e) => setChangelogDraft(e.target.value)}
                        className="min-h-[140px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-xs leading-5 text-slate-900 outline-none transition focus:border-slate-900"
                        placeholder="O que mudou nesta versão"
                      />
                    </FormField>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => navigate("/bot-versions")}
              className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!canSave || createMutation.isPending}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Salvando..." : "Salvar versão"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SyncStatus({
  loading,
  error,
  preview,
  releasing,
  onRelease,
  onManual,
}: {
  loading: boolean;
  error: string | null;
  preview?: BotVersionGitPreview;
  releasing: boolean;
  onRelease: (versionId: number) => void;
  onManual: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        Sincronizando com o Git... (o primeiro acesso a um repositório pode levar alguns segundos)
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start justify-between gap-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </span>
        <button type="button" onClick={onManual} className="shrink-0 font-medium underline">
          Cadastrar sem Git
        </button>
      </div>
    );
  }

  if (!preview) return null;

  if (preview.status === "sincronizado") {
    return (
      <div className="flex items-start gap-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        {preview.message} Não há nada novo para criar.
      </div>
    );
  }

  if (preview.status === "ja_registrado") {
    return (
      <div className="flex flex-col gap-3 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:flex-row md:items-center md:justify-between">
        <span className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {preview.message}
        </span>
        {preview.existing_version_id ? (
          <button
            type="button"
            disabled={releasing}
            onClick={() => onRelease(preview.existing_version_id as number)}
            className="inline-flex h-9 shrink-0 items-center gap-2 bg-amber-600 px-3 font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Release da versão {preview.existing_version}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <p className="font-medium">{preview.message}</p>
      <p className="mt-1 text-blue-700">
        {preview.commits.length} commit(s) entram nesta versão. Confira e clique em Salvar versão.
      </p>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-slate-900">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex min-h-10 items-center border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
        {children}
      </div>
    </div>
  );
}
