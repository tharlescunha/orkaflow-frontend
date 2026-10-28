import { useEffect, useMemo, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FolderGit2,
  HeartPulse,
  Loader2,
  Maximize2,
  Minimize2,
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
import { CredentialAlertStrip } from "@/components/common/credential-status";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { HealthCardSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { normalizeSearch } from "@/lib/search";
import { getApiErrorMessage } from "@/lib/api-error";
import { runNowPayload } from "@/lib/run-task";
import { EMPTY, formatDateTime, formatDuration } from "@/lib/format";
import { toast } from "@/store/toast-store";
import { getAutomation } from "@/services/api/automations";
import { listAllBots } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { createTask } from "@/services/api/tasks";
import type { TaskStatus } from "@/services/api/tasks";
import { listAutomationHealth, type AutomationHealthItemRead, type AutomationHealthStatus } from "@/services/api/automation-health";
import { badge, btn, card, focusRing, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

type ActiveFilter = "active" | "inactive" | "all";

const ACTIVE_FILTER_OPTIONS: SearchableOption<ActiveFilter>[] = [
  { value: "active", label: "Somente ativas" },
  { value: "inactive", label: "Somente inativas" },
  { value: "all", label: "Todas" },
];

/** Como a tela é vista: compacto e normal mudam o tamanho dos cards; foco tira tudo que não é card (telão). */
type ViewMode = "compact" | "normal" | "focus";
type CardSize = "compact" | "normal";

const VIEW_MODES: { value: ViewMode; label: string; description: string }[] = [
  { value: "compact", label: "Compacto", description: "Cards menores, mais automações por linha." },
  { value: "normal", label: "Normal", description: "Cards maiores, com mais espaço para ler." },
  { value: "focus", label: "Foco", description: "Só os cards, sem filtros nem botões. Para deixar num telão. Esc sai." },
];

const REFRESH_MS = 10_000;
// Mesma chave de antes; "sm" = compacto, "focus" = foco, qualquer outro = normal (compatível com o valor antigo sm/md/lg).
const VIEW_STORAGE_KEY = "automation-health-card-scale";

function getStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "normal";
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "sm") return "compact";
    if (stored === "focus") return "focus";
    return "normal";
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
  bandClass: string;
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
    bandClass: "from-emerald-50 to-white border-emerald-200",
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
    bandClass: "from-blue-50 to-white border-blue-200",
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
    bandClass: "from-amber-50 to-white border-amber-200",
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
    bandClass: "from-red-50 to-white border-red-200",
  },
};

const STATUS_ORDER: AutomationHealthStatus[] = ["success", "running", "warning", "error"];

function getHealthVisual(status: string): HealthVisual {
  return HEALTH_VISUAL[status as AutomationHealthStatus] ?? HEALTH_VISUAL.warning;
}

function getSizeClasses(size: CardSize, focus: boolean) {
  if (size === "compact") {
    return {
      grid: focus ? "grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5",
      card: "min-h-[140px] p-3",
      title: "text-xs",
      text: "text-[10px]",
      chip: "text-[10px]",
      infoGrid: "grid-cols-2 gap-x-3 gap-y-2",
    };
  }
  return {
    grid: focus ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
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

const TASK_STATUSES: TaskStatus[] = [
  "waiting",
  "scheduled",
  "ready",
  "running",
  "stop_requested",
  "forced_stop",
  "canceled",
  "finished",
  "error",
  "timeout",
];

function isTaskStatus(status?: string | null): status is TaskStatus {
  return typeof status === "string" && (TASK_STATUSES as string[]).includes(status);
}

function canRunNow(item: AutomationHealthItemRead) {
  return item.automation_active && item.health_status !== "running" && !item.has_running_task;
}

function formatScheduleType(schedule: AutomationHealthItemRead["schedule"]) {
  if (!schedule) return "Manual (sem agendamento)";
  if (schedule.schedule_type === "cron") return "Cron";
  const units: Record<string, string> = {
    once: "Uma vez",
    second: "A cada N segundos",
    minute: "A cada N minutos",
    hour: "A cada N horas",
    day: "Diário",
    week: "Semanal",
    month: "Mensal",
  };
  return units[schedule.calendar_type ?? ""] ?? "Calendário";
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

export function AutomationHealthPage() {
  const queryClient = useQueryClient();
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [statusFilter, setStatusFilter] = useState<AutomationHealthStatus | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(getStoredViewMode);
  // Tamanho dos cards no foco: o último escolhido entre compacto/normal (foco não muda o tamanho).
  const [cardSize, setCardSize] = useState<CardSize>(() => (getStoredViewMode() === "compact" ? "compact" : "normal"));
  const [selectedItem, setSelectedItem] = useState<AutomationHealthItemRead | null>(null);
  const [runNowItem, setRunNowItem] = useState<AutomationHealthItemRead | null>(null);

  const focus = viewMode === "focus";

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
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode === "compact" ? "sm" : viewMode === "focus" ? "focus" : "md");
    } catch {
      // sem localStorage (modo privado): só não persiste
    }
  }, [viewMode]);

  // Esc sai do foco (quando não há modal aberto, que já usa o Esc para fechar).
  useEffect(() => {
    if (!focus) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !selectedItem && !runNowItem) setViewMode(cardSize);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focus, selectedItem, runNowItem, cardSize]);

  function chooseView(mode: ViewMode) {
    if (mode !== "focus") setCardSize(mode);
    setViewMode(mode);
  }

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

  const sizeClasses = getSizeClasses(cardSize, focus);
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

  const viewSwitch = (
    <div className="flex flex-col items-end gap-1">
      <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="Modo de visualização">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => chooseView(mode.value)}
            aria-pressed={viewMode === mode.value}
            title={mode.description}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
              viewMode === mode.value ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {mode.value === "focus" ? <Maximize2 className="h-3.5 w-3.5" /> : null}
            {mode.label}
          </button>
        ))}
      </div>
      <p className="hidden text-[11px] text-slate-500 md:block">{VIEW_MODES.find((m) => m.value === viewMode)?.description}</p>
    </div>
  );

  const grid = automationHealthQuery.isLoading ? (
    <HealthCardSkeleton count={10} gridClassName={sizeClasses.grid} />
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
        const showRunNow = !focus && canRunNow(item);

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

              {item.credential_alerts && item.credential_alerts.length > 0 && (
                <div className="mt-3 pl-2">
                  <CredentialAlertStrip alerts={item.credential_alerts} compact />
                </div>
              )}

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
  );

  return (
    <div className="space-y-5">
      {focus ? (
        // Telão: só os cards. Uma barrinha discreta para sair e saber se está atualizando.
        <section className="space-y-3">
          <div className="flex items-center justify-end gap-3 px-1">
            <span className="text-[11px] text-slate-400">
              {summary.total} automações{statusFilter ? ` · só ${HEALTH_VISUAL[statusFilter].label.toLowerCase()}` : ""}
            </span>
            <RefreshIndicator
              updatedAt={automationHealthQuery.dataUpdatedAt}
              isFetching={automationHealthQuery.isFetching}
              onRefresh={() => automationHealthQuery.refetch()}
              intervalMs={REFRESH_MS}
            />
            <button
              type="button"
              onClick={() => setViewMode(cardSize)}
              title="Sair do modo foco (Esc)"
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50", focusRing)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
              Sair do foco
            </button>
          </div>
          {grid}
        </section>
      ) : (
        <section className={card}>
          <PageHeader
            title="Saúde das automações"
            actions={
              <>
                {viewSwitch}
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

          <div className="p-5">{grid}</div>
        </section>
      )}

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

      {selectedItem ? (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRunNow={
            canRunNow(selectedItem)
              ? () => {
                  setRunNowItem(selectedItem);
                  setSelectedItem(null);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}

/** Detalhe do card: o que importa primeiro (status, quando rodou, quando roda de novo), depois agendamento e última task. */
function DetailModal({ item, onClose, onRunNow }: { item: AutomationHealthItemRead; onClose: () => void; onRunNow?: () => void }) {
  const navigate = useNavigate();
  const visual = getHealthVisual(item.health_status);
  const Icon = visual.icon;
  const timeChip = getTimeChipInfo(item);
  const inactiveReason = getInactiveReason(item);
  const lastTask = item.last_task;
  const schedule = item.schedule;

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

  function go(path: string) {
    onClose();
    navigate(path);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={cn(card, "relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden shadow-2xl")}>
        {/* Faixa do status */}
        <div className={cn("border-b bg-gradient-to-r px-6 py-5", visual.bandClass)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(badge, visual.badgeClass)}>
                  <Icon className={cn("h-3.5 w-3.5", visual.iconClass, item.health_status === "running" && "animate-spin")} />
                  {visual.label}
                </span>
                {inactiveReason ? <span className={cn(badge, tone.neutral)}>{inactiveReason}</span> : null}
                {timeChip ? (
                  <span className={cn(badge, timeChip.isOverdue ? tone.warning : visual.badgeClass)}>
                    <Timer className="h-3 w-3" />
                    {timeChip.label}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 truncate text-xl font-semibold text-slate-950" title={getAutomationTitle(item)}>
                {getAutomationTitle(item)}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-slate-400" />
                  {item.bot_name || EMPTY}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <FolderGit2 className="h-4 w-4 text-slate-400" />
                  {item.repository_name || EMPTY}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Monitor className="h-4 w-4 text-slate-400" />
                  {getMachineLabel(item)}
                </span>
              </p>
            </div>
            <button type="button" onClick={onClose} className={btn.icon} aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>

          {item.credential_alerts && item.credential_alerts.length > 0 ? (
            <div className="mt-4">
              <CredentialAlertStrip alerts={item.credential_alerts} />
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {/* O que se procura primeiro */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact icon={Clock3} label="Última execução" value={formatDateTime(item.last_execution_at)} hint={lastTask?.id != null ? `Task #${lastTask.id}` : undefined} />
            <Fact
              icon={CalendarClock}
              label="Próxima execução"
              value={schedule?.next_run_at ? formatDateTime(schedule.next_run_at) : "Só manual"}
              hint={schedule ? formatRelativeRule(schedule.rule_label) : "Sem agendamento"}
            />
            <Fact
              icon={Activity}
              label="Situação"
              value={visual.label}
              hint={item.is_overdue ? "Não rodou no tempo esperado" : `Monitorado em ${formatDateTime(item.monitored_at)}`}
              valueClassName={item.is_overdue ? "text-amber-700" : item.health_status === "error" ? "text-red-700" : undefined}
            />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Section title="Agendamento">
              {schedule ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DetailField label="Nome" value={schedule.name} className="col-span-2" />
                  <DetailField label="Tipo" value={formatScheduleType(schedule)} />
                  <DetailField label="Regra" value={schedule.rule_label || EMPTY} />
                  {schedule.schedule_type === "cron" ? (
                    <DetailField label="Cron" value={<span className="font-mono text-xs">{schedule.cron_expression || EMPTY}</span>} />
                  ) : (
                    <DetailField label="Intervalo" value={`${schedule.interval_value ?? EMPTY} ${schedule.interval_unit || ""}`.trim()} />
                  )}
                  <DetailField label="Fuso horário" value={schedule.timezone || EMPTY} />
                  <DetailField label="Intervalo esperado" value={formatDuration(schedule.expected_interval_seconds)} />
                  <DetailField
                    label="Situação"
                    value={
                      <span className={cn(badge, schedule.status === "paused" ? tone.warning : schedule.active ? tone.success : tone.neutral)}>
                        {schedule.status === "paused" ? "Pausado" : schedule.active ? "Ativo" : "Inativo"}
                      </span>
                    }
                  />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">Sem agendamento: esta automação roda por gatilho ou à mão.</p>
              )}
            </Section>

            <Section title="Última task">
              {lastTask?.id != null ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DetailField
                    label="Task"
                    value={
                      <button type="button" className="font-medium text-blue-600 hover:underline" onClick={() => go(`/tasks/${lastTask.id}`)}>
                        #{lastTask.id}
                      </button>
                    }
                  />
                  <DetailField label="Status" value={isTaskStatus(lastTask.status) ? <StatusBadge status={lastTask.status} /> : lastTask.status || EMPTY} />
                  <DetailField label="Início" value={formatDateTime(lastTask.started_at)} />
                  <DetailField label="Fim" value={formatDateTime(lastTask.finished_at)} />
                  <DetailField label="Duração" value={formatDuration(lastTask.execution_duration_seconds)} />
                  <DetailField label="Máquina" value={lastTask.runner_display_name || lastTask.runner_label || lastTask.runner_name || EMPTY} />
                  <DetailField
                    label="Mensagem final"
                    className="col-span-2"
                    value={
                      <pre
                        className={cn(
                          "mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-sans text-sm",
                          lastTask.status === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50 text-slate-800"
                        )}
                      >
                        {lastTask.final_message || EMPTY}
                      </pre>
                    }
                  />
                </dl>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma task registrada ainda.</p>
              )}
            </Section>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn.secondary} onClick={() => go(`/automations/${item.automation_id}`)}>
              <ExternalLink className="h-4 w-4" />
              Abrir automação
            </button>
            {lastTask?.id != null ? (
              <button type="button" className={btn.secondary} onClick={() => go(`/tasks/${lastTask.id}`)}>
                <ExternalLink className="h-4 w-4" />
                Ver última task
              </button>
            ) : null}
          </div>
          {onRunNow ? (
            <button type="button" className={btn.primary} onClick={onRunNow}>
              <Play className="h-4 w-4" />
              Executar agora
            </button>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  hint,
  valueClassName,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className={cn("mt-1 truncate text-base font-semibold text-slate-900", valueClassName)} title={value}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200">
      <h3 className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailField({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">{value}</dd>
    </div>
  );
}
