import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Cpu,
  FileCode2,
  FileText,
  HardDrive,
  ListFilter,
  Loader2,
  MemoryStick,
  Network,
  OctagonX,
  ChevronRight,
  RefreshCcw,
  Server,
  ShieldCheck,
  SquareX,
} from "lucide-react";

import {
  cancelTask,
  forceStopTask,
  getTask,
  listTaskLogs,
  requestStopTask,
  type TaskLogItem,
  type TaskRead,
  type TaskStatus,
} from "@/services/api/tasks";
import { StatusBadge } from "@/components/common/status-badge";
import { TaskStuckBadge } from "@/components/common/task-stuck-badge";
import { withApiDetail } from "@/lib/api-error";
import { toast } from "@/store/toast-store";
import { TaskLogConsole } from "./task-log-console";
import { buildConsoleLines, normalizeDisplayText, splitFinalMessage } from "./task-log-utils";

const LIVE_STATUSES = ["running", "waiting", "ready", "stop_requested"];
const FAILED_STATUSES = ["error", "timeout", "forced_stop", "canceled", "failed"];
const DETAIL_REFRESH_MS = 5_000;

const EXECUTION_MODE_LABEL: Record<string, string> = {
  manual: "Manual",
  api: "API",
  retry: "Retry automático",
  reprocess: "Reprocessamento",
  scheduled: "Agendamento",
};

// "Criado por": o agendamento quando foi automático, senão quem disparou.
function describeOrigin(task?: TaskRead): { text: string; to?: string } {
  if (!task) return { text: "---" };
  if (task.schedule_id || task.schedule_name || task.execution_mode === "scheduled") {
    return {
      text: `Agendamento${task.schedule_name ? `: ${task.schedule_name}` : ""}`,
      to: task.schedule_id ? `/schedules/${task.schedule_id}` : undefined,
    };
  }
  if (task.execution_mode === "retry" && task.parent_task_id) {
    return { text: `Retry da task #${task.parent_task_id}`, to: `/tasks/${task.parent_task_id}` };
  }
  const mode = EXECUTION_MODE_LABEL[task.execution_mode] ?? task.execution_mode;
  if (task.created_by_name) {
    return { text: task.execution_mode === "manual" ? task.created_by_name : `${task.created_by_name} (${mode})` };
  }
  return { text: mode || "---" };
}

type TaskParameterItem = {
  id: number;
  parameter_name: string;
  parameter_value?: string | null;
  is_secret?: boolean | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "---";

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatNumber(value?: number | null, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "---";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "---";
  return `${formatNumber(value, 2)}%`;
}

function formatMb(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "---";
  return `${formatNumber(value, 2)} MB`;
}

function formatBoolean(value?: boolean | null) {
  if (value === null || value === undefined) return "---";
  return value ? "Sim" : "Não";
}

function clampPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getHeaderTone(status?: TaskStatus | string | null) {
  const normalized = String(status || "").toLowerCase();

  if (
    normalized === "finished" ||
    normalized === "success" ||
    normalized === "completed"
  ) {
    return {
      wrapper: "border-emerald-200 bg-emerald-50/50",
      icon: "border-emerald-200 bg-white text-emerald-700",
      title: "text-slate-950",
      text: "text-slate-600",
    };
  }

  if (
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "forced_stop" ||
    normalized === "canceled" ||
    normalized === "timeout"
  ) {
    return {
      wrapper: "border-red-200 bg-red-50/50",
      icon: "border-red-200 bg-white text-red-700",
      title: "text-slate-950",
      text: "text-slate-600",
    };
  }

  if (
    normalized === "running" ||
    normalized === "ready" ||
    normalized === "stop_requested"
  ) {
    return {
      wrapper: "border-sky-200 bg-sky-50/50",
      icon: "border-sky-200 bg-white text-sky-700",
      title: "text-slate-950",
      text: "text-slate-600",
    };
  }

  return {
    wrapper: "border-slate-200 bg-slate-50",
    icon: "border-slate-200 bg-white text-slate-700",
    title: "text-slate-950",
    text: "text-slate-600",
  };
}

function getPageTitle() {
  return "Detalhes da Task";
}

function formatResultJson(value?: string | null) {
  const normalized = normalizeDisplayText(value);

  if (!normalized || normalized === "---") return "";

  try {
    return JSON.stringify(JSON.parse(normalized), null, 2);
  } catch {
    return normalized;
  }
}

function tryFormatJson(value?: string | null) {
  if (!value) {
    return {
      isJson: false,
      formatted: "---",
    };
  }

  const normalized = normalizeDisplayText(value);
  const trimmed = normalized.trim();

  if (!trimmed) {
    return {
      isJson: false,
      formatted: "---",
    };
  }

  try {
    const parsed = JSON.parse(trimmed);

    return {
      isJson: true,
      formatted: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return {
      isJson: false,
      formatted: normalized,
    };
  }
}

function ParameterValue({
  value,
  isSecret,
}: {
  value?: string | null;
  isSecret?: boolean | null;
}) {
  if (isSecret) {
    return (
      <div className="px-4 py-3 text-sm text-slate-700 break-words whitespace-pre-wrap">
        ********
      </div>
    );
  }

  const jsonResult = tryFormatJson(value);

  if (jsonResult.isJson) {
    return (
      <pre className="overflow-x-auto bg-slate-50 px-4 py-3 text-sm text-slate-700 font-mono leading-6 whitespace-pre-wrap break-words">
        {jsonResult.formatted}
      </pre>
    );
  }

  return (
    <div className="px-4 py-3 text-sm text-slate-700 break-words whitespace-pre-wrap">
      {jsonResult.formatted}
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-slate-900 break-words whitespace-pre-wrap">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            {title}
          </h2>
        </div>
      </div>

      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
          {subtitle ? (
            <p className="mt-2 text-xs text-slate-500 break-words">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  percent,
  subtitle,
}: {
  label: string;
  value: ReactNode;
  percent: number;
  subtitle?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <div className="text-sm font-semibold text-slate-950">{value}</div>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-sky-500 transition-all"
          style={{ width: `${clampPercent(percent)}%` }}
        />
      </div>

      {subtitle ? (
        <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ taskId: string }>();
  const [activeTab, setActiveTab] = useState<"general" | "telemetry">("general");

  const taskId = Number(params.taskId);

  const queryClient = useQueryClient();

  const taskQuery = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => getTask(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
    // atualiza sozinho enquanto a task esta viva
    refetchInterval: (query) =>
      LIVE_STATUSES.includes(String(query.state.data?.status ?? ""))
        ? DETAIL_REFRESH_MS
        : false,
    refetchIntervalInBackground: false,
  });

  const task = taskQuery.data;
  const isLive = LIVE_STATUSES.includes(String(task?.status ?? ""));

  const taskLogsQuery = useQuery({
    queryKey: ["task-logs", taskId],
    queryFn: () => listTaskLogs(taskId, 500),
    enabled: Number.isFinite(taskId) && taskId > 0,
    refetchInterval: isLive ? DETAIL_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });

  async function refreshAfterAction() {
    await queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    await queryClient.invalidateQueries({ queryKey: ["task-logs", taskId] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const cancelMutation = useMutation({
    mutationFn: () => cancelTask(taskId),
    onSuccess: async () => {
      toast.success("Task cancelada com sucesso.");
      await refreshAfterAction();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cancelar a task.", error));
    },
  });

  const requestStopMutation = useMutation({
    mutationFn: () => requestStopTask(taskId),
    onSuccess: async () => {
      toast.success("Solicitação de parada registrada. O bot será encerrado com segurança.");
      await refreshAfterAction();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível solicitar a parada.", error));
    },
  });

  const forceStopMutation = useMutation({
    mutationFn: () => forceStopTask(taskId),
    onSuccess: async () => {
      toast.success("Parada forçada aplicada com sucesso.");
      await refreshAfterAction();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível aplicar a parada forçada.", error));
    },
  });

  const status = String(task?.status ?? "");
  const canCancelTask = ["waiting", "scheduled", "ready"].includes(status);
  const canStopTask = ["running", "stop_requested"].includes(status);
  const actionPending =
    cancelMutation.isPending ||
    requestStopMutation.isPending ||
    forceStopMutation.isPending;

  const rawLogs = useMemo<TaskLogItem[]>(() => taskLogsQuery.data?.items ?? [], [taskLogsQuery.data]);

  const failed = FAILED_STATUSES.includes(status);
  const consoleLines = useMemo(
    () => buildConsoleLines(rawLogs, task?.final_message, failed, task?.finished_at),
    [rawLogs, task?.final_message, failed, task?.finished_at]
  );

  // motivo da espera: log de sistema mais recente enquanto a task esta waiting/ready
  const waitingReason = useMemo(() => {
    if (status !== "waiting" && status !== "ready") return null;
    const systemLogs = rawLogs.filter(
      (log) => String(log.source ?? "").toLowerCase() === "system" && log.message
    );
    return systemLogs.reduce<TaskLogItem | null>(
      (newest, log) => (!newest || log.id > newest.id ? log : newest),
      null
    );
  }, [rawLogs, status]);

  const executionDuration = useMemo(() => {
    if (
      task?.telemetry?.duration_seconds !== null &&
      task?.telemetry?.duration_seconds !== undefined
    ) {
      return task.telemetry.duration_seconds;
    }

    if (!task?.started_at || !task?.finished_at) {
      return task?.execution_duration_seconds ?? null;
    }

    return Math.floor(
      (new Date(task.finished_at).getTime() -
        new Date(task.started_at).getTime()) /
        1000
    );
  }, [task]);

  const headerTone = getHeaderTone(task?.status);
  const finalSummary = splitFinalMessage(task?.final_message);
  const resultJsonText = formatResultJson(task?.result_json);
  const origin = describeOrigin(task);

  async function handleRefresh() {
    await taskQuery.refetch();
    await taskLogsQuery.refetch();
  }

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para tasks
            </button>
          </div>

          <div className="px-6 py-10">
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ID de task inválido.
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/tasks")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para tasks
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                {getPageTitle()} #{taskId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualização completa da execução, parâmetros, logs e telemetria.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {task?.status ? <StatusBadge status={task.status} /> : null}

              {canCancelTask ? (
                <button
                  type="button"
                  disabled={actionPending}
                  onClick={() => {
                    if (window.confirm(`Cancelar a task #${taskId}?`)) cancelMutation.mutate();
                  }}
                  className="inline-flex h-10 items-center gap-2 border border-amber-300 bg-white px-4 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                >
                  <SquareX className="h-4 w-4" />
                  Cancelar
                </button>
              ) : null}

              {canStopTask ? (
                <>
                  <button
                    type="button"
                    disabled={actionPending || status === "stop_requested"}
                    onClick={() => requestStopMutation.mutate()}
                    className="inline-flex h-10 items-center gap-2 border border-amber-300 bg-white px-4 text-sm font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Parar com segurança
                  </button>

                  <button
                    type="button"
                    disabled={actionPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Aplicar parada forçada na task #${taskId}? O processo será interrompido sem aguardar o bot.`
                        )
                      ) {
                        forceStopMutation.mutate();
                      }
                    }}
                    className="inline-flex h-10 items-center gap-2 border border-red-300 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                  >
                    <OctagonX className="h-4 w-4" />
                    Parada forçada
                  </button>
                </>
              ) : null}

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
          {taskQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando detalhes da task...
            </div>
          ) : taskQuery.isError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os detalhes da task.
            </div>
          ) : task ? (
            <div className="space-y-6">
              <TaskStuckBadge task={task} runner={task.runner_details} />

              {waitingReason ? (
                <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span className="font-semibold">Motivo da espera (log do sistema): </span>
                  {waitingReason.message}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <TabButton
                  active={activeTab === "general"}
                  onClick={() => setActiveTab("general")}
                >
                  <FileText className="h-4 w-4" />
                  Geral
                </TabButton>

                <TabButton
                  active={activeTab === "telemetry"}
                  onClick={() => setActiveTab("telemetry")}
                >
                  <BarChart3 className="h-4 w-4" />
                  Telemetria
                </TabButton>
              </div>

              {activeTab === "general" ? (
                <div className="space-y-6">
                  <section className={`border ${headerTone.wrapper} px-5 py-4`}>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={`rounded-xl border p-3 ${headerTone.icon}`}>
                          {String(task.status || "").toLowerCase() === "finished" ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : String(task.status || "").toLowerCase() === "running" ? (
                            <Activity className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h2 className={`text-xl font-semibold break-words ${headerTone.title}`}>
                            {task.automation_name || "Task"} #{task.id}
                          </h2>
                          {finalSummary.headline ? (
                            <p className={`mt-1 text-sm break-words ${headerTone.text}`}>{finalSummary.headline}</p>
                          ) : (
                            <p className={`mt-1 text-sm ${headerTone.text}`}>
                              {status === "running" || status === "stop_requested"
                                ? "Execução em andamento."
                                : status === "waiting" || status === "ready"
                                  ? "Na fila, aguardando uma máquina."
                                  : status === "scheduled"
                                    ? "Agendada para começar mais tarde."
                                    : "Sem mensagem final."}
                            </p>
                          )}
                          {finalSummary.errorLine && finalSummary.errorLine !== finalSummary.headline ? (
                            <p className="mt-1 font-mono text-xs break-words text-red-700">{finalSummary.errorLine}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          <span>{formatDuration(executionDuration)}</span>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Processados: {String(task.items_processed ?? 0)}</span>
                        </div>

                        <div
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                            (task.items_failed ?? 0) > 0
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span>Com falha: {String(task.items_failed ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <Section title="Resumo">
                    <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
                      <InfoItem
                        label="Automação"
                        value={
                          <Link className="hover:underline" to={`/automations/${task.automation_id}`}>
                            {task.automation_name || `#${task.automation_id}`}
                          </Link>
                        }
                      />
                      <InfoItem label="Versão do bot" value={task.bot_version_label || "---"} />
                      <InfoItem
                        label="Máquina"
                        value={
                          task.runner_id ? (
                            <Link className="hover:underline" to={`/runners/${task.runner_id}`}>
                              {task.runner_display_name || task.runner_name || `#${task.runner_id}`}
                            </Link>
                          ) : (
                            <span className="text-slate-500">Ainda não atribuída</span>
                          )
                        }
                      />
                      <InfoItem
                        label="Criado por"
                        value={
                          origin.to ? (
                            <Link className="hover:underline" to={origin.to}>
                              {origin.text}
                            </Link>
                          ) : (
                            origin.text
                          )
                        }
                      />

                      <InfoItem label="Criada em" value={formatDateTime(task.created_at)} />
                      <InfoItem label="Iniciada em" value={formatDateTime(task.started_at)} />
                      <InfoItem label="Finalizada em" value={formatDateTime(task.finished_at)} />
                      <InfoItem label="Duração" value={formatDuration(executionDuration)} />

                      <InfoItem label="Prioridade" value={String(task.priority)} />
                      {task.requested_start_at ? (
                        <InfoItem label="Solicitada para" value={formatDateTime(task.requested_start_at)} />
                      ) : null}
                      {(task.retry_count ?? 0) > 0 ? (
                        <InfoItem label="Tentativas (retry)" value={String(task.retry_count)} />
                      ) : null}
                      {task.queue_name ? <InfoItem label="Fila" value={task.queue_name} /> : null}
                      {task.correlation_id ? (
                        <InfoItem label="Correlation ID" value={task.correlation_id} />
                      ) : null}
                    </div>
                  </Section>

                  <TaskLogConsole
                    lines={consoleLines}
                    loading={taskLogsQuery.isLoading}
                    error={taskLogsQuery.isError}
                    live={isLive}
                    total={taskLogsQuery.data?.total ?? 0}
                    loaded={rawLogs.length}
                  />

                  {resultJsonText ? (
                    <Section
                      title="Resultado JSON"
                      icon={<FileCode2 className="h-4 w-4 text-slate-500" />}
                    >
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 font-mono leading-6">
                        {resultJsonText}
                      </pre>
                    </Section>
                  ) : null}

                  <Section
                    title="Parâmetros"
                    icon={<ListFilter className="h-4 w-4 text-slate-500" />}
                  >
                    {task.parameters?.length ? (
                      <div className="space-y-3">
                        {(task.parameters as TaskParameterItem[]).map((param) => (
                          <div
                            key={param.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-900">
                              {param.parameter_name}
                            </div>

                            <ParameterValue
                              value={param.parameter_value}
                              isSecret={param.is_secret}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Nenhum parâmetro informado.
                      </p>
                    )}
                  </Section>

                  <details className="group border border-slate-200 bg-white shadow-sm">
                    <summary className="flex cursor-pointer list-none items-center gap-2 bg-slate-50 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                      <ChevronRight className="h-4 w-4 text-slate-500 transition group-open:rotate-90" />
                      <Server className="h-4 w-4 text-slate-500" />
                      Detalhes técnicos
                    </summary>

                    <div className="space-y-6 border-t border-slate-200 px-5 py-5">
                      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
                        <InfoItem label="ID" value={String(task.id)} />
                        <InfoItem label="Status" value={<StatusBadge status={task.status} />} />
                        <InfoItem
                          label="Modo de execução"
                          value={EXECUTION_MODE_LABEL[task.execution_mode] ?? (task.execution_mode || "---")}
                        />
                        <InfoItem label="Envios para máquina" value={String(task.dispatch_attempts ?? 0)} />
                        <InfoItem
                          label="Timeout"
                          value={task.timeout_seconds ? formatDuration(task.timeout_seconds) : "---"}
                        />
                        <InfoItem
                          label="Timeout de inatividade"
                          value={
                            task.inactivity_timeout_seconds
                              ? formatDuration(task.inactivity_timeout_seconds)
                              : "---"
                          }
                        />
                        <InfoItem label="Parada solicitada" value={formatBoolean(task.stop_requested)} />
                        <InfoItem label="Assumida pela máquina" value={formatDateTime(task.runner_claimed_at)} />
                        <InfoItem label="Última atualização" value={formatDateTime(task.last_update_at)} />
                      </div>

                      {task.runner_details ? (
                        <div className="space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Máquina</p>
                          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
                            <InfoItem label="Nome" value={task.runner_details.name || "---"} />
                            <InfoItem label="Host / IP" value={`${task.runner_details.host_name || "---"} · ${task.runner_details.ip || "---"}`} />
                            <InfoItem
                              label="Sistema operacional"
                              value={
                                task.runner_details.os_name
                                  ? `${task.runner_details.os_name} ${task.runner_details.os_version || ""}`.trim()
                                  : "---"
                              }
                            />
                            <InfoItem label="Status" value={task.runner_details.status || "---"} />
                            <InfoItem label="UUID" value={task.runner_details.uuid || "---"} />
                            <InfoItem
                              label="Memória total"
                              value={
                                task.runner_details.memory_total !== null &&
                                task.runner_details.memory_total !== undefined
                                  ? formatMb(task.runner_details.memory_total)
                                  : "---"
                              }
                            />
                            <InfoItem label="Último heartbeat" value={formatDateTime(task.runner_details.last_heartbeat)} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      title="Duração da execução"
                      value={formatDuration(
                        task.telemetry?.duration_seconds ?? executionDuration
                      )}
                      subtitle="Tempo total medido pela telemetria."
                      icon={<Clock3 className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Status da telemetria"
                      value={task.telemetry?.telemetry_status || "---"}
                      subtitle={task.telemetry?.message || "Sem mensagem de telemetria."}
                      icon={<Activity className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Exit code"
                      value={
                        task.telemetry?.exit_code !== null &&
                        task.telemetry?.exit_code !== undefined
                          ? String(task.telemetry.exit_code)
                          : "---"
                      }
                      subtitle="Código de saída retornado pela execução."
                      icon={<BarChart3 className="h-5 w-5" />}
                    />

                    <MetricCard
                      title="Uso do runner"
                      value={formatPercent(task.runner_usage?.usage_percent)}
                      subtitle="Percentual acumulado de uso do runner no período."
                      icon={<Server className="h-5 w-5" />}
                    />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <ProgressMetric
                      label="CPU média"
                      value={formatPercent(task.telemetry?.cpu_percent_avg)}
                      percent={task.telemetry?.cpu_percent_avg ?? 0}
                      subtitle="Média de uso de CPU durante a execução."
                    />

                    <ProgressMetric
                      label="CPU pico"
                      value={formatPercent(task.telemetry?.cpu_percent_peak)}
                      percent={task.telemetry?.cpu_percent_peak ?? 0}
                      subtitle="Maior pico de CPU registrado na execução."
                    />

                    <ProgressMetric
                      label="Uso do runner no período"
                      value={formatPercent(task.runner_usage?.usage_percent)}
                      percent={task.runner_usage?.usage_percent ?? 0}
                      subtitle="Execução acumulada desde o início do período."
                    />

                    <ProgressMetric
                      label="Memória do processo vs memória total do runner"
                      value={formatMb(task.telemetry?.process_memory_mb_peak)}
                      percent={
                        task.runner_details?.memory_total
                          ? ((task.telemetry?.process_memory_mb_peak ?? 0) /
                              task.runner_details.memory_total) *
                            100
                          : 0
                      }
                      subtitle="Comparação aproximada entre pico do processo e memória total da máquina."
                    />
                  </div>

                  <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                        Consumo de recursos
                      </h2>
                    </div>

                    <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                      <MetricCard
                        title="Memória média"
                        value={formatMb(task.telemetry?.memory_used_mb_avg)}
                        icon={<MemoryStick className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="Memória pico"
                        value={formatMb(task.telemetry?.memory_used_mb_peak)}
                        icon={<MemoryStick className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="Processo pico"
                        value={formatMb(task.telemetry?.process_memory_mb_peak)}
                        icon={<Cpu className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="CPU média"
                        value={formatPercent(task.telemetry?.cpu_percent_avg)}
                        icon={<Cpu className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="Leitura de disco"
                        value={formatMb(task.telemetry?.disk_read_mb)}
                        icon={<HardDrive className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="Escrita de disco"
                        value={formatMb(task.telemetry?.disk_write_mb)}
                        icon={<HardDrive className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="Enviado na rede"
                        value={formatMb(task.telemetry?.net_sent_mb)}
                        icon={<Network className="h-5 w-5" />}
                      />

                      <MetricCard
                        title="Recebido na rede"
                        value={formatMb(task.telemetry?.net_recv_mb)}
                        icon={<Network className="h-5 w-5" />}
                      />
                    </div>
                  </section>

                  <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                        Informações da captura
                      </h2>
                    </div>

                    <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
                      <InfoItem
                        label="Captured at"
                        value={formatDateTime(task.telemetry?.captured_at)}
                      />
                      <InfoItem
                        label="Execution started at"
                        value={formatDateTime(task.telemetry?.execution_started_at)}
                      />
                      <InfoItem
                        label="Execution finished at"
                        value={formatDateTime(task.telemetry?.execution_finished_at)}
                      />
                      <InfoItem
                        label="Telemetry created at"
                        value={formatDateTime(task.telemetry?.created_at)}
                      />
                      <InfoItem
                        label="Runner ID"
                        value={
                          task.telemetry?.runner_id !== null &&
                          task.telemetry?.runner_id !== undefined
                            ? String(task.telemetry.runner_id)
                            : "---"
                        }
                      />
                      <InfoItem
                        label="Task ID"
                        value={
                          task.telemetry?.task_id !== null &&
                          task.telemetry?.task_id !== undefined
                            ? String(task.telemetry.task_id)
                            : "---"
                        }
                      />
                    </div>
                  </section>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
