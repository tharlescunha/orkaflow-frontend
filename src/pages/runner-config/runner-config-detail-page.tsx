import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  RefreshCcw,
  Server,
  Clock3,
  Activity,
  Bot,
  ListTodo,
  Filter,
  X,
} from "lucide-react";

import {
  getRunnerOverview,
  type RunnerOverviewTaskItem,
} from "@/services/api/runners";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "---";

  if (seconds < 60) return `${seconds}s`;

  const totalMinutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (totalMinutes < 60) {
    return remainingSeconds > 0
      ? `${totalMinutes}m ${remainingSeconds}s`
      : `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "---";
  return `${value.toFixed(2)}%`;
}

function formatMemory(value?: number | null) {
  if (value === null || value === undefined) return "---";
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
      return status || "---";
  }
}

function formatTaskStatus(status?: string | null) {
  switch ((status || "").toLowerCase()) {
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
    case "finished":
      return "Finalizada";
    case "error":
      return "Erro";
    case "timeout":
      return "Timeout";
    case "canceled":
      return "Cancelada";
    case "forced_stop":
      return "Parada forçada";
    default:
      return status || "---";
  }
}

function getTaskStatusBadgeClass(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "running":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "finished":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
    case "timeout":
      return "border-red-200 bg-red-50 text-red-700";
    case "waiting":
    case "scheduled":
    case "ready":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "canceled":
    case "forced_stop":
    case "stop_requested":
      return "border-slate-200 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
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

  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FiltersState>(INITIAL_FILTERS);

  const queryParams = useMemo(() => {
    return {
      date_from: appliedFilters.date_from || undefined,
      date_to: appliedFilters.date_to || undefined,
      task_status: appliedFilters.task_status || undefined,
      automation_id: appliedFilters.automation_id
        ? Number(appliedFilters.automation_id)
        : undefined,
    };
  }, [appliedFilters]);

  const overviewQuery = useQuery({
    queryKey: ["runner-overview-detail", runnerId, queryParams],
    queryFn: () => getRunnerOverview(runnerId, queryParams),
    enabled: Number.isFinite(runnerId) && runnerId > 0,
    refetchInterval: 10000,
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

  function handleRefresh() {
    overviewQuery.refetch();
  }

  function handleApplyFilters() {
    setAppliedFilters(filters);
  }

  function handleClearFilters() {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
  }

  if (!Number.isFinite(runnerId) || runnerId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de runner inválido.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/runner-configs")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para runners
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes do Runner #{runnerId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visão operacional completa do runner, utilização e histórico de execução.
              </p>
            </div>

            <div className="flex items-center gap-3">
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

        <div className="px-6 py-6">
          {overviewQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando runner...</p>
          ) : overviewQuery.isError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados do runner.
            </div>
          ) : overview ? (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-slate-50/60">
                <div className="border-b border-slate-200 px-5 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-5">
                  <Field label="Data inicial">
                    <input
                      type="datetime-local"
                      value={filters.date_from}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                    />
                  </Field>

                  <Field label="Data final">
                    <input
                      type="datetime-local"
                      value={filters.date_to}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, date_to: e.target.value }))
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                    />
                  </Field>

                  <Field label="Status">
                    <select
                      value={filters.task_status}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, task_status: e.target.value }))
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
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
                  </Field>

                  <Field label="ID da automação">
                    <input
                      type="number"
                      min={1}
                      value={filters.automation_id}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          automation_id: e.target.value,
                        }))
                      }
                      placeholder="Ex: 12"
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-950"
                    />
                  </Field>

                  <div className="flex items-end gap-3">
                    <button
                      type="button"
                      onClick={handleApplyFilters}
                      className="inline-flex h-10 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      <Filter className="h-4 w-4" />
                      Aplicar
                    </button>

                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="inline-flex h-10 items-center justify-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      Limpar
                    </button>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="Tasks em execução"
                  value={summary?.running_tasks_count}
                  icon={Activity}
                />
                <MetricCard
                  title="Tasks aguardando"
                  value={summary?.waiting_tasks_count}
                  icon={ListTodo}
                />
                <MetricCard
                  title="Bots vinculados"
                  value={summary?.linked_bots_count}
                  icon={Bot}
                />
                <MetricCard
                  title="Utilização"
                  value={formatPercent(utilization?.utilization_percent)}
                  icon={Clock3}
                />
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo do runner
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="Nome" value={runner?.name} />
                  <InfoItem label="Label" value={runner?.label || "---"} />
                  <InfoItem label="Status" value={formatRunnerStatus(runner?.status)} />
                  <InfoItem label="Ativo" value={runner?.enabled ? "Sim" : "Não"} />
                  <InfoItem label="UUID" value={runner?.uuid} />
                  <InfoItem label="Host name" value={runner?.host_name || "---"} />
                  <InfoItem label="IP" value={runner?.ip || "---"} />
                  <InfoItem label="Criado em" value={formatDateTime(runner?.created_at)} />
                  <InfoItem
                    label="Último heartbeat"
                    value={formatDateTime(runner?.last_heartbeat)}
                  />
                  <InfoItem label="Sistema operacional" value={runner?.os_name || "---"} />
                  <InfoItem label="Versão do SO" value={runner?.os_version || "---"} />
                  <InfoItem label="Arquitetura CPU" value={runner?.cpu_arch || "---"} />
                  <InfoItem label="Memória total" value={formatMemory(runner?.memory_total)} />
                  <InfoItem
                    label="Acesso remoto"
                    value={runner?.access_remote ? "Sim" : "Não"}
                  />
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <div className="border border-slate-200 bg-white xl:col-span-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Utilização
                    </h2>
                  </div>

                  <div className="space-y-4 px-5 py-5">
                    <InfoItem
                      label="Tempo desde cadastro"
                      value={formatDuration(utilization?.registered_seconds)}
                    />
                    <InfoItem
                      label="Tempo executando"
                      value={formatDuration(utilization?.execution_seconds)}
                    />
                    <InfoItem
                      label="Percentual de utilização"
                      value={formatPercent(utilization?.utilization_percent)}
                    />
                  </div>
                </div>

                <div className="border border-slate-200 bg-white xl:col-span-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Última execução
                    </h2>
                  </div>

                  <div className="space-y-4 px-5 py-5">
                    <InfoItem label="Task ID" value={lastExecution?.task_id ?? "---"} />
                    <InfoItem
                      label="Automação"
                      value={lastExecution?.automation_name || "---"}
                    />
                    <InfoItem
                      label="Status"
                      value={
                        <StatusBadge status={lastExecution?.status}>
                          {formatTaskStatus(lastExecution?.status)}
                        </StatusBadge>
                      }
                    />
                    <InfoItem
                      label="Início"
                      value={formatDateTime(lastExecution?.started_at)}
                    />
                    <InfoItem
                      label="Fim"
                      value={formatDateTime(lastExecution?.finished_at)}
                    />
                    <InfoItem
                      label="Duração"
                      value={formatDuration(lastExecution?.execution_duration_seconds)}
                    />
                  </div>
                </div>

                <div className="border border-slate-200 bg-white xl:col-span-1">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Fila
                    </h2>
                  </div>

                  <div className="space-y-4 px-5 py-5">
                    <InfoItem
                      label="Tasks aguardando"
                      value={queue?.waiting_tasks_count ?? "---"}
                    />
                    <InfoItem
                      label="Task mais antiga"
                      value={queue?.oldest_waiting_task_id ?? "---"}
                    />
                    <InfoItem
                      label="Automação mais antiga"
                      value={queue?.oldest_waiting_automation_name || "---"}
                    />
                    <InfoItem
                      label="Aguardando desde"
                      value={formatDateTime(queue?.oldest_waiting_since)}
                    />
                    <InfoItem
                      label="Tempo aguardando"
                      value={formatDuration(queue?.oldest_waiting_seconds)}
                    />
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Contadores
                    </h2>
                  </div>

                  <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                    <InfoItem label="Running" value={summary?.running_tasks_count ?? 0} />
                    <InfoItem label="Waiting" value={summary?.waiting_tasks_count ?? 0} />
                    <InfoItem label="Scheduled" value={summary?.scheduled_tasks_count ?? 0} />
                    <InfoItem label="Ready" value={summary?.ready_tasks_count ?? 0} />
                    <InfoItem
                      label="Stop requested"
                      value={summary?.stop_requested_tasks_count ?? 0}
                    />
                    <InfoItem label="Finished" value={summary?.finished_tasks_count ?? 0} />
                    <InfoItem label="Error" value={summary?.error_tasks_count ?? 0} />
                    <InfoItem label="Timeout" value={summary?.timeout_tasks_count ?? 0} />
                    <InfoItem label="Canceled" value={summary?.canceled_tasks_count ?? 0} />
                    <InfoItem
                      label="Forced stop"
                      value={summary?.forced_stop_tasks_count ?? 0}
                    />
                    <InfoItem
                      label="Executadas total"
                      value={summary?.executed_total_count ?? 0}
                    />
                    <InfoItem
                      label="Sucesso total"
                      value={summary?.success_total_count ?? 0}
                    />
                  </div>
                </div>

                <div className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Bots vinculados
                    </h2>
                  </div>

                  <div className="px-5 py-5">
                    {linkedBots.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Nenhum bot vinculado para este runner.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {linkedBots.map((bot) => (
                          <div
                            key={bot.bot_id}
                            className="flex items-start justify-between gap-4 border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 break-words">
                                {bot.bot_name || `Bot #${bot.bot_id}`}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                ID do bot: {bot.bot_id}
                              </p>
                            </div>
                            <Bot className="h-4 w-4 shrink-0 text-slate-500" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-slate-700" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Tasks em execução
                    </h2>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <TasksTable tasks={runningTasks} emptyLabel="Nenhuma task em execução." />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-slate-700" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Histórico de tasks do runner
                    </h2>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <TasksTable tasks={recentTasks} emptyLabel="Nenhuma task encontrada." />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-50">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm text-slate-800 break-words">{value}</div>
    </div>
  );
}

function StatusBadge({
  status,
  children,
}: {
  status?: string | null;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 text-xs font-medium ${getTaskStatusBadgeClass(
        status
      )}`}
    >
      {children}
    </span>
  );
}

function TasksTable({
  tasks,
  emptyLabel,
}: {
  tasks: RunnerOverviewTaskItem[];
  emptyLabel: string;
}) {
  if (tasks.length === 0) {
    return <div className="px-5 py-6 text-sm text-slate-500">{emptyLabel}</div>;
  }

  return (
    <table className="min-w-full border-collapse">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50 text-left">
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Task
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Automação
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Status
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Criada em
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Início
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Fim
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Duração
          </th>
          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Mensagem final
          </th>
        </tr>
      </thead>

      <tbody>
        {tasks.map((task) => (
          <tr key={task.task_id} className="border-b border-slate-200 align-top">
            <td className="px-4 py-3 text-sm text-slate-800">{task.task_id}</td>
            <td className="px-4 py-3 text-sm text-slate-800">
              <div className="min-w-[220px] break-words">
                {task.automation_name || "---"}
              </div>
            </td>
            <td className="px-4 py-3 text-sm text-slate-800">
              <StatusBadge status={task.status}>
                {formatTaskStatus(task.status)}
              </StatusBadge>
            </td>
            <td className="px-4 py-3 text-sm text-slate-800">
              {formatDateTime(task.created_at)}
            </td>
            <td className="px-4 py-3 text-sm text-slate-800">
              {formatDateTime(task.started_at)}
            </td>
            <td className="px-4 py-3 text-sm text-slate-800">
              {formatDateTime(task.finished_at)}
            </td>
            <td className="px-4 py-3 text-sm text-slate-800">
              {formatDuration(task.execution_duration_seconds)}
            </td>
            <td className="px-4 py-3 text-sm text-slate-800">
              <div className="max-w-[320px] whitespace-pre-wrap break-words">
                {task.final_message || "---"}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
