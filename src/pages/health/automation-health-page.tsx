import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  Monitor,
  RefreshCcw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  Activity,
  CircleAlert,
  Timer,
} from "lucide-react";

import { listBots } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import {
  listAutomationHealth,
  type AutomationHealthItemRead,
} from "@/services/api/automation-health";

type ActiveFilter = "true" | "false" | "all";
type CardScale = "sm" | "md" | "lg";

const AUTO_REFRESH_SECONDS = 10;
const CARD_SCALE_STORAGE_KEY = "automation-health-card-scale";

function formatDateTime(value?: string | null) {
  if (!value) return "---";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatRelativeRule(value?: string | null) {
  if (!value) return "---";
  return value;
}

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "---";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function normalizeText(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function removeAutomationPrefix(value?: string | null) {
  if (!value) return "---";
  return value.replace(/^automacao_/i, "").trim();
}

function getStoredCardScale(): CardScale {
  if (typeof window === "undefined") return "md";
  const storedValue = window.localStorage.getItem(CARD_SCALE_STORAGE_KEY);
  if (storedValue === "sm" || storedValue === "md" || storedValue === "lg") return storedValue;
  return "md";
}

/**
 * Calcula chip de tempo para exibir no card.
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

function getHealthVisual(status: string) {
  switch (status) {
    case "success":
      return {
        label: "OK",
        icon: CheckCircle2,
        cardClass: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300",
        badgeClass: "border border-emerald-200 bg-emerald-100 text-emerald-700",
        accentClass: "bg-emerald-500",
        iconClass: "text-emerald-600",
        timeChipClass: "bg-emerald-100 text-emerald-700 border border-emerald-200",
      };

    case "running":
      return {
        label: "Rodando",
        icon: Loader2,
        cardClass: "border-blue-200 bg-blue-50/80 hover:border-blue-300",
        badgeClass: "border border-blue-200 bg-blue-100 text-blue-700",
        accentClass: "bg-blue-500",
        iconClass: "text-blue-600",
        timeChipClass: "bg-blue-100 text-blue-700 border border-blue-200",
      };

    case "error":
      return {
        label: "Erro",
        icon: CircleAlert,
        cardClass: "border-red-200 bg-red-50/80 hover:border-red-300",
        badgeClass: "border border-red-200 bg-red-100 text-red-700",
        accentClass: "bg-red-500",
        iconClass: "text-red-600",
        timeChipClass: "bg-red-100 text-red-700 border border-red-200",
      };

    default:
      // warning = atrasado: não rodou quando devia — âmbar, diferente do vermelho de erro de execução
      return {
        label: "Atrasado",
        icon: AlertTriangle,
        cardClass: "border-amber-200 bg-amber-50/80 hover:border-amber-300",
        badgeClass: "border border-amber-200 bg-amber-100 text-amber-700",
        accentClass: "bg-amber-500",
        iconClass: "text-amber-600",
        timeChipClass: "bg-amber-100 text-amber-800 border border-amber-300",
      };
  }
}

function getScaleClasses(scale: CardScale) {
  switch (scale) {
    case "sm":
      return {
        grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5",
        card: "min-h-[150px] p-3",
        title: "text-[12px]",
        text: "text-[10px]",
        chip: "text-[10px]",
        infoGrid: "grid-cols-2 gap-x-3 gap-y-2",
      };
    case "lg":
      return {
        grid: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
        card: "min-h-[185px] p-4",
        title: "text-[14px]",
        text: "text-xs",
        chip: "text-xs",
        infoGrid: "grid-cols-2 gap-x-4 gap-y-3",
      };
    default:
      return {
        grid: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
        card: "min-h-[165px] p-3.5",
        title: "text-[13px]",
        text: "text-[11px]",
        chip: "text-[11px]",
        infoGrid: "grid-cols-2 gap-x-3 gap-y-2.5",
      };
  }
}

function getMachineLabel(item: AutomationHealthItemRead) {
  return item.machine_display_name || item.machine_label || item.machine_name || "---";
}

function getAutomationTitle(item: AutomationHealthItemRead) {
  return removeAutomationPrefix(item.automation_label || item.automation_name);
}

function getTaskStatusLabel(status?: string | null) {
  if (!status) return "---";
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

function InfoItem({
  icon: Icon,
  label,
  value,
  textClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
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
      <div className={`mt-0.5 truncate text-slate-700 ${textClassName}`}>{value}</div>
    </div>
  );
}

export function AutomationHealthPage() {
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
  const [search, setSearch] = useState("");
  const [cardScale, setCardScale] = useState<CardScale>(getStoredCardScale);
  const [selectedItem, setSelectedItem] = useState<AutomationHealthItemRead | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(AUTO_REFRESH_SECONDS);
  const [, setTick] = useState(0);

  const queryParams = useMemo(() => ({
    repository_id: repositoryFilter ? Number(repositoryFilter) : undefined,
    bot_id: botFilter ? Number(botFilter) : undefined,
    active: activeFilter === "all" ? undefined : activeFilter === "true" ? true : false,
  }), [repositoryFilter, botFilter, activeFilter]);

  const automationHealthQuery = useQuery({
    queryKey: ["automation-health", queryParams],
    queryFn: () => listAutomationHealth(queryParams),
    refetchInterval: AUTO_REFRESH_SECONDS * 1000,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-filter-automation-health"],
    queryFn: () => listRepositories({ limit: 100 }),
  });

  const botsQuery = useQuery({
    queryKey: ["bots-filter-automation-health"],
    queryFn: () => listBots({ limit: 200 }),
  });

  useEffect(() => {
    window.localStorage.setItem(CARD_SCALE_STORAGE_KEY, cardScale);
  }, [cardScale]);

  useEffect(() => {
    setRefreshCountdown(AUTO_REFRESH_SECONDS);
  }, [queryParams]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) return AUTO_REFRESH_SECONDS;
        return prev - 1;
      });
      // re-render para atualizar chips de tempo a cada segundo
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const repositories = repositoriesQuery.data ?? [];
  const bots = botsQuery.data?.items ?? [];
  const rawItems = automationHealthQuery.data?.items ?? [];

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    return rawItems.filter((item) => {
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
  }, [rawItems, search]);

  // Ordena: erro → atrasado → rodando → ok
  const sortedItems = useMemo(() => {
    const order: Record<string, number> = { error: 0, warning: 1, running: 2, success: 3 };
    return [...filteredItems].sort(
      (a, b) => (order[a.health_status] ?? 9) - (order[b.health_status] ?? 9)
    );
  }, [filteredItems]);

  const summary = useMemo(() => {
    return filteredItems.reduce(
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
  }, [filteredItems]);

  const scaleClasses = getScaleClasses(cardScale);

  function handleRefresh() {
    setRefreshCountdown(AUTO_REFRESH_SECONDS);
    automationHealthQuery.refetch();
  }

  function handleDecreaseZoom() {
    setCardScale((prev) => {
      if (prev === "lg") return "md";
      if (prev === "md") return "sm";
      return "sm";
    });
  }

  function handleIncreaseZoom() {
    setCardScale((prev) => {
      if (prev === "sm") return "md";
      if (prev === "md") return "lg";
      return "lg";
    });
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Automation Health</h1>
              <p className="mt-1 text-sm text-slate-500">
                Verde = ok e dentro do prazo · Âmbar = atrasado, não rodou no tempo esperado · Vermelho = última execução deu erro
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-3 text-sm text-slate-700">
                <Clock3 className="h-4 w-4 text-slate-500" />
                Refresh in <span className="font-semibold">{refreshCountdown}s</span>
              </div>

              <div className="inline-flex items-center border border-slate-300 bg-white">
                <button
                  type="button"
                  onClick={handleDecreaseZoom}
                  className="inline-flex h-10 w-10 items-center justify-center text-slate-700 transition hover:bg-slate-50"
                  title="Diminuir cards"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <div className="flex h-10 min-w-[44px] items-center justify-center border-x border-slate-300 px-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {cardScale}
                </div>
                <button
                  type="button"
                  onClick={handleIncreaseZoom}
                  className="inline-flex h-10 w-10 items-center justify-center text-slate-700 transition hover:bg-slate-50"
                  title="Aumentar cards"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
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

        <div className="border-b border-slate-200 px-6 py-4">
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-5">
            <label className="flex h-10 items-center gap-2 border border-slate-300 bg-white px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar automação, bot, máquina..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </label>

            <select
              value={repositoryFilter}
              onChange={(e) => { setRepositoryFilter(e.target.value); setBotFilter(""); }}
              className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="">Todos os repositórios</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="">Todos os bots</option>
              {bots
                .filter((bot) => repositoryFilter ? bot.repository_id === Number(repositoryFilter) : true)
                .map((bot) => (
                  <option key={bot.id} value={bot.id}>{bot.name}</option>
                ))}
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="true">Somente ativas</option>
              <option value="false">Somente inativas</option>
              <option value="all">Todas ativo/inativo</option>
            </select>

            <div className="grid grid-cols-4 overflow-hidden border border-slate-200 bg-slate-50">
              <div className="flex h-10 items-center justify-center gap-1.5 border-r border-slate-200 px-2 text-xs font-semibold text-emerald-700" title="OK">
                <CheckCircle2 className="h-4 w-4" />
                {summary.success}
              </div>
              <div className="flex h-10 items-center justify-center gap-1.5 border-r border-slate-200 px-2 text-xs font-semibold text-blue-700" title="Rodando">
                <Loader2 className="h-4 w-4" />
                {summary.running}
              </div>
              <div className="flex h-10 items-center justify-center gap-1.5 border-r border-slate-200 px-2 text-xs font-semibold text-amber-700" title="Atrasado">
                <AlertTriangle className="h-4 w-4" />
                {summary.warning}
              </div>
              <div className="flex h-10 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-red-700" title="Erro de execução">
                <CircleAlert className="h-4 w-4" />
                {summary.error}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          {automationHealthQuery.isLoading ? (
            <div className="py-10 text-sm text-slate-500">Carregando saúde das automações...</div>
          ) : automationHealthQuery.isError ? (
            <div className="py-10 text-sm text-red-600">Não foi possível carregar a saúde das automações.</div>
          ) : sortedItems.length === 0 ? (
            <div className="py-10 text-sm text-slate-500">Nenhuma automação encontrada.</div>
          ) : (
            <div className={`grid gap-4 ${scaleClasses.grid}`}>
              {sortedItems.map((item) => {
                const visual = getHealthVisual(item.health_status);
                const StatusIcon = visual.icon;
                const timeChip = getTimeChipInfo(item);

                return (
                  <button
                    key={item.automation_id}
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className={`group relative flex w-full flex-col overflow-hidden border text-left shadow-sm transition ${visual.cardClass} ${scaleClasses.card}`}
                  >
                    <div className={`absolute left-0 top-0 h-full w-1 ${visual.accentClass}`} />

                    <div className="flex items-start justify-between gap-3 pl-2">
                      <div className="min-w-0">
                        <p className={`line-clamp-2 font-semibold text-slate-950 ${scaleClasses.title}`}>
                          {getAutomationTitle(item)}
                        </p>
                        <p className={`mt-0.5 line-clamp-1 text-slate-500 ${scaleClasses.text}`}>
                          {item.bot_name || "---"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 font-medium ${visual.badgeClass} ${scaleClasses.chip}`}>
                          <StatusIcon
                            className={`h-3.5 w-3.5 ${visual.iconClass} ${
                              item.health_status === "running" ? "animate-spin" : ""
                            }`}
                          />
                          {visual.label}
                        </span>

                        {timeChip && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 font-medium ${visual.timeChipClass} ${scaleClasses.chip}`}>
                            <Timer className="h-3 w-3 shrink-0" />
                            {timeChip.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`mt-3 grid pl-2 ${scaleClasses.infoGrid}`}>
                      <InfoItem
                        icon={Activity}
                        label="Rule"
                        value={formatRelativeRule(item.schedule?.rule_label)}
                        textClassName={scaleClasses.text}
                      />
                      <InfoItem
                        icon={Monitor}
                        label="Machine"
                        value={getMachineLabel(item)}
                        textClassName={scaleClasses.text}
                      />
                      <InfoItem
                        icon={Clock3}
                        label="Último run"
                        value={formatDateTime(item.last_execution_at)}
                        textClassName={scaleClasses.text}
                      />
                      <InfoItem
                        icon={Bot}
                        label="Repository"
                        value={item.repository_name || "---"}
                        textClassName={scaleClasses.text}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-slate-950">
                    {getAutomationTitle(selectedItem)}
                  </h2>
                  {(() => {
                    const v = getHealthVisual(selectedItem.health_status);
                    const Icon = v.icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${v.badgeClass}`}>
                        <Icon className={`h-3.5 w-3.5 ${v.iconClass}`} />
                        {v.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Detalhes da automação, bot, schedule e última task monitorada.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="inline-flex h-10 w-10 items-center justify-center border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-81px)] overflow-y-auto px-6 py-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-950">Automação</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Nome</dt>
                      <dd className="font-medium text-slate-900">{removeAutomationPrefix(selectedItem.automation_name)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Label</dt>
                      <dd className="font-medium text-slate-900">{removeAutomationPrefix(selectedItem.automation_label)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Repositório</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.repository_name || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Status</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.health_label}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Ativa</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.automation_active ? "Sim" : "Não"}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-950">Bot</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Nome do bot</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.bot_name || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Bot ativo</dt>
                      <dd className="font-medium text-slate-900">
                        {selectedItem.bot_active == null ? "---" : selectedItem.bot_active ? "Sim" : "Não"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Máquina</dt>
                      <dd className="font-medium text-slate-900">{getMachineLabel(selectedItem)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Monitorado em</dt>
                      <dd className="font-medium text-slate-900">{formatDateTime(selectedItem.monitored_at)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-950">Regra de saúde</h3>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-slate-500">Schedule</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.schedule?.name || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Regra</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.schedule?.rule_label || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Intervalo esperado</dt>
                      <dd className="font-medium text-slate-900">
                        {formatDuration(selectedItem.schedule?.expected_interval_seconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Atrasado?</dt>
                      <dd className={`font-semibold ${selectedItem.is_overdue ? "text-amber-600" : "text-emerald-600"}`}>
                        {selectedItem.is_overdue ? "Sim — não rodou no tempo esperado" : "Não"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Próximo run</dt>
                      <dd className="font-medium text-slate-900">
                        {formatDateTime(selectedItem.schedule?.next_run_at)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-950">Detalhes do schedule</h3>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Tipo</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.schedule?.schedule_type || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Tipo calendário</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.schedule?.calendar_type || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Cron</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.schedule?.cron_expression || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Timezone</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.schedule?.timezone || "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Intervalo</dt>
                      <dd className="font-medium text-slate-900">
                        {selectedItem.schedule?.interval_value ?? "---"}{" "}
                        {selectedItem.schedule?.interval_unit || ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Último run</dt>
                      <dd className="font-medium text-slate-900">{formatDateTime(selectedItem.schedule?.last_run_at)}</dd>
                    </div>
                  </dl>
                </div>

                <div className="border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-950">Última task</h3>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Task ID</dt>
                      <dd className="font-medium text-slate-900">{selectedItem.last_task?.id ?? "---"}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Status da task</dt>
                      <dd className={`font-semibold ${
                        selectedItem.last_task?.status === "error" ? "text-red-600" :
                        selectedItem.last_task?.status === "finished" ? "text-emerald-600" :
                        "text-slate-900"
                      }`}>
                        {getTaskStatusLabel(selectedItem.last_task?.status)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Runner</dt>
                      <dd className="font-medium text-slate-900">
                        {selectedItem.last_task?.runner_display_name ||
                          selectedItem.last_task?.runner_label ||
                          selectedItem.last_task?.runner_name ||
                          "---"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Duração</dt>
                      <dd className="font-medium text-slate-900">
                        {formatDuration(selectedItem.last_task?.execution_duration_seconds)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Iniciado em</dt>
                      <dd className="font-medium text-slate-900">{formatDateTime(selectedItem.last_task?.started_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Finalizado em</dt>
                      <dd className="font-medium text-slate-900">{formatDateTime(selectedItem.last_task?.finished_at)}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Mensagem final</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words border border-slate-200 bg-slate-50 p-3 font-medium text-slate-900">
                        {selectedItem.last_task?.final_message || "---"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
