import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  RefreshCcw,
  ScrollText,
  Server,
} from "lucide-react";

import {
  getTask,
  listTaskLogs,
  type TaskStatus,
} from "@/services/api/tasks";
import { StatusBadge } from "@/components/common/status-badge";

type TaskLogItem = {
  id: number;
  task_id: number;
  level?: string | null;
  message?: string | null;
  reference?: string | null;
  error_type?: string | null;
  source?: string | null;
  sequence_number?: number | null;
  runner_id?: number | null;
  event_code?: string | null;
  created_at?: string | null;
};

type GroupedLog = {
  id: string;
  level?: string | null;
  created_at?: string | null;
  message: string;
  lines: TaskLogItem[];
};

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

function getLevelClasses(level?: string | null) {
  const normalized = String(level || "").toLowerCase();

  if (normalized === "error") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (normalized === "warning" || normalized === "warn") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (normalized === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
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

function getPageTitle(_status?: TaskStatus) {
  return "Detalhes da Task";
}

function tryDecodeEscapedUnicode(text: string) {
  if (!text.includes("\\u")) return text;

  try {
    const escaped = text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    return JSON.parse(`"${escaped}"`);
  } catch {
    return text;
  }
}

function tryFixMojibake(text: string) {
  const suspicious = /Ã|Â|â|ð|�/.test(text);

  if (!suspicious) return text;

  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

    if (decoded && decoded !== text) {
      return decoded;
    }

    return text;
  } catch {
    return text;
  }
}

function normalizeDisplayText(value?: string | null) {
  if (!value) return "---";

  let text = String(value);

  text = tryDecodeEscapedUnicode(text);
  text = tryFixMojibake(text);

  return text;
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

function extractTracebackText(value?: string | null) {
  const normalized = normalizeDisplayText(value);

  if (!normalized || normalized === "---") return "";

  const upper = normalized.toUpperCase();
  const marker = "TRACEBACK:";

  if (upper.includes(marker)) {
    const index = upper.indexOf(marker);
    return normalized.slice(index + marker.length).trim();
  }

  if (
    normalized.includes("Traceback") ||
    normalized.includes("Erro durante") ||
    normalized.includes("File ") ||
    normalized.includes("Exception")
  ) {
    return normalized.trim();
  }

  return "";
}

function isLikelyStructuredBlockLine(message?: string | null) {
  const text = String(message || "").trim();

  if (!text) return false;

  return (
    text === "{" ||
    text === "}" ||
    text === "[" ||
    text === "]" ||
    text.startsWith('"') ||
    text.includes('":') ||
    text.startsWith("Traceback") ||
    text.startsWith("File ") ||
    text.startsWith("During handling of the above exception") ||
    text.startsWith("requests.exceptions.") ||
    text.startsWith("Exception:") ||
    text.startsWith(
      "================================================================================"
    ) ||
    text.startsWith("[SUCESSO]") ||
    text.startsWith("[ERRO]") ||
    text.startsWith("[WARNING]") ||
    text.startsWith("[INFO]")
  );
}

function shouldJoinLogLine(current: TaskLogItem, previous: TaskLogItem | null) {
  if (!previous) return false;

  const currentLevel = String(current.level || "").toLowerCase();
  const previousLevel = String(previous.level || "").toLowerCase();

  if (currentLevel !== previousLevel) return false;
  if ((current.source || null) !== (previous.source || null)) return false;
  if ((current.error_type || null) !== (previous.error_type || null)) {
    return false;
  }
  if ((current.event_code || null) !== (previous.event_code || null)) {
    return false;
  }

  const currentSeq = current.sequence_number;
  const previousSeq = previous.sequence_number;

  if (
    typeof currentSeq === "number" &&
    typeof previousSeq === "number" &&
    currentSeq === previousSeq + 1
  ) {
    const previousLooksStructured = isLikelyStructuredBlockLine(previous.message);
    const currentLooksStructured = isLikelyStructuredBlockLine(current.message);

    if (previousLooksStructured || currentLooksStructured) {
      return true;
    }
  }

  return false;
}

function groupLogs(logs: TaskLogItem[]): GroupedLog[] {
  if (!logs.length) return [];

  const ordered = [...logs].sort((a, b) => {
    const seqA =
      typeof a.sequence_number === "number"
        ? a.sequence_number
        : Number.MAX_SAFE_INTEGER;
    const seqB =
      typeof b.sequence_number === "number"
        ? b.sequence_number
        : Number.MAX_SAFE_INTEGER;

    if (seqA !== seqB) return seqA - seqB;

    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;

    if (timeA !== timeB) return timeA - timeB;

    return a.id - b.id;
  });

  const groups: GroupedLog[] = [];
  let currentGroup: GroupedLog | null = null;
  let previousLine: TaskLogItem | null = null;

  for (const log of ordered) {
    if (!currentGroup) {
      currentGroup = {
        id: `group-${log.id}`,
        level: log.level,
        created_at: log.created_at,
        message: normalizeDisplayText(log.message),
        lines: [log],
      };
      previousLine = log;
      continue;
    }

    if (shouldJoinLogLine(log, previousLine)) {
      currentGroup.lines.push(log);
      currentGroup.message = `${currentGroup.message}\n${normalizeDisplayText(log.message)}`;
      currentGroup.created_at = log.created_at;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: `group-${log.id}`,
        level: log.level,
        created_at: log.created_at,
        message: normalizeDisplayText(log.message),
        lines: [log],
      };
    }

    previousLine = log;
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

function shouldRenderAsBlock(message?: string | null) {
  const text = String(message || "");

  return (
    text.includes("\n") ||
    text.includes('":') ||
    text.includes("Traceback") ||
    text.includes("TRACEBACK") ||
    text.includes("================================================================================")
  );
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

  const taskQuery = useQuery({
    queryKey: ["task-detail", taskId],
    queryFn: () => getTask(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
  });

  const taskLogsQuery = useQuery({
    queryKey: ["task-logs", taskId],
    queryFn: () => listTaskLogs(taskId),
    enabled: Number.isFinite(taskId) && taskId > 0,
  });

  const task = taskQuery.data;

  const rawLogs = useMemo<TaskLogItem[]>(() => {
    return (taskLogsQuery.data?.items ?? []) as TaskLogItem[];
  }, [taskLogsQuery.data]);

  const logs = useMemo(() => {
    return groupLogs(rawLogs);
  }, [rawLogs]);

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
  const finalMessage = normalizeDisplayText(task?.final_message);
  const tracebackText = extractTracebackText(task?.final_message);
  const resultJsonText = formatResultJson(task?.result_json);

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
                {getPageTitle(task?.status)} #{taskId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualização completa da execução, parâmetros, logs e telemetria.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {task?.status ? <StatusBadge status={task.status} /> : null}

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
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            Visão geral
                          </p>
                          <h2 className={`mt-1 text-xl font-semibold break-words ${headerTone.title}`}>
                            {task.automation_name || "Task"} #{task.id}
                          </h2>
                          <p className={`mt-1 text-sm ${headerTone.text}`}>
                            Informações principais da execução com os vínculos corretos da task.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          <Clock3 className="h-4 w-4 text-slate-400" />
                          <span>Duração: {formatDuration(executionDuration)}</span>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Processados: {String(task.items_processed ?? 0)}</span>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <span>Falhas: {String(task.items_failed ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <Section title="Resumo">
                    <div className="grid gap-x-8 gap-y-7 md:grid-cols-2 xl:grid-cols-4">
                      <InfoItem label="ID" value={String(task.id)} />
                      <InfoItem label="Status" value={<StatusBadge status={task.status} />} />
                      <InfoItem label="Prioridade" value={String(task.priority)} />
                      <InfoItem label="Modo de execução" value={task.execution_mode || "---"} />

                      <InfoItem label="Automação" value={task.automation_name || "---"} />
                      <InfoItem label="Versão do bot" value={task.bot_version_label || "---"} />
                      <InfoItem
                        label="Runner executor"
                        value={task.runner_display_name || task.runner_name || "---"}
                      />
                      <InfoItem label="Criado por" value={task.created_by_name || "---"} />

                      <InfoItem label="Agendamento" value={task.schedule_name || "---"} />
                      <InfoItem label="Fila" value={task.queue_name || "---"} />
                      <InfoItem label="Correlation ID" value={task.correlation_id || "---"} />
                      <InfoItem
                        label="Tempo de execução"
                        value={
                          <span className="inline-flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-slate-400" />
                            {formatDuration(executionDuration)}
                          </span>
                        }
                      />

                      <InfoItem label="Itens processados" value={String(task.items_processed ?? 0)} />
                      <InfoItem label="Itens com falha" value={String(task.items_failed ?? 0)} />
                      <InfoItem
                        label="Timeout"
                        value={task.timeout_seconds ? `${task.timeout_seconds}s` : "---"}
                      />
                      <InfoItem
                        label="Timeout de inatividade"
                        value={
                          task.inactivity_timeout_seconds
                            ? `${task.inactivity_timeout_seconds}s`
                            : "---"
                        }
                      />

                      <InfoItem label="Retry count" value={String(task.retry_count ?? 0)} />
                      <InfoItem
                        label="Dispatch attempts"
                        value={String(task.dispatch_attempts ?? 0)}
                      />
                      <InfoItem
                        label="Stop requested"
                        value={formatBoolean(task.stop_requested)}
                      />
                    </div>
                  </Section>

                  <Section title="Datas">
                    <div className="grid gap-x-8 gap-y-7 md:grid-cols-2 xl:grid-cols-3">
                      <InfoItem label="Criada em" value={formatDateTime(task.created_at)} />
                      <InfoItem label="Atualizada em" value={formatDateTime(task.updated_at)} />
                      <InfoItem
                        label="Solicitada para"
                        value={formatDateTime(task.requested_start_at)}
                      />
                      <InfoItem label="Iniciada em" value={formatDateTime(task.started_at)} />
                      <InfoItem label="Finalizada em" value={formatDateTime(task.finished_at)} />
                      <InfoItem
                        label="Última atualização"
                        value={formatDateTime(task.last_update_at)}
                      />
                      <InfoItem
                        label="Runner claimed at"
                        value={formatDateTime(task.runner_claimed_at)}
                      />
                    </div>
                  </Section>

                  <Section
                    title="Mensagem final"
                    icon={<FileText className="h-4 w-4 text-slate-500" />}
                  >
                    <div className="border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 whitespace-pre-wrap break-words">
                      {finalMessage}
                    </div>
                  </Section>

                  {resultJsonText ? (
                    <Section
                      title="Resultado JSON"
                      icon={<FileCode2 className="h-4 w-4 text-slate-500" />}
                    >
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 font-mono leading-7">
                        {resultJsonText}
                      </pre>
                    </Section>
                  ) : null}

                  {tracebackText ? (
                    <Section
                      title="Stacktrace"
                      icon={<FileCode2 className="h-4 w-4 text-slate-500" />}
                    >
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-slate-800 bg-[#020b25] px-4 py-4 text-sm text-white font-mono leading-7 shadow-inner">
                        {tracebackText}
                      </pre>
                    </Section>
                  ) : null}

                  <Section
                    title="Runner"
                    icon={<Server className="h-4 w-4 text-slate-500" />}
                  >
                    <div className="grid gap-x-10 gap-y-7 md:grid-cols-2 xl:grid-cols-4">
                      <InfoItem
                        label="Runner name"
                        value={task.runner_details?.name || task.runner_name || "---"}
                      />
                      <InfoItem
                        label="Label"
                        value={task.runner_details?.label || task.runner_display_name || "---"}
                      />
                      <InfoItem
                        label="UUID"
                        value={task.runner_details?.uuid || "---"}
                      />
                      <InfoItem
                        label="Status"
                        value={task.runner_details?.status || "---"}
                      />

                      <InfoItem
                        label="Host name"
                        value={task.runner_details?.host_name || "---"}
                      />
                      <InfoItem
                        label="IP"
                        value={task.runner_details?.ip || "---"}
                      />
                      <InfoItem
                        label="Sistema operacional"
                        value={
                          task.runner_details?.os_name
                            ? `${task.runner_details.os_name} ${task.runner_details.os_version || ""}`.trim()
                            : "---"
                        }
                      />
                      <InfoItem
                        label="Arquitetura CPU"
                        value={task.runner_details?.cpu_arch || "---"}
                      />

                      <InfoItem
                        label="Memória total"
                        value={
                          task.runner_details?.memory_total !== null &&
                          task.runner_details?.memory_total !== undefined
                            ? formatMb(task.runner_details.memory_total)
                            : "---"
                        }
                      />
                      <InfoItem
                        label="Acesso remoto"
                        value={formatBoolean(task.runner_details?.access_remote)}
                      />
                      <InfoItem
                        label="Habilitado"
                        value={formatBoolean(task.runner_details?.enabled)}
                      />
                      <InfoItem
                        label="Último heartbeat"
                        value={formatDateTime(task.runner_details?.last_heartbeat)}
                      />
                    </div>
                  </Section>

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

                  <Section
                    title="Logs"
                    icon={<ScrollText className="h-4 w-4 text-slate-500" />}
                  >
                    {taskLogsQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando logs...
                      </div>
                    ) : taskLogsQuery.isError ? (
                      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Não foi possível carregar os logs.
                      </div>
                    ) : logs.length ? (
                      <div className="space-y-3">
                        {logs.map((log) => (
                          <div
                            key={log.id}
                            className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <span
                                className={`inline-flex w-fit items-center border px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${getLevelClasses(
                                  log.level
                                )}`}
                              >
                                {log.level}
                              </span>

                              <span className="text-xs text-slate-500">
                                {formatDateTime(log.created_at)}
                              </span>
                            </div>

                            {shouldRenderAsBlock(log.message) ? (
                              <pre className="overflow-x-auto whitespace-pre-wrap break-words px-4 py-3 text-sm text-slate-700 font-mono leading-6">
                                {log.message}
                              </pre>
                            ) : (
                              <div className="px-4 py-3 text-sm text-slate-700 break-words whitespace-pre-wrap">
                                {log.message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <FileText className="h-4 w-4" />
                        Nenhum log encontrado.
                      </div>
                    )}
                  </Section>
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
