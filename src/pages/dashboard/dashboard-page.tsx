import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Cpu,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Server,
  XCircle,
} from "lucide-react";

import {
  getDashboardBots,
  getDashboardOverview,
  getDashboardRunners,
  type DashboardBotMetrics,
  type DashboardOverviewResponse,
  type DashboardPeriod,
  type DashboardRecentTaskItem,
  type DashboardRunnerMetrics,
  type DashboardTaskStatus,
} from "@/services/api/dashboard";

type TabKey = "overview" | "runners" | "bots" | "recent";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: "1 dia", value: "1d" },
  { label: "1 semana", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "1 mês", value: "30d" },
];

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "0%";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatSecondsToFriendly(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "---";

  const total = Math.max(0, Math.round(value));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatStatus(status?: DashboardTaskStatus | string | null) {
  if (!status) return "---";

  const map: Record<string, string> = {
    waiting: "Na fila",
    scheduled: "Agendada",
    ready: "Pronta",
    running: "Executando",
    stop_requested: "Parada solicitada",
    forced_stop: "Parada forçada",
    canceled: "Cancelada",
    finished: "Sucesso",
    error: "Erro",
    timeout: "Timeout",
    online: "Online",
    offline: "Offline",
    busy: "Ocupada",
    maintenance: "Manutenção",
    blocked: "Bloqueada",
  };

  return map[String(status)] ?? String(status);
}

function getStatusBadgeClass(status?: DashboardTaskStatus | string | null) {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "finished" || normalized === "online") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (
    normalized === "error" ||
    normalized === "timeout" ||
    normalized === "forced_stop" ||
    normalized === "offline" ||
    normalized === "blocked"
  ) {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "running" || normalized === "busy") {
    return "border border-blue-200 bg-blue-50 text-blue-700";
  }

  if (
    normalized === "waiting" ||
    normalized === "scheduled" ||
    normalized === "ready" ||
    normalized === "maintenance" ||
    normalized === "stop_requested"
  ) {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "canceled") {
    return "border border-slate-200 bg-slate-100 text-slate-700";
  }

  return "border border-slate-200 bg-slate-50 text-slate-700";
}

function getProgressWidth(value: number) {
  const safe = Math.max(0, Math.min(100, value));
  return `${safe}%`;
}

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("1d");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [toast, setToast] = useState<ToastState>(null);

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", period],
    queryFn: () => getDashboardOverview({ period }),
    refetchInterval: 30000,
  });

  const runnersQuery = useQuery({
    queryKey: ["dashboard-runners", period],
    queryFn: () => getDashboardRunners({ period }),
    refetchInterval: 30000,
  });

  const botsQuery = useQuery({
    queryKey: ["dashboard-bots", period],
    queryFn: () => getDashboardBots({ period }),
    refetchInterval: 30000,
  });

  const isLoading =
    overviewQuery.isLoading || runnersQuery.isLoading || botsQuery.isLoading;

  const isFetching =
    overviewQuery.isFetching || runnersQuery.isFetching || botsQuery.isFetching;

  const hasError =
    overviewQuery.isError || runnersQuery.isError || botsQuery.isError;

  const overview = overviewQuery.data;
  const runners = runnersQuery.data?.items ?? [];
  const bots = botsQuery.data?.items ?? [];

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const topCards = useMemo(() => {
    if (!overview) return [];

    return [
      {
        label: "Tasks no período",
        value: formatNumber(overview.summary.total_tasks),
        subtitle: `${formatStatusRange(period)}`,
        icon: Activity,
      },
      {
        label: "Sucesso",
        value: formatNumber(overview.summary.success_tasks),
        subtitle: `${formatPercent(overview.summary.success_rate_percent)} de assertividade`,
        icon: CheckCircle2,
      },
      {
        label: "Erros",
        value: formatNumber(overview.summary.error_tasks),
        subtitle: "Erro + timeout + parada forçada",
        icon: XCircle,
      },
      {
        label: "Na fila",
        value: formatNumber(overview.summary.queued_tasks),
        subtitle: "Tasks aguardando execução",
        icon: Clock3,
      },
      {
        label: "Executando",
        value: formatNumber(overview.summary.running_tasks),
        subtitle: "Tasks em processamento agora",
        icon: PlayCircle,
      },
      {
        label: "Runners",
        value: formatNumber(overview.summary.total_runners),
        subtitle: `${overview.summary.online_runners} online, ${overview.summary.busy_runners} ocupadas`,
        icon: Server,
      },
      {
        label: "Bots",
        value: formatNumber(overview.summary.total_bots),
        subtitle: "Bots disponíveis para operação",
        icon: Bot,
      },
      {
        label: "Fila média",
        value: formatSecondsToFriendly(overview.summary.avg_queue_seconds),
        subtitle: "Tempo médio até iniciar",
        icon: Cpu,
      },
    ];
  }, [overview, period]);

  async function handleRefresh() {
    try {
      await Promise.all([
        overviewQuery.refetch(),
        runnersQuery.refetch(),
        botsQuery.refetch(),
      ]);

      setToast({
        type: "success",
        message: "Dashboard atualizado com sucesso.",
      });
    } catch {
      setToast({
        type: "error",
        message: "Não foi possível atualizar o dashboard.",
      });
    }
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
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="pr-4 text-sm font-medium">{toast.message}</div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 transition hover:text-current"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                Dashboard operacional
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visão consolidada por período, com indicadores por máquina, por
                bot e pelas execuções mais recentes.
              </p>
              {overview ? (
                <p className="mt-2 text-xs text-slate-400">
                  Período analisado: {formatDateTime(overview.date_from)} até{" "}
                  {formatDateTime(overview.date_to)}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={`h-10 border px-4 text-sm font-medium transition ${
                      period === option.value
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {isLoading ? (
            <DashboardLoadingState />
          ) : hasError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              Não foi possível carregar os dados do dashboard.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.label}
                      className="border border-slate-200 bg-white p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-600">
                            {card.label}
                          </p>
                          <p className="mt-2 text-3xl font-semibold text-slate-950">
                            {card.value}
                          </p>
                          <p className="mt-2 text-xs text-slate-500">
                            {card.subtitle}
                          </p>
                        </div>

                        <div className="flex h-11 w-11 items-center justify-center border border-slate-200 bg-slate-50 text-slate-700">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <TabButton
                      active={activeTab === "overview"}
                      onClick={() => setActiveTab("overview")}
                    >
                      Visão geral
                    </TabButton>
                    <TabButton
                      active={activeTab === "runners"}
                      onClick={() => setActiveTab("runners")}
                    >
                      Por máquina
                    </TabButton>
                    <TabButton
                      active={activeTab === "bots"}
                      onClick={() => setActiveTab("bots")}
                    >
                      Por bot
                    </TabButton>
                    <TabButton
                      active={activeTab === "recent"}
                      onClick={() => setActiveTab("recent")}
                    >
                      Execuções recentes
                    </TabButton>
                  </div>
                </div>

                <div className="px-5 py-5">
                  {activeTab === "overview" ? (
                    <OverviewTab overview={overview!} />
                  ) : null}

                  {activeTab === "runners" ? (
                    <RunnersTab items={runners} />
                  ) : null}

                  {activeTab === "bots" ? (
                    <BotsTab items={bots} />
                  ) : null}

                  {activeTab === "recent" ? (
                    <RecentExecutionsTab items={overview?.recent_tasks ?? []} />
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando dashboard...
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="border border-slate-200 bg-white p-5"
          >
            <div className="h-4 w-28 animate-pulse bg-slate-200" />
            <div className="mt-4 h-8 w-24 animate-pulse bg-slate-200" />
            <div className="mt-4 h-3 w-36 animate-pulse bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="border border-slate-200 bg-white p-5">
        <div className="h-5 w-40 animate-pulse bg-slate-200" />
        <div className="mt-5 grid gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ overview }: { overview: DashboardOverviewResponse }) {
  const chartData = overview.tasks_per_hour ?? [];

  const maxTasks = Math.max(...chartData.map((item) => item.total_tasks), 1);
  const maxExecutionSeconds = Math.max(
    ...chartData.map((item) => item.execution_seconds),
    1
  );

  return (
    <div className="space-y-6">
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Execuções por hora
            </h2>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 bg-slate-900" />
                <span>Quantidade de execuções</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 bg-blue-500" />
                <span>Tempo total de execução</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-5">
          {chartData.length === 0 ? (
            <EmptyState message="Nenhuma execução encontrada no período." />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="flex h-[320px] items-end gap-4 border-b border-l border-slate-200 px-4 pb-4 pt-2">
                  {chartData.map((item) => {
                    const tasksHeight = Math.max(
                      6,
                      (item.total_tasks / maxTasks) * 240
                    );

                    const executionHeight = Math.max(
                      6,
                      (item.execution_seconds / maxExecutionSeconds) * 240
                    );

                    return (
                      <div
                        key={item.hour_label}
                        className="flex min-w-[42px] flex-1 flex-col items-center justify-end gap-2"
                        title={`${item.hour_label} • ${item.total_tasks} execuções • ${formatSecondsToFriendly(
                          item.execution_seconds
                        )}`}
                      >
                        <div className="flex h-[260px] items-end gap-1">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-slate-500">
                              {item.total_tasks}
                            </span>
                            <div
                              className="w-4 bg-slate-900 transition-all"
                              style={{ height: `${tasksHeight}px` }}
                            />
                          </div>

                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-slate-500">
                              {Math.round(item.execution_seconds / 60)}m
                            </span>
                            <div
                              className="w-4 bg-blue-500 transition-all"
                              style={{ height: `${executionHeight}px` }}
                            />
                          </div>
                        </div>

                        <span className="text-xs font-medium text-slate-600">
                          {item.hour_label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniKpiCard
          label="Taxa de sucesso"
          value={formatPercent(overview.summary.success_rate_percent)}
          subtitle="Baseado no período"
        />
        <MiniKpiCard
          label="Fila média"
          value={formatSecondsToFriendly(overview.summary.avg_queue_seconds)}
          subtitle="Tempo até iniciar"
        />
        <MiniKpiCard
          label="Execução média"
          value={formatSecondsToFriendly(overview.summary.avg_execution_seconds)}
          subtitle="Tempo médio de execução"
        />
        <MiniKpiCard
          label="Runners ocupadas"
          value={formatNumber(overview.summary.busy_runners)}
          subtitle="Máquinas executando"
        />
      </section>
    </div>
  );
}

function RunnersTab({ items }: { items: DashboardRunnerMetrics[] }) {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto border border-slate-200">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Máquina
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Status
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Utilização
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Tasks
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Fila média
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Execução média
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Melhor horário
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Última execução
              </th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Nenhuma máquina encontrada para o período informado.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.runner_id} className="align-top">
                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-2">
                      <div className="font-medium text-slate-900">
                        {item.runner_name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.runner_label || "---"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Heartbeat: {formatDateTime(item.last_heartbeat)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {item.linked_bots.length === 0 ? (
                          <span className="text-xs text-slate-400">Sem bots vinculados</span>
                        ) : (
                          item.linked_bots.slice(0, 3).map((bot) => (
                            <span
                              key={bot.bot_id}
                              className="inline-flex items-center border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                            >
                              {bot.bot_name}
                            </span>
                          ))
                        )}
                        {item.linked_bots.length > 3 ? (
                          <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                            +{item.linked_bots.length - 3}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {formatStatus(item.status)}
                    </span>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-2">
                      <div className="font-medium text-slate-900">
                        {formatPercent(item.utilization_percent)}
                      </div>
                      <div className="h-2 w-40 overflow-hidden bg-slate-100">
                        <div
                          className="h-full bg-slate-900"
                          style={{
                            width: getProgressWidth(item.utilization_percent),
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-1">
                      <div>Total: {formatNumber(item.total_tasks)}</div>
                      <div className="text-emerald-700">
                        Sucesso: {formatNumber(item.success_tasks)}
                      </div>
                      <div className="text-red-700">
                        Erro: {formatNumber(item.error_tasks)}
                      </div>
                      <div className="text-blue-700">
                        Executando: {formatNumber(item.running_tasks)}
                      </div>
                      <div className="text-amber-700">
                        Fila: {formatNumber(item.queued_tasks)}
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">
                    {formatSecondsToFriendly(item.avg_queue_seconds)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">
                    {formatSecondsToFriendly(item.avg_execution_seconds)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    {item.hottest_hour_label ? (
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">
                          {item.hottest_hour_label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {item.hottest_hour_tasks} tasks
                        </div>
                      </div>
                    ) : (
                      "---"
                    )}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    {item.last_execution ? (
                      <div className="space-y-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                            item.last_execution.status
                          )}`}
                        >
                          {formatStatus(item.last_execution.status)}
                        </span>
                        <div className="font-medium text-slate-900">
                          {item.last_execution.automation_name || "---"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Início: {formatDateTime(item.last_execution.started_at)}
                        </div>
                        <div className="text-xs text-slate-500">
                          Duração:{" "}
                          {formatSecondsToFriendly(
                            item.last_execution.execution_duration_seconds
                          )}
                        </div>
                      </div>
                    ) : (
                      "---"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BotsTab({ items }: { items: DashboardBotMetrics[] }) {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto border border-slate-200">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bot
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Execuções
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Taxa sucesso
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Fila média
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Execução média
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Máquinas
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Última execução
              </th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Nenhum bot encontrado para o período informado.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.bot_id} className="align-top">
                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-2">
                      <div className="font-medium text-slate-900">
                        {item.bot_name}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          {item.execution_mode || "---"}
                        </span>
                        <span className="inline-flex items-center border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                          v{item.current_version || "---"}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-1 text-xs font-semibold ${
                            item.active
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {item.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-1">
                      <div>Total: {formatNumber(item.total_tasks)}</div>
                      <div className="text-emerald-700">
                        Sucesso: {formatNumber(item.success_tasks)}
                      </div>
                      <div className="text-red-700">
                        Erro: {formatNumber(item.error_tasks)}
                      </div>
                      <div className="text-blue-700">
                        Executando: {formatNumber(item.running_tasks)}
                      </div>
                      <div className="text-amber-700">
                        Fila: {formatNumber(item.queued_tasks)}
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-2">
                      <div className="font-medium text-slate-900">
                        {formatPercent(item.success_rate_percent)}
                      </div>
                      <div className="h-2 w-32 overflow-hidden bg-slate-100">
                        <div
                          className="h-full bg-slate-900"
                          style={{
                            width: getProgressWidth(item.success_rate_percent),
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">
                    {formatSecondsToFriendly(item.avg_queue_seconds)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">
                    {formatSecondsToFriendly(item.avg_execution_seconds)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="flex flex-wrap gap-1">
                      {item.runners.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          Sem máquinas vinculadas
                        </span>
                      ) : (
                        item.runners.map((runner) => (
                          <span
                            key={runner.runner_id}
                            className="inline-flex items-center border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                          >
                            {runner.runner_name}
                          </span>
                        ))
                      )}
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                          item.last_execution_status
                        )}`}
                      >
                        {formatStatus(item.last_execution_status)}
                      </span>
                      <div className="text-xs text-slate-500">
                        {formatDateTime(item.last_execution_at)}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentExecutionsTab({
  items,
}: {
  items: DashboardRecentTaskItem[];
}) {
  return (
    <div className="space-y-5">
      <div className="overflow-x-auto border border-slate-200">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Task
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bot / Automação
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Máquina
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Status
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Fila
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Execução
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Criada em
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                Mensagem final
              </th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Nenhuma execução recente encontrada.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.task_id} className="align-top">
                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="font-medium text-slate-900">#{item.task_id}</div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">
                        {item.bot_name || "---"}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.automation_name || "---"}
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    {item.runner_name || "---"}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(
                        item.status
                      )}`}
                    >
                      {formatStatus(item.status)}
                    </span>
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">
                    {formatSecondsToFriendly(item.queue_seconds)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm font-medium text-slate-900">
                    {formatSecondsToFriendly(item.execution_duration_seconds)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    {formatDateTime(item.created_at)}
                  </td>

                  <td className="border-b border-slate-200 px-4 py-4 text-sm text-slate-700">
                    <div className="max-w-[320px] whitespace-pre-wrap break-words">
                      {item.final_message || "---"}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniKpiCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 border px-4 text-sm font-medium transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function formatStatusRange(period: DashboardPeriod) {
  const map: Record<DashboardPeriod, string> = {
    "1d": "Últimas 24 horas",
    "7d": "Últimos 7 dias",
    "15d": "Últimos 15 dias",
    "30d": "Últimos 30 dias",
  };

  return map[period];
}
