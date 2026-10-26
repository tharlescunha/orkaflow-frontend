import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, Clock3, Filter, ListTodo, Pencil, Server } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { getRunnerOverview, type RunnerOverviewTaskItem } from "@/services/api/runners";
import type { TaskStatus } from "@/services/api/tasks";
import { EMPTY, formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, input, label, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

const REFRESH_MS = 10_000;

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
  return Boolean(status) && TASK_STATUSES.includes(status as TaskStatus);
}

function formatMemory(value?: number | null) {
  if (value === null || value === undefined) return EMPTY;
  const gb = value / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatRunnerStatus(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "busy":
      return "Ocupado";
    case "maintenance":
      return "Manutenção";
    case "blocked":
      return "Bloqueado";
    default:
      return status || EMPTY;
  }
}

function getRunnerStatusTone(status?: string | null): keyof typeof tone {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "success";
    case "busy":
      return "info";
    case "maintenance":
      return "warning";
    case "blocked":
    case "offline":
      return "danger";
    default:
      return "neutral";
  }
}

type FiltersState = {
  date_from: string;
  date_to: string;
  task_status: string;
  automation_id: string;
};

const INITIAL_FILTERS: FiltersState = {
  date_from: "",
  date_to: "",
  task_status: "",
  automation_id: "",
};

export function RunnerConfigDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ runnerId: string }>();
  const runnerId = Number(params.runnerId);
  const isValidRunnerId = Number.isFinite(runnerId) && runnerId > 0;

  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(INITIAL_FILTERS);

  const queryParams = useMemo(() => {
    return {
      date_from: appliedFilters.date_from || undefined,
      date_to: appliedFilters.date_to || undefined,
      task_status: appliedFilters.task_status || undefined,
      automation_id: appliedFilters.automation_id ? Number(appliedFilters.automation_id) : undefined,
    };
  }, [appliedFilters]);

  const overviewQuery = useQuery({
    queryKey: ["runner-overview-detail", runnerId, queryParams],
    queryFn: () => getRunnerOverview(runnerId, queryParams),
    enabled: isValidRunnerId,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const overview = overviewQuery.data;
  const runner = overview?.runner;
  const summary = overview?.summary;
  const utilization = overview?.utilization;
  const queue = overview?.queue;
  const lastExecution = overview?.last_execution;
  const linkedBots = overview?.linked_bots ?? [];
  const runningTasks = overview?.running_tasks ?? [];
  const recentTasks = overview?.recent_tasks ?? [];

  const hasAppliedFilters = Object.values(appliedFilters).some(Boolean);

  function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
  }

  if (!isValidRunnerId) {
    return (
      <section className={card}>
        <PageHeader title="Runner" backTo="/runner-configs" backLabel="Voltar para runners" />
        <div className={cardBody}>
          <EmptyState icon={Server} title="Runner inválido" description="O endereço não aponta para um runner existente." />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title={runner?.name ?? `Runner #${runnerId}`}
          description="Visão operacional do runner: utilização, fila e histórico de execução."
          backTo="/runner-configs"
          backLabel="Voltar para runners"
          meta={
            runner ? (
              <>
                <span className={cn(badge, tone[getRunnerStatusTone(runner.status)])}>{formatRunnerStatus(runner.status)}</span>
                <span className={cn(badge, runner.enabled ? tone.success : tone.neutral)}>{runner.enabled ? "Ativo" : "Inativo"}</span>
              </>
            ) : null
          }
          actions={
            <>
              <RefreshIndicator
                updatedAt={overviewQuery.dataUpdatedAt}
                isFetching={overviewQuery.isFetching}
                onRefresh={() => overviewQuery.refetch()}
                intervalMs={REFRESH_MS}
              />
              <button type="button" className={btn.primary} onClick={() => navigate(`/runner-configs/${runnerId}/edit`)}>
                <Pencil className="h-4 w-4" />
                Editar configuração
              </button>
            </>
          }
        />

        <div className={cardBody}>
          {overviewQuery.isLoading ? (
            <DetailSkeleton fields={8} />
          ) : overviewQuery.isError ? (
            <QueryError
              error={overviewQuery.error}
              what="os dados do runner"
              onRetry={() => overviewQuery.refetch()}
              retrying={overviewQuery.isFetching}
            />
          ) : overview ? (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Tasks em execução" value={summary?.running_tasks_count ?? 0} icon={Activity} />
                <MetricCard title="Tasks aguardando" value={summary?.waiting_tasks_count ?? 0} icon={ListTodo} />
                <MetricCard title="Bots vinculados" value={summary?.linked_bots_count ?? 0} icon={Bot} />
                <MetricCard title="Utilização" value={formatPercent(utilization?.utilization_percent)} icon={Clock3} />
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <Panel title="Última execução">
                  <InfoGrid>
                    <InfoItem label="Task">
                      {lastExecution?.task_id != null ? (
                        <button
                          type="button"
                          className="font-medium text-blue-600 hover:underline"
                          onClick={() => navigate(`/tasks/${lastExecution.task_id}`)}
                        >
                          #{lastExecution.task_id}
                        </button>
                      ) : (
                        EMPTY
                      )}
                    </InfoItem>
                    <InfoItem label="Automação">{lastExecution?.automation_name || EMPTY}</InfoItem>
                    <InfoItem label="Status">
                      {isTaskStatus(lastExecution?.status) ? <StatusBadge status={lastExecution.status} /> : EMPTY}
                    </InfoItem>
                    <InfoItem label="Duração">{formatDuration(lastExecution?.execution_duration_seconds)}</InfoItem>
                    <InfoItem label="Início">{formatDateTime(lastExecution?.started_at)}</InfoItem>
                    <InfoItem label="Fim">{formatDateTime(lastExecution?.finished_at)}</InfoItem>
                  </InfoGrid>
                </Panel>

                <Panel title="Fila">
                  <InfoGrid>
                    <InfoItem label="Tasks aguardando">{String(queue?.waiting_tasks_count ?? 0)}</InfoItem>
                    <InfoItem label="Task mais antiga">
                      {queue?.oldest_waiting_task_id != null ? `#${queue.oldest_waiting_task_id}` : EMPTY}
                    </InfoItem>
                    <InfoItem label="Automação mais antiga">{queue?.oldest_waiting_automation_name || EMPTY}</InfoItem>
                    <InfoItem label="Aguardando desde">{formatDateTime(queue?.oldest_waiting_since)}</InfoItem>
                    <InfoItem label="Tempo aguardando">{formatDuration(queue?.oldest_waiting_seconds)}</InfoItem>
                  </InfoGrid>
                </Panel>
              </section>

              <Panel title="Tasks em execução">
                <TasksTable tasks={runningTasks} emptyLabel="Nenhuma task em execução." />
              </Panel>

              <Panel
                title="Histórico de tasks"
                actions={
                  hasAppliedFilters ? (
                    <button type="button" className={cn(btn.ghost, btn.sm)} onClick={handleClearFilters}>
                      Limpar filtros
                    </button>
                  ) : null
                }
              >
                <form
                  className="mb-4 grid gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2 xl:grid-cols-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setAppliedFilters(filters);
                  }}
                >
                  <div>
                    <label htmlFor="filter-date-from" className={label}>
                      Data inicial
                    </label>
                    <input
                      id="filter-date-from"
                      type="datetime-local"
                      value={filters.date_from}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                      className={input}
                    />
                  </div>

                  <div>
                    <label htmlFor="filter-date-to" className={label}>
                      Data final
                    </label>
                    <input
                      id="filter-date-to"
                      type="datetime-local"
                      value={filters.date_to}
                      onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                      className={input}
                    />
                  </div>

                  <div>
                    <label htmlFor="filter-status" className={label}>
                      Status
                    </label>
                    <select
                      id="filter-status"
                      value={filters.task_status}
                      onChange={(e) => setFilters((prev) => ({ ...prev, task_status: e.target.value }))}
                      className={select}
                    >
                      <option value="">Todos</option>
                      <option value="waiting">Aguardando</option>
                      <option value="scheduled">Agendada</option>
                      <option value="ready">Pronta</option>
                      <option value="running">Executando</option>
                      <option value="stop_requested">Parada solicitada</option>
                      <option value="finished">Finalizada</option>
                      <option value="error">Erro</option>
                      <option value="timeout">Timeout</option>
                      <option value="canceled">Cancelada</option>
                      <option value="forced_stop">Parada forçada</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="filter-automation" className={label}>
                      ID da automação
                    </label>
                    <input
                      id="filter-automation"
                      type="number"
                      min={1}
                      value={filters.automation_id}
                      onChange={(e) => setFilters((prev) => ({ ...prev, automation_id: e.target.value }))}
                      placeholder="Ex.: 12"
                      className={input}
                    />
                  </div>

                  <div className="flex items-end">
                    <button type="submit" className={btn.secondary}>
                      <Filter className="h-4 w-4" />
                      Aplicar
                    </button>
                  </div>
                </form>

                <TasksTable tasks={recentTasks} emptyLabel="Nenhuma task encontrada." />
              </Panel>

              <section className="grid gap-6 xl:grid-cols-2">
                <Panel title="Bots vinculados">
                  {linkedBots.length === 0 ? (
                    <EmptyState compact icon={Bot} title="Nenhum bot vinculado" />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {linkedBots.map((bot) => (
                        <li key={bot.bot_id} className="flex items-center justify-between py-2">
                          <button
                            type="button"
                            className="text-sm font-medium text-slate-900 hover:text-blue-700 hover:underline"
                            onClick={() => navigate(`/bots/${bot.bot_id}`)}
                          >
                            {bot.bot_name || `Bot #${bot.bot_id}`}
                          </button>
                          <span className="text-xs text-slate-500">ID {bot.bot_id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Utilização">
                  <InfoGrid>
                    <InfoItem label="Tempo desde o cadastro">{formatDuration(utilization?.registered_seconds)}</InfoItem>
                    <InfoItem label="Tempo executando">{formatDuration(utilization?.execution_seconds)}</InfoItem>
                    <InfoItem label="Percentual de utilização">{formatPercent(utilization?.utilization_percent)}</InfoItem>
                  </InfoGrid>
                </Panel>
              </section>

              <Panel title="Contadores">
                <InfoGrid columns={4}>
                  <InfoItem label="Executando">{String(summary?.running_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Aguardando">{String(summary?.waiting_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Agendadas">{String(summary?.scheduled_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Prontas">{String(summary?.ready_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Parada solicitada">{String(summary?.stop_requested_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Finalizadas">{String(summary?.finished_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Com erro">{String(summary?.error_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Timeout">{String(summary?.timeout_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Canceladas">{String(summary?.canceled_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Parada forçada">{String(summary?.forced_stop_tasks_count ?? 0)}</InfoItem>
                  <InfoItem label="Executadas (total)">{String(summary?.executed_total_count ?? 0)}</InfoItem>
                  <InfoItem label="Sucesso (total)">{String(summary?.success_total_count ?? 0)}</InfoItem>
                </InfoGrid>
              </Panel>

              <details className={card}>
                <summary className="cursor-pointer select-none px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50">
                  Detalhes técnicos
                </summary>
                <div className="border-t border-slate-200 px-5 py-5">
                  <InfoGrid columns={4}>
                    <InfoItem label="ID">{String(runner?.id ?? runnerId)}</InfoItem>
                    <InfoItem label="UUID">
                      <span className="break-all font-mono text-xs">{runner?.uuid ?? EMPTY}</span>
                    </InfoItem>
                    <InfoItem label="Label">{runner?.label || EMPTY}</InfoItem>
                    <InfoItem label="Host">{runner?.host_name || EMPTY}</InfoItem>
                    <InfoItem label="IP">{runner?.ip || EMPTY}</InfoItem>
                    <InfoItem label="Sistema operacional">{runner?.os_name || EMPTY}</InfoItem>
                    <InfoItem label="Versão do SO">{runner?.os_version || EMPTY}</InfoItem>
                    <InfoItem label="Arquitetura">{runner?.cpu_arch || EMPTY}</InfoItem>
                    <InfoItem label="Memória total">{formatMemory(runner?.memory_total)}</InfoItem>
                    <InfoItem label="Acesso remoto">{runner?.access_remote ? "Sim" : "Não"}</InfoItem>
                    <InfoItem label="Último heartbeat">{formatDateTime(runner?.last_heartbeat)}</InfoItem>
                    <InfoItem label="Criado em">{formatDateTime(runner?.created_at)}</InfoItem>
                  </InfoGrid>
                </div>
              </details>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function MetricCard({ title, value, icon: Icon }: { title: string; value: ReactNode; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className={cn(card, "px-5 py-4")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      </div>
    </div>
  );
}

function InfoGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 4 }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", columns === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2")}>{children}</dl>
  );
}

function InfoItem({ label: text, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{text}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function TasksTable({ tasks, emptyLabel }: { tasks: RunnerOverviewTaskItem[]; emptyLabel: string }) {
  const navigate = useNavigate();

  if (tasks.length === 0) {
    return <EmptyState compact title={emptyLabel} />;
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
            <th className={table.th}>Mensagem final</th>
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
              <td className={table.tdMuted}>
                <span className="block max-w-[320px] truncate" title={task.final_message ?? undefined}>
                  {task.final_message || EMPTY}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
