import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Cpu, HardDrive, Monitor, Pencil, Server, Timer, UserRound, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { getRunnerHealth } from "@/lib/health";
import { RunnerBadges, RunnerHeartbeatText } from "@/components/common/runner-badges";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { getRunner, getRunnerOverview, updateRunner, type RunnerOverviewTaskItem, type RunnerRead } from "@/services/api/runners";
import type { TaskStatus } from "@/services/api/tasks";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY, formatDateTime, formatDuration, formatTimeSmart } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, input, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";

const REFRESH_MS = 10_000;
const SUCCESS_COLOR = "#059669"; // emerald-600
const ERROR_COLOR = "#dc2626"; // red-600
const NEUTRAL_COLOR = "#94a3b8"; // slate-400
const BRAND_COLOR = "#2563eb"; // blue-600

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

function formatRunnerStatus(status?: string) {
  switch (status) {
    case "online":
      return "ONLINE";
    case "busy":
      return "OCUPADO";
    case "offline":
      return "OFFLINE";
    case "maintenance":
      return "MANUTENÇÃO";
    case "blocked":
      return "BLOQUEADO";
    default:
      return (status ?? "").toUpperCase() || EMPTY;
  }
}

function getRunnerStatusTone(runner: RunnerRead): keyof typeof tone {
  const health = getRunnerHealth(runner);
  if (health.disabled || health.noSignal) return "danger";
  if (health.maintenance) return "warning";
  if (runner.status === "busy") return "info";
  if (runner.status === "online") return "success";
  return "neutral";
}

const SERIES_LABEL: Record<string, string> = {
  sucesso: "Sucesso",
  erro: "Erro",
};

function toChartNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatBytes(value?: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) return EMPTY;
  const gb = value / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = value / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function getExecutionSeconds(task: RunnerOverviewTaskItem) {
  if (typeof task.execution_duration_seconds === "number") return task.execution_duration_seconds;
  if (task.started_at && task.finished_at) {
    return Math.max(0, (new Date(task.finished_at).getTime() - new Date(task.started_at).getTime()) / 1000);
  }
  return 0;
}

function getQueueSeconds(task: RunnerOverviewTaskItem) {
  if (task.created_at && task.started_at) {
    return Math.max(0, (new Date(task.started_at).getTime() - new Date(task.created_at).getTime()) / 1000);
  }
  return 0;
}

function isSuccessStatus(status?: string) {
  return status === "finished";
}

function isErrorStatus(status?: string) {
  return status === "error" || status === "timeout" || status === "forced_stop";
}

/**
 * Detalhe da máquina. Ordem pelo que a pessoa vem procurar: quem é a máquina e com que usuário
 * entrar nela (topo), o que está rodando, o histórico, e só então ambiente e configuração.
 */
export function RunnerDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const runnerId = Number(params.runnerId);

  const isValidRunnerId = Number.isFinite(runnerId) && runnerId > 0;

  const runnerQuery = useQuery({
    queryKey: ["runner", runnerId],
    queryFn: () => getRunner(runnerId),
    enabled: isValidRunnerId,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const overviewQuery = useQuery({
    queryKey: ["runner-overview", runnerId],
    queryFn: () => getRunnerOverview(runnerId),
    enabled: isValidRunnerId,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const isLoading = runnerQuery.isLoading || overviewQuery.isLoading;
  const isFetching = runnerQuery.isFetching || overviewQuery.isFetching;

  const runner = runnerQuery.data;
  const overview = overviewQuery.data;

  function refetchAll() {
    runnerQuery.refetch();
    overviewQuery.refetch();
  }

  const recentTasks = useMemo(() => overview?.recent_tasks ?? [], [overview]);

  const tasksByTimeData = useMemo(() => {
    return [...recentTasks].reverse().map((task) => ({
      label: formatTimeSmart(task.created_at),
      fullLabel: formatDateTime(task.created_at),
      sucesso: isSuccessStatus(task.status) ? 1 : 0,
      erro: isErrorStatus(task.status) ? 1 : 0,
      taskId: task.task_id,
    }));
  }, [recentTasks]);

  const averageTimesData = useMemo(() => {
    if (recentTasks.length === 0) {
      return [
        { name: "Fila", segundos: 0 },
        { name: "Execução", segundos: 0 },
      ];
    }
    const queueTimes = recentTasks.map(getQueueSeconds);
    const executionTimes = recentTasks.map(getExecutionSeconds);
    const avgQueue = queueTimes.reduce((acc, value) => acc + value, 0) / queueTimes.length;
    const avgExecution = executionTimes.reduce((acc, value) => acc + value, 0) / executionTimes.length;
    return [
      { name: "Fila", segundos: Math.round(avgQueue) },
      { name: "Execução", segundos: Math.round(avgExecution) },
    ];
  }, [recentTasks]);

  const statusSummaryData = useMemo(() => {
    const sucesso = recentTasks.filter((task) => isSuccessStatus(task.status)).length;
    const erro = recentTasks.filter((task) => isErrorStatus(task.status)).length;
    const outros = Math.max(0, recentTasks.length - sucesso - erro);
    return [
      { name: "Sucesso", total: sucesso },
      { name: "Erro", total: erro },
      { name: "Outros", total: outros },
    ];
  }, [recentTasks]);

  if (!isValidRunnerId) {
    return (
      <section className={card}>
        <PageHeader title="Runner" backTo="/runners" backLabel="Voltar para runners" />
        <div className={cardBody}>
          <EmptyState icon={Server} title="Runner inválido" description="O endereço não aponta para um runner existente." />
        </div>
      </section>
    );
  }

  const error = runnerQuery.error ?? overviewQuery.error;
  const isError = runnerQuery.isError || overviewQuery.isError;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title={runner?.label || runner?.name || "Runner"}
          description={runner?.label && runner.label !== runner.name ? runner.name : "Status, o que está rodando e o histórico recente desta máquina."}
          backTo="/runners"
          backLabel="Voltar para runners"
          meta={
            runner ? (
              <span className={cn(badge, tone[getRunnerStatusTone(runner)])}>
                {getRunnerHealth(runner).noSignal ? "SEM SINAL" : formatRunnerStatus(runner.status)}
              </span>
            ) : null
          }
          actions={
            <>
              <RefreshIndicator
                updatedAt={Math.max(runnerQuery.dataUpdatedAt, overviewQuery.dataUpdatedAt)}
                isFetching={isFetching}
                onRefresh={refetchAll}
                intervalMs={REFRESH_MS}
              />
              <button type="button" className={btn.primary} onClick={() => navigate(`/runner-configs/${runnerId}/edit`)}>
                <Pencil className="h-4 w-4" />
                Editar configuração
              </button>
            </>
          }
        />

        {isLoading ? (
          <div className={cardBody}>
            <DetailSkeleton fields={8} />
          </div>
        ) : isError || !runner || !overview ? (
          <div className={cardBody}>
            <QueryError error={error} what="os dados do runner" onRetry={refetchAll} retrying={isFetching} />
          </div>
        ) : (
          <div className={cardBody}>
            <div className="flex flex-wrap items-center gap-2">
              <RunnerBadges runner={runner} />
              <span className="text-xs">
                <RunnerHeartbeatText runner={runner} />
              </span>
            </div>

            {/* Quem é a máquina e com que usuário entrar nela: o que mais se procura aqui. */}
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LoginUserCard runner={runner} />
              <FactCard icon={Monitor} label="Usuário do Windows (worker)" value={runner.os_user || EMPTY} hint={runner.os_user ? "Informado pelo worker" : "O worker informa ao enviar sinal"} />
              <FactCard icon={Server} label="Host · IP" value={`${runner.host_name || EMPTY}${runner.ip ? ` · ${runner.ip}` : ""}`} />
              <FactCard icon={HardDrive} label="Sistema" value={[runner.os_name, runner.os_version].filter(Boolean).join(" ") || EMPTY} hint={[runner.cpu_arch, formatBytes(runner.memory_total) !== EMPTY ? formatBytes(runner.memory_total) : null].filter(Boolean).join(" · ") || undefined} />
            </div>
          </div>
        )}
      </section>

      {!isLoading && !isError && runner && overview ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Timer} label="Tasks em execução" value={String(overview.summary.running_tasks_count ?? 0)} />
            <MetricCard icon={Server} label="Tasks em espera" value={String(overview.summary.waiting_tasks_count ?? 0)} />
            <MetricCard icon={Bot} label="Bots vinculados" value={String(overview.summary.linked_bots_count ?? 0)} />
            <MetricCard icon={Cpu} label="Utilização" value={`${overview.utilization.utilization_percent ?? 0}%`} />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Panel title="Rodando agora">
                <TaskList tasks={overview.running_tasks} emptyText="Nenhuma task em execução nesta máquina." />
              </Panel>

              <Panel title="Última execução">
                <InfoGrid columns={3}>
                  <InfoItem label="Task">
                    {overview.last_execution.task_id != null ? (
                      <button
                        type="button"
                        className="font-medium text-blue-600 hover:underline"
                        onClick={() => navigate(`/tasks/${overview.last_execution.task_id}`)}
                      >
                        #{overview.last_execution.task_id}
                      </button>
                    ) : (
                      EMPTY
                    )}
                  </InfoItem>
                  <InfoItem label="Automação">{overview.last_execution.automation_name || EMPTY}</InfoItem>
                  <InfoItem label="Status">
                    {isTaskStatus(overview.last_execution.status) ? <StatusBadge status={overview.last_execution.status} /> : EMPTY}
                  </InfoItem>
                  <InfoItem label="Início">{formatDateTime(overview.last_execution.started_at)}</InfoItem>
                  <InfoItem label="Fim">{formatDateTime(overview.last_execution.finished_at)}</InfoItem>
                  <InfoItem label="Duração">{formatDuration(overview.last_execution.execution_duration_seconds)}</InfoItem>
                  <InfoItem label="Mensagem final" className="md:col-span-3">
                    {overview.last_execution.final_message || EMPTY}
                  </InfoItem>
                </InfoGrid>
              </Panel>

              <Panel title="Últimas tasks">
                <TaskList tasks={overview.recent_tasks} emptyText="Nenhuma task recente nesta máquina." />
              </Panel>
            </div>

            <div className="space-y-5">
              <Panel title="Fila e execução">
                <InfoGrid>
                  <InfoItem label="Tasks executadas">{String(overview.summary.executed_total_count ?? 0)}</InfoItem>
                  <InfoItem label="Tempo executando">{formatDuration(overview.utilization.execution_seconds)}</InfoItem>
                  <InfoItem label="Com sucesso">{String(overview.summary.success_total_count ?? 0)}</InfoItem>
                  <InfoItem label="Com erro">{String(overview.summary.error_total_count ?? 0)}</InfoItem>
                  <InfoItem label="Mais antiga na fila">
                    {overview.queue.oldest_waiting_task_id != null ? `#${overview.queue.oldest_waiting_task_id}` : EMPTY}
                  </InfoItem>
                  <InfoItem label="Esperando há">{formatDuration(overview.queue.oldest_waiting_seconds)}</InfoItem>
                </InfoGrid>
              </Panel>

              <Panel title="Configuração">
                <InfoGrid>
                  <InfoItem label="Concorrência máxima">{String(runner.config?.max_concurrency ?? EMPTY)}</InfoItem>
                  <InfoItem label="Intervalo de polling">
                    {runner.config?.polling_interval != null ? `${runner.config.polling_interval}s` : EMPTY}
                  </InfoItem>
                  <InfoItem label="Atualiza bots sozinho">{runner.config?.auto_update_bots ? "Sim" : "Não"}</InfoItem>
                  <InfoItem label="Instala todos ao registrar">{runner.config?.install_all_bots_on_register ? "Sim" : "Não"}</InfoItem>
                  <InfoItem label="Modo manutenção">
                    <span className={cn(badge, runner.config?.maintenance_mode ? tone.warning : tone.neutral)}>
                      {runner.config?.maintenance_mode ? "Ligado" : "Desligado"}
                    </span>
                  </InfoItem>
                  <InfoItem label="Acesso remoto">{runner.access_remote ? "Sim" : "Não"}</InfoItem>
                </InfoGrid>
              </Panel>

              <Panel title="Bots vinculados">
                {overview.linked_bots.length === 0 ? (
                  <EmptyState compact icon={Bot} title="Nenhum bot vinculado" />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {overview.linked_bots.map((bot) => (
                      <li key={bot.bot_id} className="flex items-center justify-between py-2">
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-900 hover:text-blue-700 hover:underline"
                          onClick={() => navigate(`/bots/${bot.bot_id}`)}
                        >
                          {bot.bot_name || `Bot ${bot.bot_id}`}
                        </button>
                        <span className="text-xs text-slate-500">ID {bot.bot_id}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </div>

          <Panel title="Indicadores das últimas tasks" subtitle="Calculados só com as tasks listadas em “Últimas tasks”.">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <ChartCard title="Tasks por horário" subtitle="Sucesso e erro por task">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksByTimeData}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: unknown, name: unknown) => [toChartNumber(value), SERIES_LABEL[String(name)] ?? String(name)]}
                        labelFormatter={(label, payload) => {
                          const item = payload?.[0]?.payload as { fullLabel?: string; taskId?: number } | undefined;
                          return item ? `Task #${item.taskId} · ${item.fullLabel}` : String(label);
                        }}
                      />
                      <Legend formatter={(value) => SERIES_LABEL[String(value)] ?? String(value)} />
                      <Bar dataKey="sucesso" name="sucesso" stackId="tasks" fill={SUCCESS_COLOR} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="erro" name="erro" stackId="tasks" fill={ERROR_COLOR} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Tempo médio" subtitle="Na fila e em execução">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={averageTimesData}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: unknown) => [formatDuration(toChartNumber(value)), "Tempo médio"]} />
                      <Bar dataKey="segundos" name="Tempo médio" radius={[2, 2, 0, 0]}>
                        {averageTimesData.map((entry) => (
                          <Cell key={entry.name} fill={entry.name === "Fila" ? NEUTRAL_COLOR : BRAND_COLOR} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Resultado das últimas tasks" subtitle="Sucesso, erro e outros">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusSummaryData}>
                      <CartesianGrid vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: unknown) => [toChartNumber(value), "Quantidade"]} />
                      <Bar dataKey="total" name="Quantidade" radius={[2, 2, 0, 0]}>
                        {statusSummaryData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === "Sucesso" ? SUCCESS_COLOR : entry.name === "Erro" ? ERROR_COLOR : NEUTRAL_COLOR}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </Panel>

          <details className={cn(card, "group")}>
            <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
              Detalhes técnicos
            </summary>
            <div className="border-t border-slate-100 px-5 py-5">
              <InfoGrid columns={3}>
                <InfoItem label="ID">{String(runner.id)}</InfoItem>
                <InfoItem label="UUID">
                  <span className="break-all font-mono text-xs">{runner.uuid}</span>
                </InfoItem>
                <InfoItem label="Nome no painel">{runner.name}</InfoItem>
                <InfoItem label="Último heartbeat">{formatDateTime(runner.last_heartbeat)}</InfoItem>
                <InfoItem label="Criado em">{formatDateTime(runner.created_at)}</InfoItem>
                <InfoItem label="Atualizado em">{formatDateTime(runner.updated_at)}</InfoItem>
              </InfoGrid>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

/** Usuário com que a equipe entra na máquina. Edita ali mesmo: lápis, digita, confirma. */
function LoginUserCard({ runner }: { runner: RunnerRead }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(runner.login_user ?? "");

  const mutation = useMutation({
    mutationFn: (login_user: string | null) => updateRunner(runner.id, { login_user }),
    onSuccess: async () => {
      toast.success("Usuário da máquina salvo.");
      setEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["runner", runner.id] });
      await queryClient.invalidateQueries({ queryKey: ["runners"] });
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível salvar o usuário.", error));
    },
  });

  function startEdit() {
    setValue(runner.login_user ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = value.trim();
    mutation.mutate(trimmed || null);
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-blue-800">
          <UserRound className="h-3.5 w-3.5" />
          Usuário de acesso
        </span>
        {!editing ? (
          <button type="button" onClick={startEdit} className={cn(btn.icon, "h-7 w-7 border-0 text-blue-700 hover:bg-blue-100")} aria-label="Editar usuário de acesso">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {editing ? (
        <form
          className="mt-1.5 flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={cn(input, "h-8 text-sm")}
            placeholder="Ex.: ALZ\rpa.suprimentos"
            maxLength={150}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <button type="submit" disabled={mutation.isPending} className={cn(btn.icon, "h-8 w-8 border-emerald-300 text-emerald-700")} aria-label="Salvar usuário">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" disabled={mutation.isPending} onClick={() => setEditing(false)} className={cn(btn.icon, "h-8 w-8")} aria-label="Cancelar">
            <X className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <>
          <p className={cn("mt-1 truncate text-base font-semibold", runner.login_user ? "text-slate-900" : "text-slate-500")} title={runner.login_user ?? undefined}>
            {runner.login_user || "Não cadastrado"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Com quem entrar nesta máquina</p>
        </>
      )}
    </div>
  );
}

function FactCard({ icon: Icon, label, value, hint }: { icon: typeof Server; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <p className="mt-1 truncate text-base font-semibold text-slate-900" title={value}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className={cn(card, "px-4 py-4")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className={card}>
      <div className={cardHeader}>
        <div>
          <h2 className={cardTitle}>{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs normal-case tracking-normal text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", columns === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>{children}</dl>;
}

function InfoItem({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function TaskList({ tasks, emptyText }: { tasks: RunnerOverviewTaskItem[]; emptyText: string }) {
  const navigate = useNavigate();

  if (tasks.length === 0) {
    return <EmptyState compact title={emptyText} />;
  }

  return (
    <div className={table.wrap}>
      <table className={table.table}>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Task</th>
            <th className={table.th}>Automação</th>
            <th className={table.th}>Status</th>
            <th className={table.th}>Criada em</th>
            <th className={table.th}>Início</th>
            <th className={table.th}>Fim</th>
            <th className={table.th}>Duração</th>
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => (
            <tr key={task.task_id} className={table.trClickable} onClick={() => navigate(`/tasks/${task.task_id}`)}>
              <td className={table.tdStrong}>#{task.task_id}</td>
              <td className={table.td}>
                <span className={table.truncate} title={task.automation_name ?? undefined}>
                  {task.automation_name || EMPTY}
                </span>
              </td>
              <td className={table.td}>{isTaskStatus(task.status) ? <StatusBadge status={task.status} /> : task.status}</td>
              <td className={table.tdMuted}>{formatDateTime(task.created_at)}</td>
              <td className={table.tdMuted}>{formatDateTime(task.started_at)}</td>
              <td className={table.tdMuted}>{formatDateTime(task.finished_at)}</td>
              <td className={table.td}>{formatDuration(task.execution_duration_seconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
