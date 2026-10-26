import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  HeartPulse,
  Loader2,
  Monitor,
  Play,
  Timer,
  X,
} from "lucide-react";

import { SearchableSelect, type SearchableOption } from "@/components/common/searchable-select";
import { PageHeader } from "@/components/common/page-header";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { CardSkeleton } from "@/components/common/skeleton";
import { normalizeSearch } from "@/lib/search";
import { getApiErrorMessage } from "@/lib/api-error";
import { runNowPayload } from "@/lib/run-task";
import { EMPTY, formatDateTime, formatDuration } from "@/lib/format";
import { toast } from "@/store/toast-store";
import { getAutomation } from "@/services/api/automations";
import { listAllBots } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { createTask } from "@/services/api/tasks";
import { listAutomationHealth, type AutomationHealthItemRead, type AutomationHealthStatus } from "@/services/api/automation-health";
import { badge, btn, card, focusRing, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

type ActiveFilter = "active" | "inactive" | "all";

const ACTIVE_FILTER_OPTIONS: SearchableOption<ActiveFilter>[] = [
  { value: "active", label: "Somente ativas" },
  { value: "inactive", label: "Somente inativas" },
  { value: "all", label: "Todas" },
];

type CardSize = "compact" | "normal";

const REFRESH_MS = 10_000;
// Mesma chave de antes; "sm" = compacto, qualquer outro = normal (compatível com o valor antigo sm/md/lg).
const CARD_SCALE_STORAGE_KEY = "automation-health-card-scale";

function getStoredCardSize(): CardSize {
  if (typeof window === "undefined") return "normal";
  try {
    return window.localStorage.getItem(CARD_SCALE_STORAGE_KEY) === "sm" ? "compact" : "normal";
  } catch {
    return "normal";
  }
}

// Sem agendamento a automação só roda manualmente: não tem regra nem atraso.
function formatRelativeRule(value?: string | null) {
  if (!value) return "Manual";
  return value;
}

function normalizeText(value?: string | null) {
  return normalizeSearch(value ?? "");
}

/**
 * Motivo de a automação não estar realmente ativa no painel, ou null se está.
 * Além da própria automação, conta o bot inativo e o agendamento pausado/desativado:
 * nesses casos o backend nem cobra execução ("Inactive schedule"), então só poluem a tela.
 * Automação ativa sem agendamento continua visível (pode rodar por gatilho/manual).
 */
function getInactiveReason(item: AutomationHealthItemRead): string | null {
  if (!item.automation_active) return "Automação inativa";
  if (item.bot_active === false) return "Bot inativo";
  const schedule = item.schedule;
  if (schedule) {
    if (schedule.status === "paused") return "Agendamento pausado";
    if (!schedule.active || schedule.status === "inactive") return "Agendamento inativo";
  }
  return null;
}

function removeAutomationPrefix(value?: string | null) {
  if (!value) return EMPTY;
  return value.replace(/^automacao_/i, "").trim();
}

/**
 * Chip de tempo do card.
 * - Se atrasado: "Xm atrasado"
 * - Se ok e há próximo run em menos de 24h: "próx. em Xm"
 */
function getTimeChipInfo(item: AutomationHealthItemRead): { label: string; isOverdue: boolean } | null {
  if (item.health_status === "running") return null;

  const now = Date.now();

  if (item.is_overdue && item.last_execution_at) {
    const lastRun = new Date(item.last_execution_at).getTime();
    const intervalMs = (item.schedule?.expected_interval_seconds ?? 0) * 1000;
    const expectedNextRun = lastRun + intervalMs;
    const overdueMs = now - expectedNextRun;

    if (overdueMs > 0) {
      return { label: formatDuration(Math.floor(overdueMs / 1000)) + " atrasado", isOverdue: true };
    }

    const elapsedMs = now - lastRun;
    return { label: formatDuration(Math.floor(elapsedMs / 1000)) + " sem rodar", isOverdue: true };
  }

  if (!item.is_overdue && item.schedule?.next_run_at) {
    const nextRun = new Date(item.schedule.next_run_at).getTime();
    const diffMs = nextRun - now;
    if (diffMs > 0 && diffMs < 24 * 60 * 60 * 1000) {
      return { label: "próx. em " + formatDuration(Math.floor(diffMs / 1000)), isOverdue: false };
    }
  }

  return null;
}

type HealthVisual = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  cardClass: string;
  badgeClass: string;
  accentClass: string;
  iconClass: string;
  filterActiveClass: string;
  filterTextClass: string;
};

const HEALTH_VISUAL: Record<AutomationHealthStatus, HealthVisual> = {
  success: {
    label: "OK",
    icon: CheckCircle2,
    cardClass: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300",
    badgeClass: tone.success,
    accentClass: "bg-emerald-500",
    iconClass: "text-emerald-600",
    filterActiveClass: "border-emerald-600 bg-emerald-600 text-white",
    filterTextClass: "text-emerald-700",
  },
  running: {
    label: "Rodando",
    icon: Loader2,
    cardClass: "border-blue-200 bg-blue-50/60 hover:border-blue-300",
    badgeClass: tone.info,
    accentClass: "bg-blue-500",
    iconClass: "text-blue-600",
    filterActiveClass: "border-blue-600 bg-blue-600 text-white",
    filterTextClass: "text-blue-700",
  },
  // warning = atrasado: não rodou quando devia — âmbar, diferente do vermelho de erro de execução
  warning: {
    label: "Atrasado",
    icon: AlertTriangle,
    cardClass: "border-amber-200 bg-amber-50/60 hover:border-amber-300",
    badgeClass: tone.warning,
    accentClass: "bg-amber-500",
    iconClass: "text-amber-600",
    filterActiveClass: "border-amber-600 bg-amber-600 text-white",
    filterTextClass: "text-amber-700",
  },
  error: {
    label: "Erro",
    icon: CircleAlert,
    cardClass: "border-red-200 bg-red-50/60 hover:border-red-300",
    badgeClass: tone.danger,
    accentClass: "bg-red-500",
    iconClass: "text-red-600",
    filterActiveClass: "border-red-600 bg-red-600 text-white",
    filterTextClass: "text-red-700",
  },
};

const STATUS_ORDER: AutomationHealthStatus[] = ["success", "running", "warning", "error"];

function getHealthVisual(status: string): HealthVisual {
  return HEALTH_VISUAL[status as AutomationHealthStatus] ?? HEALTH_VISUAL.warning;
}

function getSizeClasses(size: CardSize) {
  if (size === "compact") {
    return {
      grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5",
      card: "min-h-[140px] p-3",
      title: "text-xs",
      text: "text-[10px]",
      chip: "text-[10px]",
      infoGrid: "grid-cols-2 gap-x-3 gap-y-2",
    };
  }
  return {
    grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
    card: "min-h-[170px] p-4",
    title: "text-sm",
    text: "text-xs",
    chip: "text-xs",
    infoGrid: "grid-cols-2 gap-x-4 gap-y-3",
  };
}

function getMachineLabel(item: AutomationHealthItemRead) {
  return item.machine_display_name || item.machine_label || item.machine_name || EMPTY;
}

function getAutomationTitle(item: AutomationHealthItemRead) {
  return removeAutomationPrefix(item.automation_label || item.automation_name);
}

function getTaskStatusLabel(status?: string | null) {
  if (!status) return EMPTY;
  const labels: Record<string, string> = {
    waiting: "Aguardando",
    scheduled: "Agendado",
    ready: "Pronto",
    running: "Rodando",
    stop_requested: "Parando",
    forced_stop: "Parada forçada",
    canceled: "Cancelado",
    finished: "Finalizado",
    error: "Erro",
    timeout: "Timeout",
  };
  return labels[status] ?? status;
}

function canRunNow(item: AutomationHealthItemRead) {
  return item.automation_active && item.health_status !== "running" && !item.has_running_task;
}

function InfoItem({
  icon: Icon,
  label,
  value,
  textClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  textClassName: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className={`${textClassName} font-medium uppercase tracking-wide`}>{label}</span>
      </div>
      <div className={`mt-0.5 truncate text-slate-700 ${textClassName}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function DetailField({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export function AutomationHealthPage() {
  const queryClient = useQueryClient();
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [statusFilter, setStatusFilter] = useState<AutomationHealthStatus | null>(null);
  const [search, setSearch] = useState("");
  const [cardSize, setCardSize] = useState<CardSize>(getStoredCardSize);
  const [selectedItem, setSelectedItem] = useState<AutomationHealthItemRead | null>(null);
  const [runNowItem, setRunNowItem] = useState<AutomationHealthItemRead | null>(null);

  const queryParams = useMemo(
    () => ({
      repository_id: repositoryFilter ? Number(repositoryFilter) : undefined,
      bot_id: botFilter ? Number(botFilter) : undefined,
      activeFilter,
    }),
    [repositoryFilter, botFilter, activeFilter]
  );

  const automationHealthQuery = useQuery({
    queryKey: ["automation-health", queryParams],
    queryFn: async () => {
      const { activeFilter: filter, ...base } = queryParams;
      if (filter === "active") {
        return (await listAutomationHealth({ ...base, active: true })).items;
      }
      // Omitir "active" faz o backend usar o padrão (true); para ver inativas busca os dois lados.
      const [activeItems, inactiveItems] = await Promise.all([
        listAutomationHealth({ ...base, active: true }),
        listAutomationHealth({ ...base, active: false }),
      ]);
      return [...activeItems.items, ...inactiveItems.items];
    },
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-filter-automation-health"],
    queryFn: () => listRepositories({ limit: 100 }),
  });

  const botsQuery = useQuery({
    queryKey: ["bots-filter-automation-health"],
    queryFn: () => listAllBots(),
  });

  const runNowMutation = useMutation({
    // O item do health não traz os parâmetros padrão: busca a automação para a task sair igual à da tela de Automações.
    mutationFn: async (item: AutomationHealthItemRead) => createTask(runNowPayload(await getAutomation(item.automation_id))),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["automation-health"] });
      setRunNowItem(null);
      toast.success(`Task #${data.task.id} entrou na fila.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível criar a task."));
    },
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(CARD_SCALE_STORAGE_KEY, cardSize === "compact" ? "sm" : "md");
    } catch {
      // sem localStorage (modo privado): só não persiste
    }
  }, [cardSize]);

  const repositoryOptions = useMemo<SearchableOption<number>[]>(
    () => (repositoriesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name })),
    [repositoriesQuery.data]
  );

  const botOptions = useMemo<SearchableOption<number>[]>(
    () =>
      (botsQuery.data?.items ?? [])
        .filter((bot) => (repositoryFilter ? bot.repository_id === Number(repositoryFilter) : true))
        .map((bot) => ({ value: bot.id, label: bot.name })),
    [botsQuery.data, repositoryFilter]
  );

  // Filtros de busca/ativo (antes do filtro por status, para os contadores refletirem a lista toda).
  const baseItems = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    return (automationHealthQuery.data ?? []).filter((item) => {
      const inactive = getInactiveReason(item) !== null;
      if (activeFilter === "active" && inactive) return false;
      if (activeFilter === "inactive" && !inactive) return false;
      if (!normalizedSearch) return true;
      const fields = [
        item.automation_name,
        item.automation_label,
        item.repository_name,
        item.bot_name,
        item.machine_display_name,
        item.machine_label,
        item.machine_name,
        item.schedule?.name,
        item.schedule?.rule_label,
        item.health_label,
      ];
      return fields.some((field) => normalizeText(field).includes(normalizedSearch));
    });
  }, [automationHealthQuery.data, search, activeFilter]);

  const summary = useMemo(() => {
    return baseItems.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.health_status === "success") acc.success += 1;
        else if (item.health_status === "running") acc.running += 1;
        else if (item.health_status === "error") acc.error += 1;
        else acc.warning += 1;
        return acc;
      },
      { total: 0, success: 0, running: 0, warning: 0, error: 0 }
    );
  }, [baseItems]);

  // Ordena: erro → atrasado → rodando → ok
  const sortedItems = useMemo(() => {
    const order: Record<string, number> = { error: 0, warning: 1, running: 2, success: 3 };
    const filtered = statusFilter ? baseItems.filter((item) => item.health_status === statusFilter) : baseItems;
    return [...filtered].sort((a, b) => (order[a.health_status] ?? 9) - (order[b.health_status] ?? 9));
  }, [baseItems, statusFilter]);

  const sizeClasses = getSizeClasses(cardSize);
  const hasActiveFilters = Boolean(search.trim() || repositoryFilter || botFilter || activeFilter !== "active" || statusFilter);

  function clearFilters() {
    setSearch("");
    setRepositoryFilter("");
    setBotFilter("");
    setActiveFilter("active");
    setStatusFilter(null);
  }

  function toggleStatusFilter(status: AutomationHealthStatus) {
    setStatusFilter((prev) => (prev === status ? null : status));
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Saúde das automações"
          description="Verde = ok e dentro do prazo · Âmbar = atrasado, não rodou no tempo esperado · Vermelho = última execução deu erro."
          actions={
            <>
              <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="Tamanho dos cards">
                {(["compact", "normal"] as CardSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCardSize(size)}
                    aria-pressed={cardSize === size}
                    className={cn(
                      "h-10 px-3 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
                      cardSize === size ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {size === "compact" ? "Compacto" : "Normal"}
                  </button>
                ))}
              </div>
              <RefreshIndicator
                updatedAt={automationHealthQuery.dataUpdatedAt}
                isFetching={automationHealthQuery.isFetching}
                onRefresh={() => automationHealthQuery.refetch()}
                intervalMs={REFRESH_MS}
              />
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar automação, bot, máquina..." />

          <SearchableSelect
            className="w-full sm:w-56"
            value={repositoryFilter ? Number(repositoryFilter) : ""}
            onChange={(value) => {
              setRepositoryFilter(value === "" ? "" : String(value));
              setBotFilter("");
            }}
            options={repositoryOptions}
            emptyLabel="Todos os repositórios"
            searchPlaceholder="Buscar repositório..."
            loading={repositoriesQuery.isLoading}
          />

          <SearchableSelect
            className="w-full sm:w-56"
            value={botFilter ? Number(botFilter) : ""}
            onChange={(value) => setBotFilter(value === "" ? "" : String(value))}
            options={botOptions}
            emptyLabel="Todos os bots"
            searchPlaceholder="Buscar bot..."
            loading={botsQuery.isLoading}
          />

          <SearchableSelect
            className="w-full sm:w-44"
            value={activeFilter}
            onChange={(value) => setActiveFilter(value || "active")}
            options={ACTIVE_FILTER_OPTIONS}
            searchPlaceholder="Buscar..."
          />

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por status">
            {STATUS_ORDER.map((status) => {
              const visual = HEALTH_VISUAL[status];
              const Icon = visual.icon;
              const active = statusFilter === status;
              const count = summary[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatusFilter(status)}
                  aria-pressed={active}
                  title={active ? `Mostrando só "${visual.label}" (clique para limpar)` : `Mostrar só "${visual.label}"`}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition",
                    focusRing,
                    active ? visual.filterActiveClass : `border-slate-300 bg-white hover:bg-slate-50 ${visual.filterTextClass}`
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {visual.label}
                  <span className="tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </FilterBar>

        <div className="p-5">
          {automationHealthQuery.isLoading ? (
            <CardSkeleton count={8} />
          ) : automationHealthQuery.isError ? (
            <QueryError
              error={automationHealthQuery.error}
              what="a saúde das automações"
              onRetry={() => automationHealthQuery.refetch()}
              retrying={automationHealthQuery.isFetching}
            />
          ) : sortedItems.length === 0 ? (
            <EmptyState
              icon={HeartPulse}
              title="Nenhuma automação encontrada"
              description={hasActiveFilters ? "Nenhuma automação combina com os filtros." : "Cadastre uma automação para acompanhar a saúde dela aqui."}
              action={
                hasActiveFilters ? (
                  <button type="button" className={btn.secondary} onClick={clearFilters}>
                    Limpar filtros
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className={`grid gap-4 ${sizeClasses.grid}`}>
              {sortedItems.map((item) => {
                const visual = getHealthVisual(item.health_status);
                const StatusIcon = visual.icon;
                const timeChip = getTimeChipInfo(item);
                const inactiveReason = getInactiveReason(item);
                const showRunNow = canRunNow(item);

                return (
                  <div
                    key={item.automation_id}
                    className={cn("group relative flex flex-col overflow-hidden rounded-xl border shadow-sm transition", visual.cardClass)}
                  >
                    <div className={`absolute left-0 top-0 h-full w-1 ${visual.accentClass}`} />

                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className={cn("flex w-full flex-1 flex-col rounded-xl text-left", focusRing, sizeClasses.card)}
                    >
                      <div className="flex items-start justify-between gap-3 pl-2">
                        <div className="min-w-0">
                          <p className={`line-clamp-2 break-words font-semibold text-slate-950 ${sizeClasses.title}`} title={getAutomationTitle(item)}>
                            {getAutomationTitle(item)}
                          </p>
                          <p className={`mt-0.5 line-clamp-1 text-slate-500 ${sizeClasses.text}`}>{item.bot_name || EMPTY}</p>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className={cn(badge, visual.badgeClass, sizeClasses.chip)}>
                            <StatusIcon className={cn("h-3.5 w-3.5", visual.iconClass, item.health_status === "running" && "animate-spin")} />
                            {visual.label}
                          </span>

                          {inactiveReason ? <span className={cn(badge, tone.neutral, sizeClasses.chip)}>{inactiveReason}</span> : null}

                          {timeChip && (
                            <span className={cn(badge, timeChip.isOverdue ? tone.warning : visual.badgeClass, sizeClasses.chip)}>
                              <Timer className="h-3 w-3 shrink-0" />
                              {timeChip.label}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className={`mt-3 grid pl-2 ${sizeClasses.infoGrid}`}>
                        <InfoItem icon={Activity} label="Regra" value={formatRelativeRule(item.schedule?.rule_label)} textClassName={sizeClasses.text} />
                        <InfoItem icon={Monitor} label="Máquina" value={getMachineLabel(item)} textClassName={sizeClasses.text} />
                        <InfoItem icon={Clock3} label="Última execução" value={formatDateTime(item.last_execution_at)} textClassName={sizeClasses.text} />
                        <InfoItem icon={Bot} label="Repositório" value={item.repository_name || EMPTY} textClassName={sizeClasses.text} />
                      </div>
                    </button>

                    {showRunNow && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRunNowItem(item);
                        }}
                        title="Executar agora"
                        aria-label={`Executar agora: ${getAutomationTitle(item)}`}
                        className={cn(
                          "absolute bottom-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-500 opacity-0 shadow-sm transition hover:bg-blue-600 hover:text-white group-hover:opacity-100 focus-visible:opacity-100",
                          focusRing
                        )}
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(runNowItem)}
        title="Executar agora"
        description={
          runNowItem
            ? `Automação: ${getAutomationTitle(runNowItem)}\n\nUma task manual entra na fila com os parâmetros padrão da automação.`
            : ""
        }
        confirmLabel="Executar"
        isPending={runNowMutation.isPending}
        onCancel={() => setRunNowItem(null)}
        onConfirm={() => runNowItem && runNowMutation.mutate(runNowItem)}
      />

      {selectedItem ? <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} /> : null}
    </div>
  );
}

function DetailModal({ item, onClose }: { item: AutomationHealthItemRead; onClose: () => void }) {
  const visual = getHealthVisual(item.health_status);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={cn(card, "relative max-h-[90vh] w-full max-w-5xl overflow-hidden shadow-2xl")}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-950">{getAutomationTitle(item)}</h2>
              <span className={cn(badge, visual.badgeClass)}>
                <Icon className={cn("h-3.5 w-3.5", visual.iconClass)} />
                {visual.label}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">Detalhes da automação, bot, agendamento e última task monitorada.</p>
          </div>

          <button type="button" onClick={onClose} className={btn.icon} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-81px)] overflow-y-auto px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={cn(card, "p-4")}>
              <h3 className="text-sm font-semibold text-slate-950">Automação</h3>
              <dl className="mt-4 space-y-3">
                <DetailField label="Nome" value={removeAutomationPrefix(item.automation_name)} />
                <DetailField label="Label" value={removeAutomationPrefix(item.automation_label)} />
                <DetailField label="Repositório" value={item.repository_name || EMPTY} />
                <DetailField label="Status" value={item.health_label} />
                <DetailField label="Ativa" value={item.automation_active ? "Sim" : "Não"} />
              </dl>
            </div>

            <div className={cn(card, "p-4")}>
              <h3 className="text-sm font-semibold text-slate-950">Bot</h3>
              <dl className="mt-4 space-y-3">
                <DetailField label="Nome do bot" value={item.bot_name || EMPTY} />
                <DetailField label="Bot ativo" value={item.bot_active == null ? EMPTY : item.bot_active ? "Sim" : "Não"} />
                <DetailField label="Máquina" value={getMachineLabel(item)} />
                <DetailField label="Monitorado em" value={formatDateTime(item.monitored_at)} />
              </dl>
            </div>

            <div className={cn(card, "p-4")}>
              <h3 className="text-sm font-semibold text-slate-950">Regra de saúde</h3>
              <dl className="mt-4 space-y-3">
                <DetailField label="Agendamento" value={item.schedule?.name || EMPTY} />
                <DetailField label="Regra" value={item.schedule?.rule_label || "Manual (sem agendamento)"} />
                <DetailField label="Intervalo esperado" value={formatDuration(item.schedule?.expected_interval_seconds)} />
                <DetailField
                  label="Atrasado?"
                  value={
                    <span className={item.is_overdue ? "font-semibold text-amber-600" : "font-semibold text-emerald-600"}>
                      {item.is_overdue ? "Sim — não rodou no tempo esperado" : "Não"}
                    </span>
                  }
                />
                <DetailField label="Próxima execução" value={formatDateTime(item.schedule?.next_run_at)} />
              </dl>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className={cn(card, "p-4")}>
              <h3 className="text-sm font-semibold text-slate-950">Detalhes do agendamento</h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailField label="Tipo" value={item.schedule?.schedule_type || EMPTY} />
                <DetailField label="Tipo de calendário" value={item.schedule?.calendar_type || EMPTY} />
                <DetailField label="Cron" value={item.schedule?.cron_expression || EMPTY} />
                <DetailField label="Fuso horário" value={item.schedule?.timezone || EMPTY} />
                <DetailField label="Intervalo" value={`${item.schedule?.interval_value ?? EMPTY} ${item.schedule?.interval_unit || ""}`.trim()} />
                <DetailField label="Última execução" value={formatDateTime(item.schedule?.last_run_at)} />
              </dl>
            </div>

            <div className={cn(card, "p-4")}>
              <h3 className="text-sm font-semibold text-slate-950">Última task</h3>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailField label="Task" value={item.last_task?.id != null ? `#${item.last_task.id}` : EMPTY} />
                <DetailField
                  label="Status da task"
                  value={
                    <span
                      className={cn(
                        "font-semibold",
                        item.last_task?.status === "error" ? "text-red-600" : item.last_task?.status === "finished" ? "text-emerald-600" : "text-slate-900"
                      )}
                    >
                      {getTaskStatusLabel(item.last_task?.status)}
                    </span>
                  }
                />
                <DetailField
                  label="Runner"
                  value={item.last_task?.runner_display_name || item.last_task?.runner_label || item.last_task?.runner_name || EMPTY}
                />
                <DetailField label="Duração" value={formatDuration(item.last_task?.execution_duration_seconds)} />
                <DetailField label="Iniciado em" value={formatDateTime(item.last_task?.started_at)} />
                <DetailField label="Finalizado em" value={formatDateTime(item.last_task?.finished_at)} />
                <DetailField
                  className="sm:col-span-2"
                  label="Mensagem final"
                  value={
                    <pre className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-sm font-medium text-slate-900">
                      {item.last_task?.final_message || EMPTY}
                    </pre>
                  }
                />
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
