import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Cpu,
  Download,
  FileCode2,
  FileText,
  Paperclip,
  HardDrive,
  ListFilter,
  MemoryStick,
  Network,
  OctagonX,
  ChevronRight,
  RotateCcw,
  Server,
  ShieldCheck,
  SquareX,
} from "lucide-react";

import {
  cancelTask,
  createTask,
  downloadTaskAttachment,
  forceStopTask,
  getTask,
  listTaskAttachments,
  listTaskLogs,
  requestStopTask,
  type TaskChildRead,
  type TaskLogItem,
  type TaskRead,
  type TaskStatus,
} from "@/services/api/tasks";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { listTaskErrorsByTask } from "@/services/api/task-errors";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { TaskStuckBadge } from "@/components/common/task-stuck-badge";
import { getApiErrorMessage, withApiDetail } from "@/lib/api-error";
import { EMPTY, formatBoolean, formatDateTime, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { rerunPayload } from "@/lib/run-task";
import { btn, card, cardBody, cardHeader, cardTitle, link } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";
import { TaskLogConsole } from "./task-log-console";
import { buildConsoleLines, normalizeDisplayText, splitFinalMessage } from "./task-log-utils";

const LIVE_STATUSES = ["running", "waiting", "ready", "stop_requested"];
const FAILED_STATUSES = ["error", "timeout", "forced_stop", "canceled", "failed"];
const FINAL_STATUSES = ["finished", "error", "timeout", "canceled", "forced_stop"];
const DETAIL_REFRESH_MS = 5_000;

// Qual confirmação está aberta.
type PendingConfirm = "cancel" | "request-stop" | "force-stop" | "rerun" | null;

const EXECUTION_MODE_LABEL: Record<string, string> = {
  manual: "Manual",
  api: "API",
  retry: "Retentativa automática",
  reprocess: "Reprocessamento",
  scheduled: "Agendamento",
  trigger: "Gatilho de sucesso",
};

// Como uma task filha foi originada (encadeamento visível).
function describeChildOrigin(child: TaskChildRead): string {
  if (child.execution_mode === "trigger") return "gatilho de sucesso";
  if (child.execution_mode === "retry") return `tentativa automática ${child.retry_count ?? ""}`.trim();
  return EXECUTION_MODE_LABEL[child.execution_mode] ?? child.execution_mode;
}

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
    return { text: `Tentativa automática ${task.retry_count ?? ""} da task #${task.parent_task_id}`, to: `/tasks/${task.parent_task_id}` };
  }
  if (task.execution_mode === "trigger" && task.parent_task_id) {
    return { text: `Disparada pela task #${task.parent_task_id} (gatilho de sucesso)`, to: `/tasks/${task.parent_task_id}` };
  }
  if (task.parent_task_id) {
    return { text: `Encadeada pela task #${task.parent_task_id}`, to: `/tasks/${task.parent_task_id}` };
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

function formatBytes(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "---";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMb(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${formatNumber(value, 2)} MB`;
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
    <section className={card}>
      <div className={cardHeader}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className={cardTitle}>{title}</h2>
        </div>
      </div>

      <div className={cardBody}>{children}</div>
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
      aria-pressed={active}
      className={cn(
        btn.secondary,
        active && "border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700"
      )}
    >
      {children}
    </button>
  );
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ taskId: string }>();
  const [activeTab, setActiveTab] = useState<"general" | "telemetry">("general");
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const taskId = Number(params.taskId);
  const validId = Number.isFinite(taskId) && taskId > 0;

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

  // Print da tela no momento do erro (o robô tira pelo maestro; o worker anexa ao erro da task).
  const failedStatus = ["error", "timeout", "forced_stop"].includes(String(task?.status ?? ""));
  const taskErrorsQuery = useQuery({
    queryKey: ["task-errors-of-task", taskId],
    queryFn: () => listTaskErrorsByTask({ taskId, limit: 5 }),
    enabled: Number.isFinite(taskId) && taskId > 0 && failedStatus,
  });
  const errorScreenshot = taskErrorsQuery.data?.items.find((item) => item.error_screenshot_base64)?.error_screenshot_base64 ?? null;

  // Arquivos que o robô anexou pelo maestro (attach): planilhas, PDFs, logs.
  const attachmentsQuery = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: () => listTaskAttachments(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
    refetchInterval: isLive ? DETAIL_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });
  const attachments = attachmentsQuery.data?.items ?? [];

  async function handleDownloadAttachment(attachmentId: number, filename: string) {
    try {
      const url = await downloadTaskAttachment(taskId, attachmentId);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      toast.error(withApiDetail("Não foi possível baixar o arquivo.", error));
    }
  }

  async function refreshAfterAction() {
    await queryClient.invalidateQueries({ queryKey: ["task-detail", taskId] });
    await queryClient.invalidateQueries({ queryKey: ["task-logs", taskId] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const cancelMutation = useMutation({
    mutationFn: () => cancelTask(taskId),
    onSuccess: async () => {
      toast.success("Task cancelada.");
      setPendingConfirm(null);
      await refreshAfterAction();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cancelar a task.", error));
    },
  });

  const requestStopMutation = useMutation({
    mutationFn: () => requestStopTask(taskId),
    onSuccess: async () => {
      toast.success("Parada solicitada. O robô encerra com segurança no próximo ponto seguro.");
      setPendingConfirm(null);
      await refreshAfterAction();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível solicitar a parada.", error));
    },
  });

  const forceStopMutation = useMutation({
    mutationFn: () => forceStopTask(taskId),
    onSuccess: async () => {
      toast.success("Parada forçada aplicada.");
      setPendingConfirm(null);
      await refreshAfterAction();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível aplicar a parada forçada.", error));
    },
  });

  // "Rodar de novo": nova task com os mesmos parâmetros, ligada a esta por parent_task_id.
  const rerunMutation = useMutation({
    mutationFn: (original: TaskRead) => createTask(rerunPayload(original)),
    onSuccess: async (response) => {
      toast.success(`Task #${response.task.id} criada a partir da #${taskId}.`);
      setPendingConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      navigate(`/tasks/${response.task.id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível rodar a task de novo."));
    },
  });

  const status = String(task?.status ?? "");
  const canCancelTask = ["waiting", "scheduled", "ready"].includes(status);
  const canStopTask = ["running", "stop_requested"].includes(status);
  const canRerunTask = FINAL_STATUSES.includes(status);
  const actionPending =
    cancelMutation.isPending ||
    requestStopMutation.isPending ||
    forceStopMutation.isPending ||
    rerunMutation.isPending;

  function handleConfirm() {
    if (pendingConfirm === "cancel") cancelMutation.mutate();
    else if (pendingConfirm === "request-stop") requestStopMutation.mutate();
    else if (pendingConfirm === "force-stop") forceStopMutation.mutate();
    else if (pendingConfirm === "rerun" && task) rerunMutation.mutate(task);
  }

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

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Task" backTo="/tasks" backLabel="Voltar para tasks" />
        <div className="p-5">
          <QueryError error={new Error("ID de task inválido.")} what="a task" />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title={`Task #${taskId}`}
          description={task?.automation_name ? task.automation_name : "Execução, parâmetros, logs e telemetria."}
          backTo="/tasks"
          backLabel="Voltar para tasks"
          meta={task?.status ? <StatusBadge status={task.status} /> : null}
          actions={
            <>
              {canCancelTask ? (
                <button type="button" disabled={actionPending} onClick={() => setPendingConfirm("cancel")} className={btn.secondary}>
                  <SquareX className="h-4 w-4" />
                  Cancelar
                </button>
              ) : null}

              {canStopTask ? (
                <>
                  <button
                    type="button"
                    disabled={actionPending || status === "stop_requested"}
                    onClick={() => setPendingConfirm("request-stop")}
                    className={btn.secondary}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Parar com segurança
                  </button>

                  <button type="button" disabled={actionPending} onClick={() => setPendingConfirm("force-stop")} className={btn.dangerOutline}>
                    <OctagonX className="h-4 w-4" />
                    Parada forçada
                  </button>
                </>
              ) : null}

              {canRerunTask ? (
                <button type="button" disabled={actionPending} onClick={() => setPendingConfirm("rerun")} className={btn.primary}>
                  <RotateCcw className="h-4 w-4" />
                  Rodar de novo
                </button>
              ) : null}

              <RefreshIndicator
                updatedAt={taskQuery.dataUpdatedAt}
                isFetching={taskQuery.isFetching || taskLogsQuery.isFetching}
                onRefresh={handleRefresh}
                intervalMs={isLive ? DETAIL_REFRESH_MS : undefined}
              />
            </>
          }
        />

        <div className="px-5 py-5 md:px-6">
          {taskQuery.isLoading ? (
            <DetailSkeleton fields={8} />
          ) : taskQuery.isError ? (
            <QueryError error={taskQuery.error} what="a task" onRetry={() => taskQuery.refetch()} retrying={taskQuery.isFetching} />
          ) : task ? (
            <div className="space-y-6">
              <TaskStuckBadge task={task} runner={task.runner_details} />

              {waitingReason ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
                  <section className={`rounded-xl border ${headerTone.wrapper} px-5 py-4`}>
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
                                : status === "waiting" && task.waiting_reason
                                  ? task.waiting_reason
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
                          {(status === "running" || status === "stop_requested") && task.progress_current != null ? (
                            <div className="mt-2 max-w-md">
                              <p className="text-xs font-medium text-slate-700">
                                Etapa {task.progress_current}
                                {task.progress_total ? ` de ${task.progress_total}` : ""}
                                {task.progress_text ? ` · ${task.progress_text}` : ""}
                              </p>
                              {task.progress_total ? (
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-blue-600 transition-all"
                                    style={{ width: `${Math.min(100, Math.round((task.progress_current / task.progress_total) * 100))}%` }}
                                  />
                                </div>
                              ) : null}
                            </div>
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
                          <Link className={link} to={`/automations/${task.automation_id}`}>
                            {task.automation_name || `#${task.automation_id}`}
                          </Link>
                        }
                      />
                      <InfoItem label="Versão do bot" value={task.bot_version_label || "---"} />
                      <InfoItem
                        label="Máquina"
                        value={
                          task.runner_id ? (
                            <Link className={link} to={`/runners/${task.runner_id}`}>
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
                            <Link className={link} to={origin.to}>
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
                        <InfoItem label="Tentativa automática nº" value={String(task.retry_count)} />
                      ) : null}
                      {task.queue_name ? <InfoItem label="Fila" value={task.queue_name} /> : null}
                      {task.correlation_id ? (
                        <InfoItem label="Correlation ID" value={task.correlation_id} />
                      ) : null}
                      {status === "waiting" && task.waiting_reason ? (
                        <InfoItem
                          label="Por que está na fila"
                          value={<span className="text-amber-700">{task.waiting_reason}</span>}
                        />
                      ) : null}
                    </div>
                  </Section>

                  {task.children && task.children.length > 0 ? (
                    <Section
                      title="Tasks disparadas por esta"
                      icon={<ChevronRight className="h-4 w-4 text-slate-500" />}
                    >
                      <ul className="divide-y divide-slate-100">
                        {task.children.map((child) => (
                          <li key={child.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                            <Link className={link} to={`/tasks/${child.id}`}>
                              #{child.id} · {child.automation_name || `Automação #${child.automation_id}`}
                            </Link>
                            <StatusBadge status={child.status} />
                            <span className="text-xs text-slate-500">{describeChildOrigin(child)}</span>
                            <span className="ml-auto text-xs text-slate-500">
                              criada {formatDateTime(child.created_at)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null}

                  {errorScreenshot ? (
                    <Section title="Tela no momento do erro" icon={<AlertCircle className="h-4 w-4 text-red-500" />}>
                      <p className="mb-3 text-sm text-slate-600">Print tirado pelo robô quando o erro aconteceu.</p>
                      <a href={`data:image/jpeg;base64,${errorScreenshot}`} target="_blank" rel="noreferrer" className="block">
                        <img
                          src={`data:image/jpeg;base64,${errorScreenshot}`}
                          alt="Tela da máquina no momento do erro"
                          className="max-h-[480px] w-auto max-w-full rounded-lg border border-slate-200 shadow-sm"
                        />
                      </a>
                    </Section>
                  ) : null}

                  {attachments.length > 0 ? (
                    <Section title="Arquivos anexados pelo robô" icon={<Paperclip className="h-4 w-4 text-slate-500" />}>
                      <ul className="divide-y divide-slate-100">
                        {attachments.map((item) => (
                          <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(item.id, item.filename)}
                              className={cn(link, "inline-flex items-center gap-1.5")}
                            >
                              <Download className="h-4 w-4" />
                              {item.filename}
                            </button>
                            <span className="text-xs text-slate-500">{formatBytes(item.size_bytes)}</span>
                            {item.description ? <span className="text-xs text-slate-600">{item.description}</span> : null}
                            <span className="ml-auto text-xs text-slate-500">{formatDateTime(item.created_at)}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  ) : null}

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
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 font-mono leading-6">
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

      <ConfirmDialog
        open={pendingConfirm === "cancel"}
        title={`Cancelar a task #${taskId}?`}
        description="A task sai da fila e não é executada."
        confirmLabel="Cancelar task"
        cancelLabel="Voltar"
        tone="warning"
        isPending={cancelMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        open={pendingConfirm === "request-stop"}
        title={`Parar a task #${taskId} com segurança?`}
        description="O robô recebe o pedido e encerra no próximo ponto seguro. Pode levar alguns minutos."
        confirmLabel="Parar com segurança"
        cancelLabel="Voltar"
        isPending={requestStopMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        open={pendingConfirm === "force-stop"}
        title={`Parada forçada da task #${taskId}`}
        description="O processo é interrompido na hora, sem esperar o robô terminar o que estava fazendo. Itens em andamento podem ficar pela metade. Use só quando a parada segura não funcionou."
        confirmLabel="Forçar parada"
        cancelLabel="Voltar"
        tone="danger"
        requireText={String(taskId)}
        isPending={forceStopMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />

      <ConfirmDialog
        open={pendingConfirm === "rerun"}
        title={`Rodar de novo a task #${taskId}?`}
        description={`Uma nova task da automação ${task?.automation_name ?? `#${task?.automation_id ?? ""}`} é criada com os mesmos parâmetros e entra na fila agora.`}
        confirmLabel="Rodar de novo"
        cancelLabel="Voltar"
        isPending={rerunMutation.isPending}
        onConfirm={handleConfirm}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
