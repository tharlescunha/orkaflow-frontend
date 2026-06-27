import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Search,
  Server,
  ShieldAlert,
  TerminalSquare,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { listAutomations } from "@/services/api/automations";
import {
  listTaskErrors,
  type TaskErrorRichListItem,
} from "@/services/api/task-errors";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_SECONDS = 10;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_SECONDS * 1000;

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type AutomationLike = {
  id: number;
  name: string;
  label?: string | null;
  active?: boolean;
};

type ErrorCategoryOption =
  | ""
  | "business"
  | "application"
  | "system"
  | "validation"
  | "integration"
  | "security";

type SourceOption = "" | "worker" | "bot" | "orchestrator" | "system" | "api";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "---";

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function truncateText(value?: string | null, max = 120) {
  if (!value) return "---";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
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

function getSeverityTone(item: TaskErrorRichListItem) {
  const category = (item.error_category || "").toLowerCase();
  const isRetryable = !!item.is_retryable;

  if (category === "system" || category === "security") {
    return "border-l-red-500";
  }

  if (!isRetryable) {
    return "border-l-amber-500";
  }

  return "border-l-sky-500";
}

export function TaskErrorsPage() {
  const [page, setPage] = useState(1);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  const [searchText, setSearchText] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [automationFilter, setAutomationFilter] = useState("");
  const [errorTypeFilter, setErrorTypeFilter] = useState("");
  const [errorCategoryFilter, setErrorCategoryFilter] =
    useState<ErrorCategoryOption>("");
  const [sourceFilter, setSourceFilter] = useState<SourceOption>("");
  const [retryableFilter, setRetryableFilter] = useState("");

  const [toast, setToast] = useState<ToastState>(null);

  const skip = (page - 1) * PAGE_SIZE;

  const automationsQuery = useQuery({
    queryKey: ["task-errors-automations"],
    queryFn: async () => {
      const response = await listAutomations();
      return response as AutomationLike[];
    },
  });

  const errorsQuery = useQuery({
    queryKey: [
      "task-errors",
      page,
      searchText,
      automationFilter,
      errorTypeFilter,
      errorCategoryFilter,
      sourceFilter,
      retryableFilter,
    ],
    queryFn: () =>
      listTaskErrors({
        skip,
        limit: PAGE_SIZE,
        q: searchText || undefined,
        automation_id: automationFilter ? Number(automationFilter) : undefined,
        error_type: errorTypeFilter || undefined,
        error_category: errorCategoryFilter || undefined,
        source: sourceFilter || undefined,
        is_retryable:
          retryableFilter === "" ? undefined : retryableFilter === "true",
        ordering: "-created_at",
      }),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  const items = errorsQuery.data?.items ?? [];
  const total = errorsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const automations = useMemo(() => {
    const list = automationsQuery.data ?? [];
    return [...list].sort((a, b) => {
      const labelA = a.label?.trim() || a.name || "";
      const labelB = b.label?.trim() || b.name || "";
      return labelA.localeCompare(labelB, "pt-BR");
    });
  }, [automationsQuery.data]);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const retryableCount = items.filter((item) => item.is_retryable).length;
    const nonRetryableCount = totalItems - retryableCount;
    const systemCount = items.filter(
      (item) => (item.error_category || "").toLowerCase() === "system"
    ).length;
    const integrationCount = items.filter(
      (item) => (item.error_category || "").toLowerCase() === "integration"
    ).length;

    return {
      totalItems,
      retryableCount,
      nonRetryableCount,
      systemCount,
      integrationCount,
    };
  }, [items]);

  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_SECONDS);
  }, [
    page,
    searchText,
    automationFilter,
    errorTypeFilter,
    errorCategoryFilter,
    sourceFilter,
    retryableFilter,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL_SECONDS;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (errorsQuery.dataUpdatedAt) {
      setCountdown(REFRESH_INTERVAL_SECONDS);
    }
  }, [errorsQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => {
      setToast(null);
    }, 5000);

    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setPage(1);
  }, [
    searchText,
    automationFilter,
    errorTypeFilter,
    errorCategoryFilter,
    sourceFilter,
    retryableFilter,
  ]);

  async function handleRefresh() {
    setCountdown(REFRESH_INTERVAL_SECONDS);
    await errorsQuery.refetch();
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchText(searchInput.trim());
  }

  function handleClearFilters() {
    setSearchInput("");
    setSearchText("");
    setAutomationFilter("");
    setErrorTypeFilter("");
    setErrorCategoryFilter("");
    setSourceFilter("");
    setRetryableFilter("");
    setPage(1);
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
              <h1 className="text-2xl font-semibold text-slate-950">Erros</h1>
              <p className="mt-1 text-sm text-slate-500">
                Central de diagnóstico com visão detalhada por task, automação,
                bot, runner e stacktrace.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                Atualização automática em{" "}
                <span className="font-semibold">{countdown}s</span>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 border-b border-slate-200 px-6 py-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <AlertTriangle className="h-4 w-4" />
              Erros na página
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-950">
              {summary.totalItems}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Total carregado na paginação atual.
            </p>
          </div>

          <div className="border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <RefreshCcw className="h-4 w-4" />
              Reprocessáveis
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-950">
              {summary.retryableCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Erros marcados para nova tentativa.
            </p>
          </div>

          <div className="border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ShieldAlert className="h-4 w-4" />
              Não reprocessáveis
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-950">
              {summary.nonRetryableCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Exigem análise manual ou correção estrutural.
            </p>
          </div>

          <div className="border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <TerminalSquare className="h-4 w-4" />
              Sistema
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-950">
              {summary.systemCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Falhas mais críticas na página atual.
            </p>
          </div>

          <div className="border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <ArrowRight className="h-4 w-4" />
              Integração
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-950">
              {summary.integrationCount}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              APIs, serviços externos e integrações.
            </p>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6 py-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter className="h-4 w-4" />
            Filtros
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="grid gap-3 lg:grid-cols-2 xl:grid-cols-6"
          >
            <label className="xl:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Busca
              </span>
              <div className="flex h-11 items-center border border-slate-300 bg-white px-3">
                <Search className="mr-2 h-4 w-4 text-slate-400" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Mensagem, stacktrace, bot, runner, automação..."
                  className="h-full w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Automação
              </span>
              <select
                value={automationFilter}
                onChange={(event) => setAutomationFilter(event.target.value)}
                className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todas</option>
                {automations.map((automation) => (
                  <option key={automation.id} value={automation.id}>
                    {automation.label?.trim() || automation.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Tipo do erro
              </span>
              <input
                value={errorTypeFilter}
                onChange={(event) => setErrorTypeFilter(event.target.value)}
                placeholder="Ex.: SAPError"
                className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Categoria
              </span>
              <select
                value={errorCategoryFilter}
                onChange={(event) =>
                  setErrorCategoryFilter(
                    event.target.value as ErrorCategoryOption
                  )
                }
                className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todas</option>
                <option value="business">Negócio</option>
                <option value="application">Aplicação</option>
                <option value="system">Sistema</option>
                <option value="validation">Validação</option>
                <option value="integration">Integração</option>
                <option value="security">Segurança</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Origem
              </span>
              <select
                value={sourceFilter}
                onChange={(event) =>
                  setSourceFilter(event.target.value as SourceOption)
                }
                className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todas</option>
                <option value="worker">Worker</option>
                <option value="bot">Bot</option>
                <option value="orchestrator">Orquestrador</option>
                <option value="system">Sistema</option>
                <option value="api">API</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Reprocessável
              </span>
              <select
                value={retryableFilter}
                onChange={(event) => setRetryableFilter(event.target.value)}
                className="h-11 w-full border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Todos</option>
                <option value="true">Sim</option>
                <option value="false">Não</option>
              </select>
            </label>

            <div className="flex items-end gap-3 xl:col-span-6">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Search className="h-4 w-4" />
                Buscar
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex h-11 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Limpar filtros
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Erro</th>
                <th className="px-4 py-3">Automação / Bot</th>
                <th className="px-4 py-3">Task / Runner</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Origem</th>
                <th className="px-4 py-3">Criado em</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {errorsQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando erros...
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <AlertTriangle className="h-5 w-5" />
                      <p className="text-sm font-medium">
                        Nenhum erro encontrado para os filtros informados.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-200 border-l-4 bg-white align-top transition hover:bg-slate-50 ${getSeverityTone(
                      item
                    )}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-md border border-red-200 bg-red-50 p-2 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                        </div>

                        <div className="min-w-[260px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-slate-950">
                              {item.error_type || "Erro sem tipo"}
                            </span>

                            {item.code ? (
                              <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {item.code}
                              </span>
                            ) : null}

                            {item.is_retryable ? (
                              <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                                Reprocessável
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                Sem retry
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-slate-700">
                            {truncateText(item.message, 150)}
                          </p>

                          <div className="mt-3 grid gap-1 text-xs text-slate-500">
                            <span>ID do erro: {item.id}</span>
                            <span>
                              Duração da task:{" "}
                              {formatDuration(item.execution_duration_seconds)}
                            </span>
                            <span>
                              Status da task: {getStatusLabel(item.task_status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-900">
                          <PlayCircle className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">
                            {item.automation_label?.trim() ||
                              item.automation_name ||
                              "---"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600">
                          <Bot className="h-4 w-4 text-slate-400" />
                          <span>{item.bot_name || "---"}</span>
                        </div>

                        <div className="text-xs text-slate-500">
                          Versão: {item.bot_version_label || "---"}
                        </div>

                        <div className="text-xs text-slate-500">
                          Repositório: {item.repository_name || "---"}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2 text-sm">
                        <div className="text-slate-900">
                          <span className="font-medium">Task #{item.task_id}</span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600">
                          <Server className="h-4 w-4 text-slate-400" />
                          <span>
                            {item.runner_label?.trim() ||
                              item.runner_name ||
                              "Sem runner"}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500">
                          Criado por: {item.created_by_name || "---"}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium ${getCategoryTone(
                          item.error_category
                        )}`}
                      >
                        {getCategoryLabel(item.error_category)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2 text-sm text-slate-700">
                        <div>{getSourceLabel(item.source)}</div>
                        <div className="text-xs text-slate-500">
                          {item.final_message
                            ? truncateText(item.final_message, 70)
                            : "Sem mensagem final"}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="space-y-2 text-sm text-slate-700">
                        <div>{formatDateTime(item.created_at)}</div>
                        <div className="text-xs text-slate-500">
                          Início: {formatDateTime(item.task_started_at)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Fim: {formatDateTime(item.task_finished_at)}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/errors/${item.id}`}
                          className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Detalhes
                        </Link>

                        <Link
                          to={`/tasks/${item.task_id}`}
                          className="inline-flex h-9 items-center gap-2 border border-slate-900 bg-slate-900 px-3 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          Task
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">
            Mostrando{" "}
            <span className="font-medium text-slate-700">{items.length}</span>{" "}
            de <span className="font-medium text-slate-700">{total}</span>{" "}
            registros.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <div className="min-w-[120px] text-center text-sm text-slate-600">
              Página <span className="font-semibold">{page}</span> de{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
