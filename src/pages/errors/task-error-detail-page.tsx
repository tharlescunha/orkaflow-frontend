import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  Cpu,
  Database,
  FileCode2,
  GitBranch,
  Loader2,
  RefreshCcw,
  Server,
  ShieldAlert,
  TerminalSquare,
  User,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getTaskError, type TaskErrorRead } from "@/services/api/task-errors";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getCategoryLabel(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "business":
      return "Negócio";
    case "application":
      return "Aplicação";
    case "system":
      return "Sistema";
    case "validation":
      return "Validação";
    case "integration":
      return "Integração";
    case "security":
      return "Segurança";
    default:
      return value || "---";
  }
}

function getSourceLabel(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "worker":
      return "Worker";
    case "bot":
      return "Bot";
    case "orchestrator":
      return "Orquestrador";
    case "system":
      return "Sistema";
    case "api":
      return "API";
    default:
      return value || "---";
  }
}

function getStatusLabel(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "waiting":
      return "Aguardando";
    case "scheduled":
      return "Agendada";
    case "ready":
      return "Pronta";
    case "running":
      return "Executando";
    case "stop_requested":
      return "Parada solicitada";
    case "forced_stop":
      return "Força parada";
    case "finished":
      return "Finalizada";
    case "error":
      return "Erro";
    case "timeout":
      return "Timeout";
    case "canceled":
      return "Cancelada";
    default:
      return value || "---";
  }
}

function getCategoryTone(value?: string | null) {
  switch ((value || "").toLowerCase()) {
    case "validation":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "integration":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "security":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
    case "system":
      return "border-red-200 bg-red-50 text-red-700";
    case "application":
      return "border-violet-200 bg-violet-50 text-violet-700";
    case "business":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

export function TaskErrorDetailPage() {
  const { errorId } = useParams<{ errorId: string }>();
  const [toast, setToast] = useState<ToastState>(null);

  const parsedErrorId = Number(errorId);

  const errorQuery = useQuery({
    queryKey: ["task-error-detail-page", parsedErrorId],
    queryFn: () => getTaskError(parsedErrorId),
    enabled: Number.isFinite(parsedErrorId) && parsedErrorId > 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const error = errorQuery.data as TaskErrorRead | undefined;

  const canLoad = useMemo(
    () => Number.isFinite(parsedErrorId) && parsedErrorId > 0,
    [parsedErrorId]
  );

  async function handleCopy(value: string, label: string) {
    try {
      await copyToClipboard(value);
      setToast({
        type: "success",
        message: `${label} copiado com sucesso.`,
      });

      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast({
        type: "error",
        message: `Não foi possível copiar ${label.toLowerCase()}.`,
      });

      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`fixed right-6 top-20 z-[90] flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3">
                <Link
                  to="/errors"
                  className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para erros
                </Link>
              </div>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes do erro
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visão completa para identificar a causa, impacto e contexto técnico.
              </p>
            </div>

            <button
              type="button"
              onClick={() => errorQuery.refetch()}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        {!canLoad ? (
          <div className="px-6 py-10">
            <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              ID do erro inválido.
            </div>
          </div>
        ) : errorQuery.isLoading ? (
          <div className="px-6 py-10">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando detalhe do erro...
            </div>
          </div>
        ) : errorQuery.isError || !error ? (
          <div className="px-6 py-10">
            <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Não foi possível carregar os detalhes do erro.
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 p-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                  </span>

                  <span className="text-lg font-semibold text-slate-950">
                    {error.error_type || "Erro sem tipo"}
                  </span>

                  {error.code ? (
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                      Código: {error.code}
                    </span>
                  ) : null}

                  <span
                    className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${getCategoryTone(
                      error.error_category
                    )}`}
                  >
                    {getCategoryLabel(error.error_category)}
                  </span>

                  {error.is_retryable ? (
                    <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                      Reprocessável
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      Sem retry
                    </span>
                  )}
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {error.message || "---"}
                </p>
              </div>

              <div className="grid gap-0 lg:grid-cols-3">
                <div className="border-b border-r border-slate-200 px-5 py-4 lg:border-b-0">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <TerminalSquare className="h-4 w-4" />
                    Identificação
                  </div>

                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">ID do erro</dt>
                      <dd className="font-medium text-slate-900">{error.id}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Task</dt>
                      <dd className="font-medium text-slate-900">
                        #{error.task_id}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Origem</dt>
                      <dd className="font-medium text-slate-900">
                        {getSourceLabel(error.source)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Criado em</dt>
                      <dd className="font-medium text-slate-900">
                        {formatDateTime(error.created_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Atualizado em</dt>
                      <dd className="font-medium text-slate-900">
                        {formatDateTime(error.updated_at)}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border-b border-r border-slate-200 px-5 py-4 lg:border-b-0">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Clock3 className="h-4 w-4" />
                    Ações rápidas
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(error.message || "", "mensagem")}
                      className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar mensagem
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(error.stacktrace || "", "stacktrace")
                      }
                      disabled={!error.stacktrace}
                      className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar stacktrace
                    </button>

                    <Link
                      to={`/tasks/${error.task_id}`}
                      className="inline-flex h-10 items-center gap-2 border border-slate-900 bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Ver task
                    </Link>
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <ShieldAlert className="h-4 w-4" />
                    Resumo técnico
                  </div>

                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Tipo do erro</dt>
                      <dd className="font-medium text-slate-900">
                        {error.error_type || "---"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Categoria</dt>
                      <dd className="font-medium text-slate-900">
                        {getCategoryLabel(error.error_category)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Código</dt>
                      <dd className="font-medium text-slate-900">
                        {error.code || "---"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Reprocessável</dt>
                      <dd className="font-medium text-slate-900">
                        {error.is_retryable ? "Sim" : "Não"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <FileCode2 className="h-4 w-4" />
                    Contexto funcional
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Bot className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Bot</div>
                      <div className="font-medium text-slate-900">
                        {error.bot_name || "---"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <PlayCircleFallback />
                    <div>
                      <div className="text-slate-500">Automação</div>
                      <div className="font-medium text-slate-900">
                        {error.automation_label || error.automation_name || "---"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <GitBranch className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Versão do bot</div>
                      <div className="font-medium text-slate-900">
                        {error.bot_version_label || "---"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Database className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Repositório</div>
                      <div className="font-medium text-slate-900">
                        {error.repository_name || "---"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Cpu className="h-4 w-4" />
                    Contexto de execução
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-4 text-sm">
                  <div className="flex items-start gap-3">
                    <Server className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Runner</div>
                      <div className="font-medium text-slate-900">
                        {error.runner_label || error.runner_name || "---"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Criado por</div>
                      <div className="font-medium text-slate-900">
                        {error.created_by_name || "---"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Status da task</div>
                      <div className="font-medium text-slate-900">
                        {getStatusLabel(error.task_status)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-slate-400" />
                    <div>
                      <div className="text-slate-500">Duração</div>
                      <div className="font-medium text-slate-900">
                        {typeof error.execution_duration_seconds === "number"
                          ? `${error.execution_duration_seconds}s`
                          : "---"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <div className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Clock3 className="h-4 w-4" />
                    Linha do tempo da task
                  </div>
                </div>

                <div className="space-y-4 px-5 py-4 text-sm">
                  <div>
                    <div className="text-slate-500">Task criada em</div>
                    <div className="font-medium text-slate-900">
                      {formatDateTime(error.task_created_at)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Task iniciada em</div>
                    <div className="font-medium text-slate-900">
                      {formatDateTime(error.task_started_at)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Task finalizada em</div>
                    <div className="font-medium text-slate-900">
                      {formatDateTime(error.task_finished_at)}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Erro registrado em</div>
                    <div className="font-medium text-slate-900">
                      {formatDateTime(error.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <TerminalSquare className="h-4 w-4" />
                    Mensagem final da task
                  </div>
                </div>

                <div className="px-5 py-4">
                  <div className="min-h-[172px] whitespace-pre-wrap border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                    {error.final_message || "Sem mensagem final registrada."}
                  </div>
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <TerminalSquare className="h-4 w-4" />
                  Stacktrace
                </div>
              </div>

              <div className="px-5 py-4">
                <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                  {error.stacktrace || "Sem stacktrace registrado."}
                </pre>
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

function PlayCircleFallback() {
  return <Bot className="mt-0.5 h-4 w-4 text-slate-400" />;
}
