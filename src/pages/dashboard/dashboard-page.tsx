import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, Bot, CheckCircle2, Clock3, Cpu, PlayCircle, Server, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { Skeleton, TableSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
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
import { EMPTY, formatDateTime, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { badge, card, cardHeader, cardTitle, chip, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

type TabKey = "overview" | "runners" | "bots" | "recent";

const REFRESH_MS = 30_000;
const SUCCESS_COLOR = "#059669"; // emerald-600
const ERROR_COLOR = "#dc2626"; // red-600
const MAX_CHART_BOTS = 12;

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: "1 dia", value: "1d" },
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
];

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "1d": "Últimas 24 horas",
  "7d": "Últimos 7 dias",
  "15d": "Últimos 15 dias",
  "30d": "Últimos 30 dias",
};

const TASK_STATUSES: DashboardTaskStatus[] = [
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

function isTaskStatus(status?: string | null): status is DashboardTaskStatus {
  return Boolean(status) && TASK_STATUSES.includes(status as DashboardTaskStatus);
}

function formatRunnerStatus(status?: string | null) {
  const map: Record<string, string> = {
    online: "Online",
    offline: "Offline",
    busy: "Ocupada",
    maintenance: "Manutenção",
    blocked: "Bloqueada",
  };
  return status ? (map[status] ?? status) : EMPTY;
}

function getRunnerStatusTone(status?: string | null): keyof typeof tone {
  switch ((status ?? "").toLowerCase()) {
    case "online":
      return "success";
    case "busy":
      return "info";
    case "maintenance":
      return "warning";
    case "offline":
    case "blocked":
      return "danger";
    default:
      return "neutral";
  }
}

function getProgressWidth(value: number) {
  const safe = Math.max(0, Math.min(100, value));
  return `${safe}%`;
}

function toChartNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const SERIES_LABEL: Record<string, string> = { sucesso: "Sucesso", erro: "Erro" };

// Botão segmentado (período e abas).
function segmentClass(active: boolean) {
  return cn(
    "h-10 px-4 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
    active ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("1d");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", period],
    queryFn: () => getDashboardOverview({ period }),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const runnersQuery = useQuery({
    queryKey: ["dashboard-runners", period],
    queryFn: () => getDashboardRunners({ period }),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const botsQuery = useQuery({
    queryKey: ["dashboard-bots", period],
    queryFn: () => getDashboardBots({ period }),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const isLoading = overviewQuery.isLoading || runnersQuery.isLoading || botsQuery.isLoading;
  const isFetching = overviewQuery.isFetching || runnersQuery.isFetching || botsQuery.isFetching;
  const hasError = overviewQuery.isError || runnersQuery.isError || botsQuery.isError;
  const error = overviewQuery.error ?? runnersQuery.error ?? botsQuery.error;

  const overview = overviewQuery.data;
  const runners = useMemo(() => runnersQuery.data?.items ?? [], [runnersQuery.data]);
  const bots = useMemo(() => botsQuery.data?.items ?? [], [botsQuery.data]);

  function refetchAll() {
    overviewQuery.refetch();
    runnersQuery.refetch();
    botsQuery.refetch();
  }

  const topCards = useMemo(() => {
    if (!overview) return [];

    return [
      { label: "Tasks no período", value: formatNumber(overview.summary.total_tasks, 0), subtitle: PERIOD_LABEL[period], icon: Activity },
      {
        label: "Sucesso",
        value: formatNumber(overview.summary.success_tasks, 0),
        subtitle: `${formatPercent(overview.summary.success_rate_percent)} de assertividade`,
        icon: CheckCircle2,
        iconClass: "text-emerald-600",
      },
      {
        label: "Erros",
        value: formatNumber(overview.summary.error_tasks, 0),
        subtitle: "Erro + timeout + parada forçada",
        icon: XCircle,
        iconClass: "text-red-600",
      },
      { label: "Na fila", value: formatNumber(overview.summary.queued_tasks, 0), subtitle: "Aguardando execução", icon: Clock3, iconClass: "text-amber-600" },
      {
        label: "Executando",
        value: formatNumber(overview.summary.running_tasks, 0),
        subtitle: "Em processamento agora",
        icon: PlayCircle,
        iconClass: "text-blue-600",
      },
      {
        label: "Runners",
        value: formatNumber(overview.summary.total_runners, 0),
        subtitle: `${overview.summary.online_runners} online, ${overview.summary.busy_runners} ocupadas`,
        icon: Server,
      },
      { label: "Bots", value: formatNumber(overview.summary.total_bots, 0), subtitle: "Disponíveis para operação", icon: Bot },
      { label: "Fila média", value: formatDuration(overview.summary.avg_queue_seconds), subtitle: "Tempo médio até iniciar", icon: Cpu },
    ];
  }, [overview, period]);

  const updatedAt = Math.max(overviewQuery.dataUpdatedAt, runnersQuery.dataUpdatedAt, botsQuery.dataUpdatedAt);

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Dashboard operacional"
          description={
            overview ? (
              <>
                {PERIOD_LABEL[period]}: {formatDateTime(overview.date_from)} até {formatDateTime(overview.date_to)}
              </>
            ) : (
              "Visão consolidada por período, por máquina, por bot e pelas execuções mais recentes."
            )
          }
          actions={
            <>
              <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="Período">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPeriod(option.value)}
                    className={segmentClass(period === option.value)}
                    aria-pressed={period === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <RefreshIndicator updatedAt={updatedAt} isFetching={isFetching} onRefresh={refetchAll} intervalMs={REFRESH_MS} />
            </>
          }
        />

        <div className="px-5 py-5">
          {isLoading ? (
            <DashboardLoadingState />
          ) : hasError ? (
            <QueryError error={error} what="os dados do dashboard" onRetry={refetchAll} retrying={isFetching} />
          ) : overview ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {topCards.map((item) => (
                  <MetricCard key={item.label} {...item} />
                ))}
              </div>

              <div className={card}>
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="tablist">
                    <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
                      Visão geral
                    </TabButton>
                    <TabButton active={activeTab === "runners"} onClick={() => setActiveTab("runners")}>
                      Por máquina
                    </TabButton>
                    <TabButton active={activeTab === "bots"} onClick={() => setActiveTab("bots")}>
                      Por bot
                    </TabButton>
                    <TabButton active={activeTab === "recent"} onClick={() => setActiveTab("recent")}>
                      Execuções recentes
                    </TabButton>
                  </div>
                </div>

                <div className="p-5">
                  {activeTab === "overview" ? <OverviewTab overview={overview} bots={bots} /> : null}
                  {activeTab === "runners" ? <RunnersTab items={runners} /> : null}
                  {activeTab === "bots" ? <BotsTab items={bots} /> : null}
                  {activeTab === "recent" ? <RecentExecutionsTab items={overview.recent_tasks ?? []} /> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  iconClass?: string;
}) {
  return (
    <div className={cn(card, "p-5")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-950">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <Icon className={cn("h-5 w-5", iconClass ?? "text-slate-600")} />
        </div>
      </div>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-5" role="status" aria-label="Carregando">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className={cn(card, "space-y-3 p-5")}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      <div className={card}>
        <TableSkeleton rows={5} columns={5} />
      </div>
    </div>
  );
}

function OverviewTab({ overview, bots }: { overview: DashboardOverviewResponse; bots: DashboardBotMetrics[] }) {
  // Sucesso x erro por bot: o resumo por hora (tasks_per_hour) só traz o total, sem a divisão.
  const chartData = useMemo(
    () =>
      [...bots]
        .filter((bot) => bot.total_tasks > 0)
        .sort((a, b) => b.total_tasks - a.total_tasks)
        .slice(0, MAX_CHART_BOTS)
        .map((bot) => ({
          name: bot.bot_name,
          sucesso: bot.success_tasks,
          erro: bot.error_tasks,
          total: bot.total_tasks,
        })),
    [bots]
  );

  const hourlyPeak = useMemo(() => {
    const hours = overview.tasks_per_hour ?? [];
    if (hours.length === 0) return null;
    return hours.reduce((best, item) => (item.total_tasks > best.total_tasks ? item : best), hours[0]);
  }, [overview.tasks_per_hour]);

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className={cardHeader}>
          <div>
            <h2 className={cardTitle}>Sucesso e erro por bot</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Os {Math.min(MAX_CHART_BOTS, chartData.length)} bots com mais execuções no período.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: SUCCESS_COLOR }} />
              Sucesso
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: ERROR_COLOR }} />
              Erro
            </span>
          </div>
        </div>

        <div className="p-5">
          {chartData.length === 0 ? (
            <EmptyState compact icon={BarChart3} title="Nenhuma execução no período" description="Troque o período para ver mais dados." />
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={chartData.length > 6 ? -20 : 0} textAnchor={chartData.length > 6 ? "end" : "middle"} height={chartData.length > 6 ? 60 : 30} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => [formatNumber(toChartNumber(value), 0), SERIES_LABEL[String(name)] ?? String(name)]}
                    labelFormatter={(label, payload) => {
                      const item = payload?.[0]?.payload as { total?: number } | undefined;
                      return item ? `${label} · ${formatNumber(item.total, 0)} execuções` : String(label);
                    }}
                  />
                  <Legend formatter={(value) => SERIES_LABEL[String(value)] ?? String(value)} />
                  <Bar dataKey="sucesso" name="sucesso" stackId="tasks" fill={SUCCESS_COLOR} />
                  <Bar dataKey="erro" name="erro" stackId="tasks" fill={ERROR_COLOR} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MiniKpiCard label="Taxa de sucesso" value={formatPercent(overview.summary.success_rate_percent)} subtitle="No período" />
        <MiniKpiCard label="Fila média" value={formatDuration(overview.summary.avg_queue_seconds)} subtitle="Tempo até iniciar" />
        <MiniKpiCard label="Execução média" value={formatDuration(overview.summary.avg_execution_seconds)} subtitle="Tempo médio de execução" />
        <MiniKpiCard
          label="Hora de pico"
          value={hourlyPeak ? hourlyPeak.hour_label : EMPTY}
          subtitle={hourlyPeak ? `${formatNumber(hourlyPeak.total_tasks, 0)} execuções` : "Sem execuções no período"}
        />
      </section>
    </div>
  );
}

function TaskCounts({ item }: { item: { total_tasks: number; success_tasks: number; error_tasks: number; running_tasks: number; queued_tasks: number } }) {
  return (
    <div className="space-y-0.5 text-xs">
      <div className="font-medium text-slate-900">Total: {formatNumber(item.total_tasks, 0)}</div>
      <div className="text-emerald-700">Sucesso: {formatNumber(item.success_tasks, 0)}</div>
      <div className="text-red-700">Erro: {formatNumber(item.error_tasks, 0)}</div>
      <div className="text-blue-700">Executando: {formatNumber(item.running_tasks, 0)}</div>
      <div className="text-amber-700">Fila: {formatNumber(item.queued_tasks, 0)}</div>
    </div>
  );
}

function ProgressBar({ value, width = "w-32" }: { value: number; width?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="font-medium text-slate-900">{formatPercent(value)}</div>
      <div className={cn("h-2 overflow-hidden rounded-full bg-slate-100", width)}>
        <div className="h-full rounded-full bg-blue-600" style={{ width: getProgressWidth(value) }} />
      </div>
    </div>
  );
}

function RunnersTab({ items }: { items: DashboardRunnerMetrics[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return <EmptyState icon={Server} title="Nenhuma máquina no período" description="Nenhuma máquina teve atividade no período escolhido." />;
  }

  return (
    <div className={cn(table.wrap, "rounded-lg border border-slate-200")}>
      <table className={table.table}>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Máquina</th>
            <th className={table.th}>Status</th>
            <th className={table.th}>Utilização</th>
            <th className={table.th}>Tasks</th>
            <th className={table.th}>Fila média</th>
            <th className={table.th}>Execução média</th>
            <th className={table.th}>Melhor horário</th>
            <th className={table.th}>Última execução</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.runner_id} className={cn(table.trClickable, "align-top")} onClick={() => navigate(`/runners/${item.runner_id}`)}>
              <td className={table.td}>
                <div className="space-y-1.5">
                  <div className="font-medium text-slate-900">{item.runner_name}</div>
                  {item.runner_label ? <div className="text-xs text-slate-500">{item.runner_label}</div> : null}
                  <div className="text-xs text-slate-500">Heartbeat: {formatDateTime(item.last_heartbeat)}</div>
                  <div className="flex flex-wrap gap-1">
                    {item.linked_bots.length === 0 ? (
                      <span className="text-xs text-slate-400">Sem bots vinculados</span>
                    ) : (
                      item.linked_bots.slice(0, 3).map((bot) => (
                        <span key={bot.bot_id} className={chip}>
                          {bot.bot_name}
                        </span>
                      ))
                    )}
                    {item.linked_bots.length > 3 ? <span className={chip}>+{item.linked_bots.length - 3}</span> : null}
                  </div>
                </div>
              </td>

              <td className={table.td}>
                <span className={cn(badge, tone[getRunnerStatusTone(item.status)])}>{formatRunnerStatus(item.status)}</span>
              </td>

              <td className={table.td}>
                <ProgressBar value={item.utilization_percent} />
              </td>

              <td className={table.td}>
                <TaskCounts item={item} />
              </td>

              <td className={table.tdStrong}>{formatDuration(item.avg_queue_seconds)}</td>
              <td className={table.tdStrong}>{formatDuration(item.avg_execution_seconds)}</td>

              <td className={table.td}>
                {item.hottest_hour_label ? (
                  <div>
                    <div className="font-medium text-slate-900">{item.hottest_hour_label}</div>
                    <div className="text-xs text-slate-500">{item.hottest_hour_tasks} tasks</div>
                  </div>
                ) : (
                  EMPTY
                )}
              </td>

              <td className={table.td}>
                {item.last_execution ? (
                  <div className="space-y-1.5">
                    {isTaskStatus(item.last_execution.status) ? <StatusBadge status={item.last_execution.status} /> : null}
                    <div className="font-medium text-slate-900">{item.last_execution.automation_name || EMPTY}</div>
                    <div className="text-xs text-slate-500">Início: {formatDateTime(item.last_execution.started_at)}</div>
                    <div className="text-xs text-slate-500">Duração: {formatDuration(item.last_execution.execution_duration_seconds)}</div>
                  </div>
                ) : (
                  EMPTY
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BotsTab({ items }: { items: DashboardBotMetrics[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return <EmptyState icon={Bot} title="Nenhum bot no período" description="Nenhum bot teve execuções no período escolhido." />;
  }

  return (
    <div className={cn(table.wrap, "rounded-lg border border-slate-200")}>
      <table className={table.table}>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Bot</th>
            <th className={table.th}>Execuções</th>
            <th className={table.th}>Taxa de sucesso</th>
            <th className={table.th}>Fila média</th>
            <th className={table.th}>Execução média</th>
            <th className={table.th}>Máquinas</th>
            <th className={table.th}>Última execução</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.bot_id} className={cn(table.trClickable, "align-top")} onClick={() => navigate(`/bots/${item.bot_id}`)}>
              <td className={table.td}>
                <div className="space-y-1.5">
                  <div className="font-medium text-slate-900">{item.bot_name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={chip}>{item.execution_mode || EMPTY}</span>
                    <span className={chip}>v{item.current_version || EMPTY}</span>
                    <span className={cn(badge, item.active ? tone.success : tone.neutral)}>{item.active ? "Ativo" : "Inativo"}</span>
                  </div>
                </div>
              </td>

              <td className={table.td}>
                <TaskCounts item={item} />
              </td>

              <td className={table.td}>
                <ProgressBar value={item.success_rate_percent} width="w-28" />
              </td>

              <td className={table.tdStrong}>{formatDuration(item.avg_queue_seconds)}</td>
              <td className={table.tdStrong}>{formatDuration(item.avg_execution_seconds)}</td>

              <td className={table.td}>
                <div className="flex flex-wrap gap-1">
                  {item.runners.length === 0 ? (
                    <span className="text-xs text-slate-400">Sem máquinas vinculadas</span>
                  ) : (
                    item.runners.map((runner) => (
                      <span key={runner.runner_id} className={chip}>
                        {runner.runner_name}
                      </span>
                    ))
                  )}
                </div>
              </td>

              <td className={table.td}>
                <div className="space-y-1.5">
                  {isTaskStatus(item.last_execution_status) ? <StatusBadge status={item.last_execution_status} /> : <span>{EMPTY}</span>}
                  <div className="text-xs text-slate-500">{formatDateTime(item.last_execution_at)}</div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecentExecutionsTab({ items }: { items: DashboardRecentTaskItem[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return <EmptyState icon={Activity} title="Nenhuma execução recente" description="As últimas tasks aparecem aqui assim que rodarem." />;
  }

  return (
    <div className={cn(table.wrap, "rounded-lg border border-slate-200")}>
      <table className={table.table}>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Task</th>
            <th className={table.th}>Bot / automação</th>
            <th className={table.th}>Máquina</th>
            <th className={table.th}>Status</th>
            <th className={table.th}>Fila</th>
            <th className={table.th}>Execução</th>
            <th className={table.th}>Criada em</th>
            <th className={table.th}>Mensagem final</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.task_id} className={cn(table.trClickable, "align-top")} onClick={() => navigate(`/tasks/${item.task_id}`)}>
              <td className={table.tdStrong}>#{item.task_id}</td>

              <td className={table.td}>
                <div className="font-medium text-slate-900">{item.bot_name || EMPTY}</div>
                <div className="text-xs text-slate-500">{item.automation_name || EMPTY}</div>
              </td>

              <td className={table.td}>{item.runner_name || EMPTY}</td>

              <td className={table.td}>
                <StatusBadge status={item.status} />
              </td>

              <td className={table.tdStrong}>{formatDuration(item.queue_seconds)}</td>
              <td className={table.tdStrong}>{formatDuration(item.execution_duration_seconds)}</td>
              <td className={table.tdMuted}>{formatDateTime(item.created_at)}</td>

              <td className={table.tdMuted}>
                <span className="block max-w-[320px] truncate" title={item.final_message ?? undefined}>
                  {item.final_message || EMPTY}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniKpiCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <div className={cn(card, "p-4")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={segmentClass(active)}>
      {children}
    </button>
  );
}
