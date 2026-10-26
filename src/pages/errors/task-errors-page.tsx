import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Eye, ListChecks } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { EmptyState } from "@/components/common/empty-state";
import { ActiveFilterChips, FilterBar, Pagination, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { SearchableSelect } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { EMPTY, formatDuration, formatTimeSmart } from "@/lib/format";
import { badge, btn, card, input, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listAutomations } from "@/services/api/automations";
import { listTaskErrors, type TaskErrorRichListItem } from "@/services/api/task-errors";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 10_000;

type AutomationLike = {
  id: number;
  name: string;
  label?: string | null;
  active?: boolean;
};

type ErrorCategoryOption = "" | "business" | "application" | "system" | "validation" | "integration" | "security";

type SourceOption = "" | "worker" | "bot" | "orchestrator" | "system" | "api";

type RetryableOption = "" | "true" | "false";

const CATEGORY_LABEL: Record<string, string> = {
  business: "Negócio",
  application: "Aplicação",
  system: "Sistema",
  validation: "Validação",
  integration: "Integração",
  security: "Segurança",
};

const SOURCE_LABEL: Record<string, string> = {
  worker: "Worker",
  bot: "Bot",
  orchestrator: "Orquestrador",
  system: "Sistema",
  api: "API",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Aguardando",
  scheduled: "Agendada",
  ready: "Pronta",
  running: "Executando",
  stop_requested: "Parada solicitada",
  forced_stop: "Parada forçada",
  finished: "Finalizada",
  error: "Erro",
  timeout: "Timeout",
  canceled: "Cancelada",
};

const CATEGORY_TONE: Record<string, string> = {
  validation: tone.warning,
  integration: tone.info,
  security: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  system: tone.danger,
  application: "border-violet-200 bg-violet-50 text-violet-700",
  business: tone.success,
};

function getCategoryLabel(value?: string | null) {
  const key = (value || "").toLowerCase();
  return CATEGORY_LABEL[key] ?? (value || EMPTY);
}

function getSourceLabel(value?: string | null) {
  const key = (value || "").toLowerCase();
  return SOURCE_LABEL[key] ?? (value || EMPTY);
}

function getStatusLabel(value?: string | null) {
  const key = (value || "").toLowerCase();
  return STATUS_LABEL[key] ?? (value || EMPTY);
}

function getCategoryTone(value?: string | null) {
  return CATEGORY_TONE[(value || "").toLowerCase()] ?? tone.neutral;
}

function automationLabel(item: TaskErrorRichListItem) {
  return item.automation_label?.trim() || item.automation_name || EMPTY;
}

export function TaskErrorsPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [automationFilter, setAutomationFilter] = useState("");
  const [errorTypeFilter, setErrorTypeFilter] = useState("");
  const [errorCategoryFilter, setErrorCategoryFilter] = useState<ErrorCategoryOption>("");
  const [sourceFilter, setSourceFilter] = useState<SourceOption>("");
  const [retryableFilter, setRetryableFilter] = useState<RetryableOption>("");

  const skip = (page - 1) * PAGE_SIZE;
  const searchText = search.trim();

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
        is_retryable: retryableFilter === "" ? undefined : retryableFilter === "true",
        ordering: "-created_at",
      }),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  const items = errorsQuery.data?.items ?? [];
  const total = errorsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const automationOptions = useMemo(() => {
    const list = automationsQuery.data ?? [];
    return [...list]
      .sort((a, b) => (a.label?.trim() || a.name || "").localeCompare(b.label?.trim() || b.name || "", "pt-BR"))
      .map((automation) => ({ value: automation.id, label: automation.label?.trim() || automation.name }));
  }, [automationsQuery.data]);

  const selectedAutomationName = automationOptions.find((option) => String(option.value) === automationFilter)?.label;

  // Qualquer filtro novo volta para a primeira página (no handler, não em efeito).
  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeAutomation(value: string) {
    setAutomationFilter(value);
    setPage(1);
  }

  function changeErrorType(value: string) {
    setErrorTypeFilter(value);
    setPage(1);
  }

  function changeCategory(value: ErrorCategoryOption) {
    setErrorCategoryFilter(value);
    setPage(1);
  }

  function changeSource(value: SourceOption) {
    setSourceFilter(value);
    setPage(1);
  }

  function changeRetryable(value: RetryableOption) {
    setRetryableFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setAutomationFilter("");
    setErrorTypeFilter("");
    setErrorCategoryFilter("");
    setSourceFilter("");
    setRetryableFilter("");
    setPage(1);
  }

  const hasActiveFilters =
    searchText !== "" ||
    automationFilter !== "" ||
    errorTypeFilter !== "" ||
    errorCategoryFilter !== "" ||
    sourceFilter !== "" ||
    retryableFilter !== "";

  const chips = [
    ...(searchText ? [{ key: "search", label: `Busca: ${searchText}`, onRemove: () => changeSearch("") }] : []),
    ...(automationFilter
      ? [{ key: "automation", label: `Automação: ${selectedAutomationName ?? `#${automationFilter}`}`, onRemove: () => changeAutomation("") }]
      : []),
    ...(errorTypeFilter ? [{ key: "type", label: `Tipo: ${errorTypeFilter}`, onRemove: () => changeErrorType("") }] : []),
    ...(errorCategoryFilter
      ? [{ key: "category", label: `Categoria: ${getCategoryLabel(errorCategoryFilter)}`, onRemove: () => changeCategory("") }]
      : []),
    ...(sourceFilter ? [{ key: "source", label: `Origem: ${getSourceLabel(sourceFilter)}`, onRemove: () => changeSource("") }] : []),
    ...(retryableFilter
      ? [{ key: "retryable", label: retryableFilter === "true" ? "Reprocessáveis" : "Sem retry", onRemove: () => changeRetryable("") }]
      : []),
  ];

  return (
    <section className={card}>
      <PageHeader
        title="Erros"
        description="Exceções registradas pelos robôs, mais recentes primeiro. Clique na linha para ver o stacktrace."
        actions={
          <RefreshIndicator
            updatedAt={errorsQuery.dataUpdatedAt}
            isFetching={errorsQuery.isFetching}
            onRefresh={() => errorsQuery.refetch()}
            intervalMs={REFRESH_INTERVAL_MS}
          />
        }
      />

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <SearchInput value={search} onChange={changeSearch} placeholder="Buscar na mensagem, stacktrace, bot ou runner" />

        <SearchableSelect<number>
          value={automationFilter ? Number(automationFilter) : ""}
          onChange={(value) => changeAutomation(value === "" ? "" : String(value))}
          options={automationOptions}
          emptyLabel="Todas as automações"
          placeholder="Todas as automações"
          searchPlaceholder="Buscar automação..."
          loading={automationsQuery.isLoading}
          className="w-full sm:w-64"
        />

        <input
          value={errorTypeFilter}
          onChange={(e) => changeErrorType(e.target.value)}
          placeholder="Tipo do erro (ex.: SAPError)"
          aria-label="Tipo do erro"
          className={cn(input, "w-full sm:w-52")}
        />

        <select
          value={errorCategoryFilter}
          onChange={(e) => changeCategory(e.target.value as ErrorCategoryOption)}
          aria-label="Categoria"
          className={cn(select, "w-full sm:w-44")}
        >
          <option value="">Todas as categorias</option>
          <option value="business">Negócio</option>
          <option value="application">Aplicação</option>
          <option value="system">Sistema</option>
          <option value="validation">Validação</option>
          <option value="integration">Integração</option>
          <option value="security">Segurança</option>
        </select>

        <select
          value={sourceFilter}
          onChange={(e) => changeSource(e.target.value as SourceOption)}
          aria-label="Origem"
          className={cn(select, "w-full sm:w-40")}
        >
          <option value="">Todas as origens</option>
          <option value="worker">Worker</option>
          <option value="bot">Bot</option>
          <option value="orchestrator">Orquestrador</option>
          <option value="system">Sistema</option>
          <option value="api">API</option>
        </select>

        <select
          value={retryableFilter}
          onChange={(e) => changeRetryable(e.target.value as RetryableOption)}
          aria-label="Reprocessável"
          className={cn(select, "w-full sm:w-40")}
        >
          <option value="">Com e sem retry</option>
          <option value="true">Reprocessáveis</option>
          <option value="false">Sem retry</option>
        </select>
      </FilterBar>

      <ActiveFilterChips chips={chips} />

      {errorsQuery.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : errorsQuery.isError ? (
        <div className="p-5">
          <QueryError error={errorsQuery.error} what="os erros" onRetry={() => errorsQuery.refetch()} retrying={errorsQuery.isFetching} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? AlertTriangle : ListChecks}
          title={hasActiveFilters ? "Nenhum erro com esses filtros" : "Nenhum erro registrado"}
          description={hasActiveFilters ? "Tente outra busca ou limpe os filtros." : "Os robôs não registraram exceções até agora."}
          action={
            hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className={btn.secondary}>
                Limpar filtros
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Erro</th>
                  <th className={table.th}>Automação / Bot</th>
                  <th className={table.th}>Task</th>
                  <th className={table.th}>Categoria</th>
                  <th className={table.th}>Origem</th>
                  <th className={table.th}>Quando</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={cn(table.trClickable, "align-top")} onClick={() => navigate(`/errors/${item.id}`)}>
                    <td className={cn(table.td, "min-w-[320px] max-w-[520px]")}>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-950">{item.error_type || "Erro sem tipo"}</p>
                          <p className="mt-0.5 line-clamp-2 break-words text-sm text-slate-700" title={item.message || undefined}>
                            {item.message || EMPTY}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span>#{item.id}</span>
                            {item.code ? <span className={cn(badge, tone.neutral)}>{item.code}</span> : null}
                            <span className={cn(badge, item.is_retryable ? tone.info : tone.warning)}>
                              {item.is_retryable ? "Reprocessável" : "Sem retry"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={table.td}>
                      <span className={cn(table.truncate, "font-medium text-slate-900")} title={automationLabel(item)}>
                        {automationLabel(item)}
                      </span>
                      <span className="mt-0.5 block max-w-[280px] truncate text-xs text-slate-500" title={item.bot_name || undefined}>
                        {item.bot_name || EMPTY}
                        {item.bot_version_label ? ` · ${item.bot_version_label}` : ""}
                      </span>
                    </td>
                    <td className={table.td}>
                      <span className="font-medium text-slate-900">#{item.task_id}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{getStatusLabel(item.task_status)}</span>
                      <span className="block max-w-[200px] truncate text-xs text-slate-500" title={item.runner_label?.trim() || item.runner_name || undefined}>
                        {item.runner_label?.trim() || item.runner_name || "Sem runner"}
                        {item.execution_duration_seconds !== null && item.execution_duration_seconds !== undefined
                          ? ` · ${formatDuration(item.execution_duration_seconds)}`
                          : ""}
                      </span>
                    </td>
                    <td className={table.td}>
                      <span className={cn(badge, getCategoryTone(item.error_category))}>{getCategoryLabel(item.error_category)}</span>
                    </td>
                    <td className={table.tdMuted}>{getSourceLabel(item.source)}</td>
                    <td className={cn(table.tdMuted, "whitespace-nowrap tabular-nums")}>{formatTimeSmart(item.created_at)}</td>
                    <td className={table.tdRight}>
                      <ActionsMenu
                        label={`Ações do erro #${item.id}`}
                        items={[
                          { label: "Ver detalhes", icon: Eye, onSelect: () => navigate(`/errors/${item.id}`) },
                          { label: `Ver task #${item.task_id}`, icon: ListChecks, onSelect: () => navigate(`/tasks/${item.task_id}`) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} label="erros" />
        </>
      )}
    </section>
  );
}
