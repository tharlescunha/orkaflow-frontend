import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bot,
  Cpu,
  RefreshCcw,
  Server,
  Timer,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getRunner,
  getRunnerOverview,
  type RunnerOverviewTaskItem,
  type RunnerRead,
} from "@/services/api/runners";

type ChartPeriod = "recent";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatShortTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatStatus(status?: string) {
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
    case "finished":
      return "Sucesso";
    case "error":
      return "Erro";
    case "running":
      return "Executando";
    case "waiting":
      return "Em espera";
    case "scheduled":
      return "Agendada";
    case "ready":
      return "Pronta";
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

function toChartNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function getStatusClass(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "busy":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "maintenance":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "blocked":
      return "border-red-200 bg-red-50 text-red-700";
    case "offline":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatBytes(value?: number | null) {
  if (value == null) return "---";
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatSeconds(value?: number | null) {
  if (value == null) return "---";

  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getRunnerName(runner?: RunnerRead | null) {
  if (!runner) return "---";
  return runner.name;
}

function getExecutionSeconds(task: RunnerOverviewTaskItem) {
  if (task.execution_duration_seconds != null) {
    return task.execution_duration_seconds;
  }

  if (task.started_at && task.finished_at) {
    const start = new Date(task.started_at).getTime();
    const end = new Date(task.finished_at).getTime();

    if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
      return Math.round((end - start) / 1000);
    }
  }

  return 0;
}

function getQueueSeconds(task: RunnerOverviewTaskItem) {
  if (!task.started_at || !task.created_at) {
    return 0;
  }

  const created = new Date(task.created_at).getTime();
  const started = new Date(task.started_at).getTime();

  if (Number.isNaN(created) || Number.isNaN(started) || started < created) {
    return 0;
  }

  return Math.round((started - created) / 1000);
}

function isSuccessStatus(status?: string) {
  return (status || "").toLowerCase() === "finished";
}

function isErrorStatus(status?: string) {
  const normalized = (status || "").toLowerCase();
  return ["error", "timeout", "forced_stop"].includes(normalized);
}

export function RunnerDetailPage() {
  const params = useParams();
  const runnerId = Number(params.runnerId);

  const [chartPeriod] = useState<ChartPeriod>("recent");

  const isValidRunnerId = Number.isFinite(runnerId) && runnerId > 0;

  const runnerQuery = useQuery({
    queryKey: ["runner", runnerId],
    queryFn: () => getRunner(runnerId),
    enabled: isValidRunnerId,
    refetchInterval: 10000,
  });

  const overviewQuery = useQuery({
    queryKey: ["runner-overview", runnerId],
    queryFn: () => getRunnerOverview(runnerId),
    enabled: isValidRunnerId,
    refetchInterval: 10000,
  });

  const isLoading = runnerQuery.isLoading || overviewQuery.isLoading;
  const isError = runnerQuery.isError || overviewQuery.isError;

  const runner = runnerQuery.data;
  const overview = overviewQuery.data;

  const summaryCards = useMemo(() => {
    if (!overview) return [];

    return [
      {
        title: "Bots vinculados",
        value: String(overview.summary.linked_bots_count ?? 0),
        icon: Bot,
      },
      {
        title: "Tasks em execução",
        value: String(overview.summary.running_tasks_count ?? 0),
        icon: Timer,
      },
      {
        title: "Tasks em espera",
        value: String(overview.summary.waiting_tasks_count ?? 0),
        icon: Server,
      },
      {
        title: "Utilização",
        value: `${overview.utilization.utilization_percent ?? 0}%`,
        icon: Cpu,
      },
    ];
  }, [overview]);

  const recentTasks = overview?.recent_tasks ?? [];

  const tasksByTimeData = useMemo(() => {
    return [...recentTasks]
      .slice()
      .reverse()
      .map((task) => ({
        label: `${formatShortTime(task.created_at)}`,
        fullLabel: `${formatShortDate(task.created_at)} ${formatShortTime(
          task.created_at
        )}`,
        total: 1,
        sucesso: isSuccessStatus(task.status) ? 1 : 0,
        erro: isErrorStatus(task.status) ? 1 : 0,
        status: formatStatus(task.status),
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

    const avgQueue =
      queueTimes.reduce((acc, value) => acc + value, 0) / queueTimes.length;
    const avgExecution =
      executionTimes.reduce((acc, value) => acc + value, 0) /
      executionTimes.length;

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
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Runner inválido.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Link
                to="/runners"
                className="mb-3 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para runners
              </Link>

              <h1 className="text-2xl font-semibold text-slate-950">
                {getRunnerName(runner)}
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Informações completas, configuração e visão operacional do runner.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                runnerQuery.refetch();
                overviewQuery.refetch();
              }}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="py-10 text-sm text-slate-500">
              Carregando dados do runner...
            </div>
          ) : isError || !runner || !overview ? (
            <div className="py-10 text-sm text-red-600">
              Não foi possível carregar os dados do runner.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex min-w-[110px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusClass(
                    runner.status
                  )}`}
                >
                  {formatStatus(runner.status)}
                </span>

                <span
                  className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${
                    runner.enabled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {runner.enabled ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                          {item.title}
                        </span>
                        <Icon className="h-4 w-4 text-slate-400" />
                      </div>

                      <div className="mt-3 text-2xl font-semibold text-slate-950">
                        {item.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Panel title="Indicadores rápidos das últimas tasks">
                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Os gráficos abaixo usam apenas as últimas tasks retornadas pelo
                  overview atual.
                </div>

                <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <ChartCard
                    title="Tasks por horário"
                    subtitle="Baseado nas últimas tasks retornadas"
                    actions={
                      <select
                        value={chartPeriod}
                        disabled
                        className="h-9 min-w-[140px] border border-slate-300 bg-white px-3 text-sm text-slate-500 outline-none"
                      >
                        <option value="recent">Últimas tasks</option>
                      </select>
                    }
                  >
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={tasksByTimeData}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="label" />
                          <YAxis allowDecimals={false} />
                          <Tooltip
                            formatter={(value: unknown, name: unknown) => [
                              toChartNumber(value),
                              name === "sucesso"
                                ? "Sucesso"
                                : name === "erro"
                                ? "Erro"
                                : "Total",
                            ]}
                            labelFormatter={(label, payload) => {
                              const item = payload?.[0]?.payload;
                              return item?.fullLabel || label;
                            }}
                          />
                          <Legend
                            formatter={(value) =>
                              value === "sucesso"
                                ? "Sucesso"
                                : value === "erro"
                                ? "Erro"
                                : "Total"
                            }
                          />
                          <Bar dataKey="sucesso" name="sucesso" />
                          <Bar dataKey="erro" name="erro" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard
                    title="Média de tempo"
                    subtitle="Fila e execução"
                  >
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={averageTimesData}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip
                            formatter={(value: unknown) => [
                              formatSeconds(toChartNumber(value)),
                              "Tempo médio",
                            ]}
                          />
                          <Bar dataKey="segundos" name="Tempo médio">
                            {averageTimesData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={entry.name === "Fila" ? "#94a3b8" : "#2563eb"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>

                  <ChartCard
                    title="Status das últimas tasks"
                    subtitle="Sucesso x erro"
                  >
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusSummaryData}>
                          <CartesianGrid vertical={false} />
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip
                            formatter={(value: unknown) => [
                              toChartNumber(value),
                              "Quantidade",
                            ]}
                          />
                          <Bar dataKey="total" name="Quantidade">
                            {statusSummaryData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={
                                  entry.name === "Sucesso"
                                    ? "#16a34a"
                                    : entry.name === "Erro"
                                    ? "#dc2626"
                                    : "#94a3b8"
                                }
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>
              </Panel>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Panel title="Dados gerais">
                  <DataGrid
                    items={[
                      ["Nome", runner.name],
                      ["Label", runner.label || "---"],
                      ["UUID", runner.uuid],
                      ["Host", runner.host_name || "---"],
                      ["IP", runner.ip || "---"],
                      ["Último heartbeat", formatDateTime(runner.last_heartbeat)],
                      ["Criado em", formatDateTime(runner.created_at)],
                      ["Atualizado em", formatDateTime(runner.updated_at)],
                    ]}
                  />
                </Panel>

                <Panel title="Ambiente da máquina">
                  <DataGrid
                    items={[
                      ["Sistema operacional", runner.os_name || "---"],
                      ["Versão do SO", runner.os_version || "---"],
                      ["Arquitetura CPU", runner.cpu_arch || "---"],
                      ["Memória total", formatBytes(runner.memory_total)],
                      ["Acesso remoto", runner.access_remote ? "Sim" : "Não"],
                    ]}
                  />
                </Panel>

                <Panel title="Configuração do runner">
                  <DataGrid
                    items={[
                      [
                        "Máximo de concorrência",
                        String(runner.config?.max_concurrency ?? "---"),
                      ],
                      [
                        "Polling interval",
                        runner.config?.polling_interval != null
                          ? `${runner.config.polling_interval}s`
                          : "---",
                      ],
                      [
                        "Auto update bots",
                        runner.config?.auto_update_bots ? "Sim" : "Não",
                      ],
                      [
                        "Instalar todos no registro",
                        runner.config?.install_all_bots_on_register
                          ? "Sim"
                          : "Não",
                      ],
                      [
                        "Modo manutenção",
                        runner.config?.maintenance_mode ? "Sim" : "Não",
                      ],
                    ]}
                  />
                </Panel>

                <Panel title="Fila e execução">
                  <DataGrid
                    items={[
                      [
                        "Tasks executadas",
                        String(overview.summary.executed_total_count ?? 0),
                      ],
                      [
                        "Tasks com sucesso",
                        String(overview.summary.success_total_count ?? 0),
                      ],
                      [
                        "Tasks com erro",
                        String(overview.summary.error_total_count ?? 0),
                      ],
                      [
                        "Tempo executando",
                        formatSeconds(overview.utilization.execution_seconds),
                      ],
                      [
                        "Mais antiga na fila",
                        overview.queue.oldest_waiting_task_id != null
                          ? `#${overview.queue.oldest_waiting_task_id}`
                          : "---",
                      ],
                      [
                        "Tempo da mais antiga na fila",
                        formatSeconds(overview.queue.oldest_waiting_seconds),
                      ],
                    ]}
                  />
                </Panel>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <Panel title="Bots vinculados">
                  {overview.linked_bots.length === 0 ? (
                    <EmptyText texto="Nenhum bot vinculado." />
                  ) : (
                    <div className="space-y-2">
                      {overview.linked_bots.map((bot) => (
                        <div
                          key={bot.bot_id}
                          className="flex items-center justify-between border border-slate-200 px-3 py-2"
                        >
                          <span className="text-sm text-slate-900">
                            {bot.bot_name || `Bot ${bot.bot_id}`}
                          </span>
                          <span className="text-xs text-slate-500">
                            ID {bot.bot_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Última execução">
                  <DataGrid
                    items={[
                      [
                        "Task",
                        overview.last_execution.task_id != null
                          ? `#${overview.last_execution.task_id}`
                          : "---",
                      ],
                      [
                        "Automação",
                        overview.last_execution.automation_name || "---",
                      ],
                      [
                        "Status",
                        formatStatus(overview.last_execution.status || undefined),
                      ],
                      [
                        "Início",
                        formatDateTime(overview.last_execution.started_at),
                      ],
                      [
                        "Fim",
                        formatDateTime(overview.last_execution.finished_at),
                      ],
                      [
                        "Duração",
                        formatSeconds(
                          overview.last_execution.execution_duration_seconds
                        ),
                      ],
                      [
                        "Mensagem final",
                        overview.last_execution.final_message || "---",
                      ],
                    ]}
                  />
                </Panel>
              </div>

              <Panel title="Tasks em execução">
                <TaskList
                  tasks={overview.running_tasks}
                  emptyText="Nenhuma task em execução."
                />
              </Panel>

              <Panel title="Últimas tasks">
                <TaskList
                  tasks={overview.recent_tasks}
                  emptyText="Nenhuma task encontrada."
                />
              </Panel>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DataGrid({
  items,
}: {
  items: [string, string][];
}) {
  return (
    <div className="space-y-2">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-1 gap-1 border border-slate-200 px-3 py-2 md:grid-cols-[220px_1fr]"
        >
          <div className="text-sm text-slate-500">{label}</div>
          <div className="break-all text-sm font-medium text-slate-900">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskList({
  tasks,
  emptyText,
}: {
  tasks: RunnerOverviewTaskItem[];
  emptyText: string;
}) {
  if (tasks.length === 0) {
    return <EmptyText texto={emptyText} />;
  }

  return (
    <div className="overflow-x-auto">
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
          </tr>
        </thead>

        <tbody>
          {tasks.map((task) => (
            <tr key={task.task_id} className="border-b border-slate-200">
              <td className="px-4 py-3 text-sm text-slate-900">
                #{task.task_id}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {task.automation_name || "---"}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatStatus(task.status)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatDateTime(task.created_at)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatDateTime(task.started_at)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatDateTime(task.finished_at)}
              </td>
              <td className="px-4 py-3 text-sm text-slate-700">
                {formatSeconds(task.execution_duration_seconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyText({ texto }: { texto: string }) {
  return <div className="py-4 text-sm text-slate-500">{texto}</div>;
}
