import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, ListChecks, PlayCircle, Server, ShieldCheck, XCircle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { Skeleton, TableSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { useSystemHealth } from "@/hooks/use-system-health";
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
import { EMPTY, formatDuration, formatPercent, formatRelative, formatTimeSmart } from "@/lib/format";
import { badge, card, cardHeader, cardTitle, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * Dashboard operacional: o que está acontecendo agora, o que precisa de atenção, e como o período foi.
 * Uma coluna só, sem abas: quem abre a tela bate o olho de cima para baixo.
 */

const REFRESH_MS = 30_000;
const SUCCESS_COLOR = "#059669"; // emerald-600
const ERROR_COLOR = "#dc2626"; // red-600
const OTHER_COLOR = "#cbd5e1"; // slate-300
const MAX_ROWS = 8;

const PERIOD_OPTIONS: Array<{ label: string; value: DashboardPeriod }> = [
  { label: "24 h", value: "1d" },
  { label: "7 dias", value: "7d" },
  { label: "15 dias", value: "15d" },
  { label: "30 dias", value: "30d" },
];

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  "1d": "últimas 24 horas",
  "7d": "últimos 7 dias",
  "15d": "últimos 15 dias",
  "30d": "últimos 30 dias",
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

const RUNNER_STATUS: Record<string, { label: string; tone: keyof typeof tone }> = {
  online: { label: "Online", tone: "success" },
  busy: { label: "Ocupada", tone: "info" },
  maintenance: { label: "Manutenção", tone: "warning" },
  offline: { label: "Offline", tone: "danger" },
  blocked: { label: "Bloqueada", tone: "danger" },
};

function runnerStatus(status?: string | null) {
  return RUNNER_STATUS[(status ?? "").toLowerCase()] ?? { label: status ?? EMPTY, tone: "neutral" as const };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function segmentClass(active: boolean) {
  return cn(
    "h-9 px-3.5 text-sm font-medium transition first:rounded-l-lg last:rounded-r-lg",
    active ? "bg-blue-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"
  );
}

export function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("1d");
  const health = useSystemHealth();

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

  const updatedAt = Math.max(overviewQuery.dataUpdatedAt, runnersQuery.dataUpdatedAt, botsQuery.dataUpdatedAt) || undefined;
  const isFetching = overviewQuery.isFetching || runnersQuery.isFetching || botsQuery.isFetching;

  function refetchAll() {
    void overviewQuery.refetch();
    void runnersQuery.refetch();
    void botsQuery.refetch();
  }

  const overview = overviewQuery.data;
  const summary = overview?.summary;
  const attentionCount = health.failedTasks.length + health.problemRunners.length + health.stuckTasks.length;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Dashboard operacional"
          description={`Agora e nas ${PERIOD_LABEL[period]}.`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex divide-x divide-slate-300 rounded-lg border border-slate-300" role="group" aria-label="Período">
                {PERIOD_OPTIONS.map((option) => (
                  <button key={option.value} type="button" onClick={() => setPeriod(option.value)} className={segmentClass(period === option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
              <RefreshIndicator updatedAt={updatedAt} isFetching={isFetching} onRefresh={refetchAll} intervalMs={REFRESH_MS} />
            </div>
          }
        />
      </section>

      {overviewQuery.isError ? (
        <section className={card}>
          <QueryError error={overviewQuery.error} what="o dashboard" onRetry={refetchAll} />
        </section>
      ) : (
        <>
          {/* 1. Agora */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <NowTile
              icon={PlayCircle}
              label="Executando agora"
              value={summary?.running_tasks}
              loading={!summary}
              to="/tasks?status=running"
              accent="info"
              detail="tasks em andamento nas máquinas"
            />
            <NowTile
              icon={Clock3}
              label="Na fila"
              value={summary?.queued_tasks}
              loading={!summary}
              to="/tasks?status=waiting"
              accent={health.stuckTasks.length > 0 ? "warning" : "neutral"}
              detail={
                health.stuckTasks.length > 0
                  ? `${health.stuckTasks.length} parada${health.stuckTasks.length > 1 ? "s" : ""} há mais de ${health.stuckTasks[0].minutes} min`
                  : "aguardando máquina livre"
              }
            />
            <NowTile
              icon={Server}
              label="Máquinas"
              value={summary ? `${summary.online_runners + summary.busy_runners}/${summary.total_runners}` : undefined}
              loading={!summary}
              to="/runners"
              accent={health.problemRunners.length > 0 ? "danger" : "success"}
              detail={
                health.problemRunners.length > 0
                  ? `${health.problemRunners.length} com problema`
                  : summary
                    ? `${summary.busy_runners} ocupada${summary.busy_runners === 1 ? "" : "s"}, ${summary.online_runners} livre${summary.online_runners === 1 ? "" : "s"}`
                    : ""
              }
            />
            <NowTile
              icon={XCircle}
              label="Erros nas últimas 24 h"
              value={health.isLoading ? undefined : Math.max(health.errors24h, health.failedTasks.length)}
              loading={health.isLoading}
              to="/errors"
              accent={health.failedTasks.length > 0 || health.errors24h > 0 ? "danger" : "success"}
              detail={health.failedTasks.length > 0 ? `${health.failedTasks.length} task${health.failedTasks.length > 1 ? "s" : ""} com falha` : "nenhuma falha registrada"}
            />
          </div>

          {/* 2. Precisa de atenção */}
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cn(cardTitle, "flex items-center gap-2")}>
                {attentionCount > 0 ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
                Precisa de atenção
              </h2>
              {attentionCount > 0 && <span className={cn(badge, tone.warning)}>{attentionCount}</span>}
            </div>
            {health.isLoading ? (
              <div className="space-y-2 px-5 py-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
              </div>
            ) : attentionCount === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-600">Tudo em ordem: nenhuma falha nas últimas 24 h, nenhuma máquina com problema e nada parado na fila.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {health.problemRunners.map(({ runner, reason }) => (
                  <AttentionRow key={`runner-${runner.id}`} to={`/runners/${runner.id}`} tone="danger" icon={Server} title={runner.label || runner.name} detail={reason} />
                ))}
                {health.stuckTasks.slice(0, 5).map(({ task, minutes }) => (
                  <AttentionRow
                    key={`stuck-${task.id}`}
                    to={`/tasks/${task.id}`}
                    tone="warning"
                    icon={Clock3}
                    title={`${task.automation_name ?? "Task"} #${task.id}`}
                    detail={`parada na fila há ${minutes} min`}
                  />
                ))}
                {health.failedTasks.slice(0, 6).map((task) => (
                  <AttentionRow
                    key={`failed-${task.id}`}
                    to={`/tasks/${task.id}`}
                    tone="danger"
                    icon={XCircle}
                    title={`${task.automation_name ?? "Task"} #${task.id}`}
                    detail={[task.runner_name, task.final_message].filter(Boolean).join(" · ") || "falhou"}
                    right={<span className="text-xs text-slate-500">{formatRelative(task.finished_at ?? task.last_update_at ?? task.created_at)}</span>}
                  />
                ))}
                {health.failedTasks.length > 6 && (
                  <li className="px-5 py-2.5 text-sm">
                    <Link to="/errors" className="font-medium text-blue-600 hover:underline">
                      Ver todas as {health.failedTasks.length} falhas
                    </Link>
                  </li>
                )}
              </ul>
            )}
          </section>

          {/* 3. Como foi o período */}
          <PeriodChart overview={overview} period={period} />

          {/* 4. Máquinas e bots */}
          <div className="grid gap-5 xl:grid-cols-2">
            <RunnersCard items={runnersQuery.data?.items} loading={runnersQuery.isLoading} error={runnersQuery.isError ? runnersQuery.error : null} onRetry={() => void runnersQuery.refetch()} />
            <BotsCard items={botsQuery.data?.items} loading={botsQuery.isLoading} error={botsQuery.isError ? botsQuery.error : null} onRetry={() => void botsQuery.refetch()} />
          </div>

          {/* 5. Últimas execuções */}
          <RecentCard items={overview?.recent_tasks} loading={overviewQuery.isLoading} />
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Agora

const ACCENT: Record<"info" | "success" | "warning" | "danger" | "neutral", string> = {
  info: "bg-blue-50 text-blue-600",
  success: "bg-emerald-50 text-emerald-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
  neutral: "bg-slate-100 text-slate-500",
};

function NowTile({
  icon: Icon,
  label,
  value,
  detail,
  to,
  accent,
  loading,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: number | string;
  detail?: string;
  to: string;
  accent: keyof typeof ACCENT;
  loading?: boolean;
}) {
  return (
    <Link to={to} className={cn(card, "flex items-center gap-4 px-5 py-4 transition hover:border-slate-300 hover:shadow-md")}>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", ACCENT[accent])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <span className="block text-[28px] font-bold leading-tight tabular-nums text-slate-900">{value ?? EMPTY}</span>
        )}
        {detail && <span className="block truncate text-xs text-slate-500">{detail}</span>}
      </span>
    </Link>
  );
}

function AttentionRow({
  to,
  tone: rowTone,
  icon: Icon,
  title,
  detail,
  right,
}: {
  to: string;
  tone: "danger" | "warning";
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  right?: ReactNode;
}) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-5 py-2.5 text-sm transition hover:bg-slate-50">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", rowTone === "danger" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-slate-900">{title}</span>
          <span className="block truncate text-xs text-slate-500">{detail}</span>
        </span>
        {right}
      </Link>
    </li>
  );
}

// ------------------------------------------------------------------ Período

function PeriodChart({ overview, period }: { overview?: DashboardOverviewResponse; period: DashboardPeriod }) {
  const data = useMemo(
    () =>
      (overview?.timeline ?? []).map((item) => ({
        label: item.label,
        Sucesso: item.success_tasks,
        Erro: item.error_tasks,
        Outras: item.other_tasks,
      })),
    [overview]
  );
  const summary = overview?.summary;
  const done = summary ? summary.success_tasks + summary.error_tasks : 0;

  return (
    <section className={card}>
      <div className={cn(cardHeader, "flex-wrap")}>
        <h2 className={cardTitle}>Execuções nas {PERIOD_LABEL[period]}</h2>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
          <Stat label="tasks" value={summary?.total_tasks} />
          <Stat label="sucesso" value={summary ? formatPercent(summary.success_rate_percent) : undefined} color="text-emerald-700" hint={summary ? `${summary.success_tasks} de ${done} concluídas` : undefined} />
          <Stat label="falhas" value={summary?.error_tasks} color={summary && summary.error_tasks > 0 ? "text-red-700" : undefined} />
          <Stat label="execução média" value={summary ? formatDuration(Math.round(summary.avg_execution_seconds)) : undefined} />
          <Stat label="espera média na fila" value={summary ? formatDuration(Math.round(summary.avg_queue_seconds)) : undefined} />
        </div>
      </div>
      <div className="px-3 pb-4 pt-3">
        {!overview ? (
          <Skeleton className="h-[220px] w-full" />
        ) : summary && summary.total_tasks === 0 ? (
          <EmptyState compact icon={ListChecks} title="Nenhuma execução no período" description="As barras aparecem conforme as tasks forem criadas." />
        ) : (
          <>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={period === "1d" ? "25%" : "35%"}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval={period === "1d" ? 2 : "preserveStartEnd"} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(148,163,184,0.12)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    labelFormatter={(label) => (period === "1d" ? `${label}` : `Dia ${label}`)}
                  />
                  <Bar dataKey="Sucesso" stackId="a" fill={SUCCESS_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Erro" stackId="a" fill={ERROR_COLOR} />
                  <Bar dataKey="Outras" stackId="a" fill={OTHER_COLOR} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 px-2 text-xs text-slate-500">
              <LegendDot color={SUCCESS_COLOR} label="Sucesso" />
              <LegendDot color={ERROR_COLOR} label="Erro, timeout ou parada forçada" />
              <LegendDot color={OTHER_COLOR} label="Na fila, rodando ou cancelada" />
              <span className="ml-auto">Horário de Brasília</span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, color, hint }: { label: string; value?: number | string; color?: string; hint?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" title={hint}>
      <span className={cn("text-lg font-semibold tabular-nums text-slate-900", color)}>{value ?? EMPTY}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// ------------------------------------------------------------------ Máquinas e bots

function CardError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="px-5 py-4">
      <QueryError error={error} what="estes dados" onRetry={onRetry} />
    </div>
  );
}

function RunnersCard({ items, loading, error, onRetry }: { items?: DashboardRunnerMetrics[]; loading: boolean; error: unknown; onRetry: () => void }) {
  const navigate = useNavigate();
  // Máquinas com problema primeiro, depois as mais usadas.
  const rows = useMemo(() => {
    const order = (r: DashboardRunnerMetrics) => (r.status === "offline" || r.status === "blocked" ? 0 : r.status === "maintenance" ? 1 : 2);
    return [...(items ?? [])].sort((a, b) => order(a) - order(b) || b.total_tasks - a.total_tasks).slice(0, MAX_ROWS);
  }, [items]);

  return (
    <section className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>Máquinas</h2>
        <Link to="/runners" className="text-xs font-medium text-blue-600 hover:underline">
          Ver todas{items ? ` (${items.length})` : ""}
        </Link>
      </div>
      {error ? (
        <CardError error={error} onRetry={onRetry} />
      ) : loading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={Server} title="Nenhuma máquina cadastrada" />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Máquina</th>
                <th className={table.th}>Estado</th>
                <th className={cn(table.th, "text-right")}>Rodando</th>
                <th className={table.th}>Sucesso / falha</th>
                <th className={cn(table.th, "hidden 2xl:table-cell")}>Uso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((runner) => {
                const status = runnerStatus(runner.status);
                return (
                  <tr key={runner.runner_id} className={table.trClickable} onClick={() => navigate(`/runners/${runner.runner_id}`)}>
                    <td className={cn(table.tdStrong, "py-2.5")}>
                      <span className="block truncate" title={runner.runner_name}>
                        {runner.runner_label || runner.runner_name}
                      </span>
                      {runner.last_heartbeat && <span className="block text-xs font-normal text-slate-500">visto {formatRelative(runner.last_heartbeat)}</span>}
                    </td>
                    <td className={cn(table.td, "py-2.5")}>
                      <span className={cn(badge, "whitespace-nowrap", tone[status.tone])}>{status.label}</span>
                    </td>
                    <td className={cn(table.td, "py-2.5 text-right tabular-nums")}>{runner.running_tasks}</td>
                    <td className={cn(table.td, "py-2.5")}>
                      <SuccessErrorBar success={runner.success_tasks} error={runner.error_tasks} />
                    </td>
                    <td className={cn(table.td, "hidden py-2.5 2xl:table-cell")}>
                      <UsageBar percent={runner.utilization_percent} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BotsCard({ items, loading, error, onRetry }: { items?: DashboardBotMetrics[]; loading: boolean; error: unknown; onRetry: () => void }) {
  const navigate = useNavigate();
  // Bots com mais falhas primeiro; depois os mais executados.
  const rows = useMemo(
    () =>
      [...(items ?? [])]
        .filter((b) => b.total_tasks > 0)
        .sort((a, b) => b.error_tasks - a.error_tasks || b.total_tasks - a.total_tasks)
        .slice(0, MAX_ROWS),
    [items]
  );

  return (
    <section className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>Bots no período</h2>
        <Link to="/automations/health" className="text-xs font-medium text-blue-600 hover:underline">
          Ver saúde das automações
        </Link>
      </div>
      {error ? (
        <CardError error={error} onRetry={onRetry} />
      ) : loading ? (
        <TableSkeleton rows={4} columns={4} />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={ListChecks} title="Nenhum bot executou no período" />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Bot</th>
                <th className={cn(table.th, "text-right")}>Tasks</th>
                <th className={table.th}>Sucesso / falha</th>
                <th className={cn(table.th, "hidden 2xl:table-cell")}>Média</th>
                <th className={table.th}>Última</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((bot) => (
                <tr key={bot.bot_id} className={table.trClickable} onClick={() => navigate(`/bots/${bot.bot_id}`)}>
                  <td className={cn(table.tdStrong, "py-2.5")}>
                    <span className="block max-w-[180px] truncate" title={bot.bot_name}>
                      {bot.bot_name}
                    </span>
                  </td>
                  <td className={cn(table.td, "py-2.5 text-right tabular-nums")}>{bot.total_tasks}</td>
                  <td className={cn(table.td, "py-2.5")}>
                    <SuccessErrorBar success={bot.success_tasks} error={bot.error_tasks} />
                  </td>
                  <td className={cn(table.tdMuted, "hidden py-2.5 tabular-nums 2xl:table-cell")}>{formatDuration(Math.round(bot.avg_execution_seconds))}</td>
                  <td className={cn(table.td, "py-2.5")}>
                    {isTaskStatus(bot.last_execution_status) ? <StatusBadge status={bot.last_execution_status} compact /> : EMPTY}
                    {bot.last_execution_at && <span className="block whitespace-nowrap text-xs text-slate-500">{formatTimeSmart(bot.last_execution_at)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Barra verde/vermelha com os números ao lado: dá para ver a proporção sem ler. */
function SuccessErrorBar({ success, error }: { success: number; error: number }) {
  const total = success + error;
  const successPct = total > 0 ? (success / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200">
        {total > 0 && (
          <div className="flex h-full">
            <div className="h-full bg-emerald-500" style={{ width: `${successPct}%` }} />
            <div className="h-full bg-red-500" style={{ width: `${100 - successPct}%` }} />
          </div>
        )}
      </div>
      <span className="whitespace-nowrap text-xs tabular-nums text-slate-600">
        <span className="font-medium text-emerald-700">{success}</span>
        <span className="text-slate-400"> / </span>
        <span className={cn("font-medium", error > 0 ? "text-red-700" : "text-slate-500")}>{error}</span>
      </span>
    </div>
  );
}

function UsageBar({ percent }: { percent: number }) {
  const safe = clampPercent(percent);
  return (
    <div className="flex items-center gap-2" title="Tempo executando dividido pelo tempo do período">
      <div className="h-2 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", safe >= 80 ? "bg-amber-500" : "bg-blue-500")} style={{ width: `${safe}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{Math.round(safe)}%</span>
    </div>
  );
}

// ------------------------------------------------------------------ Últimas execuções

function RecentCard({ items, loading }: { items?: DashboardRecentTaskItem[]; loading: boolean }) {
  const navigate = useNavigate();
  const rows = (items ?? []).slice(0, 10);

  return (
    <section className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>Últimas execuções</h2>
        <Link to="/tasks" className="text-xs font-medium text-blue-600 hover:underline">
          Ver todas as tasks
        </Link>
      </div>
      {loading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : rows.length === 0 ? (
        <EmptyState compact icon={CheckCircle2} title="Nenhuma execução no período" />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Estado</th>
                <th className={table.th}>Automação</th>
                <th className={table.th}>Máquina</th>
                <th className={table.th}>Quando</th>
                <th className={table.th}>Duração</th>
                <th className={table.th}>Mensagem final</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => (
                <tr key={task.task_id} className={table.trClickable} onClick={() => navigate(`/tasks/${task.task_id}`)}>
                  <td className={cn(table.td, "py-2.5")}>{isTaskStatus(task.status) ? <StatusBadge status={task.status} /> : task.status}</td>
                  <td className={cn(table.tdStrong, "py-2.5")}>
                    <span className="block max-w-[260px] truncate" title={task.automation_name ?? undefined}>
                      {task.automation_name ?? task.bot_name ?? EMPTY}
                    </span>
                    <span className="block text-xs font-normal text-slate-500">#{task.task_id}</span>
                  </td>
                  <td className={cn(table.tdMuted, "whitespace-nowrap py-2.5")}>{task.runner_name ?? EMPTY}</td>
                  <td className={cn(table.tdMuted, "py-2.5 whitespace-nowrap")}>{formatTimeSmart(task.finished_at ?? task.started_at ?? task.created_at)}</td>
                  <td className={cn(table.tdMuted, "py-2.5 tabular-nums")}>{task.execution_duration_seconds != null ? formatDuration(task.execution_duration_seconds) : EMPTY}</td>
                  <td className={cn(table.tdMuted, "py-2.5")}>
                    <span className="block max-w-[320px] truncate" title={task.final_message ?? undefined}>
                      {task.final_message ?? EMPTY}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
