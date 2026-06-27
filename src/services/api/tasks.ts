import { api } from "./client";

export type TaskStatus =
  | "waiting"
  | "scheduled"
  | "ready"
  | "running"
  | "stop_requested"
  | "forced_stop"
  | "canceled"
  | "finished"
  | "error"
  | "timeout";

export type TaskListItem = {
  id: number;
  automation_id: number;
  automation_name?: string | null;
  bot_version_id: number;
  bot_version_label?: string | null;
  runner_id?: number | null;
  runner_name?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  schedule_id?: number | null;
  priority: number;
  status: TaskStatus;
  requested_start_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  last_update_at?: string | null;
  created_at: string;
  items_processed: number;
  items_failed: number;
  execution_mode: string;
  stop_requested: boolean;
  correlation_id?: string | null;
  queue_name?: string | null;
  execution_duration_seconds?: number | null;
  final_message?: string | null;
};

export type TaskListResponse = {
  items: TaskListItem[];
  total: number;
};

export type TaskParameter = {
  id: number;
  task_id: number;
  parameter_name: string;
  parameter_value: string | null;
  is_secret: boolean;
  resolved_from_credential_item_id: number | null;
};

export type TaskTelemetry = {
  id: number;
  task_id: number;
  runner_id: number | null;
  captured_at: string | null;
  execution_started_at: string | null;
  execution_finished_at: string | null;
  duration_seconds: number | null;
  cpu_percent_avg: number | null;
  cpu_percent_peak: number | null;
  memory_used_mb_avg: number | null;
  memory_used_mb_peak: number | null;
  process_memory_mb_peak: number | null;
  disk_read_mb: number | null;
  disk_write_mb: number | null;
  net_sent_mb: number | null;
  net_recv_mb: number | null;
  exit_code: number | null;
  telemetry_status: string | null;
  message: string | null;
  payload_json: string | null;
  created_at: string;
};

export type RunnerConfigRead = {
  id: number;
  runner_id: number;
  max_concurrency: number;
  allowed_parallel_bots?: Record<string, unknown> | null;
  polling_interval: number;
  auto_update_bots: boolean;
  install_all_bots_on_register: boolean;
  maintenance_mode: boolean;
  created_at: string;
  updated_at: string | null;
};

export type RunnerDetailsRead = {
  id: number;
  uuid: string;
  name: string;
  label: string | null;
  host_name: string | null;
  ip: string | null;
  os_name: string | null;
  os_version: string | null;
  cpu_arch: string | null;
  memory_total: number | null;
  access_remote: boolean;
  enabled: boolean;
  status: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string | null;
  config: RunnerConfigRead | null;
};

export type RunnerUsageRead = {
  period_start: string | null;
  period_end: string | null;
  available_seconds: number | null;
  execution_seconds: number | null;
  usage_percent: number | null;
};

export type TaskRead = {
  id: number;
  automation_id: number;
  automation_name?: string | null;
  bot_version_id: number;
  bot_version_label?: string | null;
  runner_id: number | null;
  runner_name?: string | null;
  runner_label?: string | null;
  runner_display_name?: string | null;
  created_by: number | null;
  created_by_name?: string | null;
  schedule_id: number | null;
  schedule_name?: string | null;
  parent_task_id: number | null;
  priority: number;
  status: TaskStatus;
  requested_start_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  last_update_at: string | null;
  final_message: string | null;
  result_json: string | null;
  items_processed: number;
  items_failed: number;
  timeout_seconds: number;
  retry_count: number;
  execution_mode: string;
  dispatch_attempts: number;
  stop_requested: boolean;
  correlation_id: string | null;
  queue_name: string | null;
  inactivity_timeout_seconds: number | null;
  runner_claimed_at: string | null;
  created_at: string;
  updated_at: string | null;
  parameters: TaskParameter[];
  telemetry?: TaskTelemetry | null;
  runner_details?: RunnerDetailsRead | null;
  runner_usage?: RunnerUsageRead | null;
  execution_duration_seconds?: number | null;
};

export type TaskLogItem = {
  id: number;
  task_id: number;
  level: string;
  message: string;
  reference?: string | null;
  error_type?: string | null;
  source?: string | null;
  sequence_number?: number | null;
  runner_id?: number | null;
  event_code?: string | null;
  created_at: string;
};

export type TaskLogListResponse = {
  items: TaskLogItem[];
  total: number;
};

export type CreateTaskParameterPayload = {
  parameter_name: string;
  parameter_value: string | null;
  is_secret?: boolean;
  resolved_from_credential_item_id?: number | null;
};

export type CreateTaskPayload = {
  automation_id: number;
  bot_version_id?: number | null;
  runner_id?: number | null;
  schedule_id?: number | null;
  parent_task_id?: number | null;
  priority?: number;
  requested_start_at?: string | null;
  timeout_seconds?: number | null;
  execution_mode?: string;
  correlation_id?: string | null;
  queue_name?: string | null;
  inactivity_timeout_seconds?: number | null;
  parameters?: CreateTaskParameterPayload[];
};

export type TaskManualCreateResponse = {
  message: string;
  task: TaskRead;
};

export type TaskFilterOptionItem = {
  id: number;
  name: string;
  label?: string | null;
};

export type TaskFilterOptionsResponse = {
  automations: TaskFilterOptionItem[];
  runners: TaskFilterOptionItem[];
  statuses: TaskStatus[];
};

export type ListTasksParams = {
  skip?: number;
  limit?: number;

  // legado
  status?: TaskStatus;
  automation_id?: number;
  runner_id?: number;

  // novo multi-filtro
  statuses?: TaskStatus[];
  automation_ids?: number[];
  runner_ids?: number[];
};

export async function listTasks(params: ListTasksParams = {}) {
  const response = await api.get<TaskListResponse>("/api/v1/tasks/", {
    params,
    paramsSerializer: {
      indexes: null,
    },
  });
  return response.data;
}

export async function listTaskFilterOptions() {
  const response = await api.get<TaskFilterOptionsResponse>(
    "/api/v1/tasks/filter-options"
  );
  return response.data;
}

export async function getTask(taskId: number) {
  const response = await api.get<TaskRead>(`/api/v1/tasks/${taskId}`);
  return response.data;
}

export async function createTask(payload: CreateTaskPayload) {
  const response = await api.post<TaskManualCreateResponse>(
    "/api/v1/tasks/",
    payload
  );
  return response.data;
}

export async function cancelTask(taskId: number) {
  const response = await api.post(`/api/v1/tasks/${taskId}/cancel`);
  return response.data;
}

export async function forceStopTask(taskId: number) {
  const response = await api.post(`/api/v1/tasks/${taskId}/force-stop`);
  return response.data;
}

export async function listTaskLogs(taskId: number) {
  const response = await api.get<TaskLogListResponse>(
    `/api/v1/task-logs/task/${taskId}`
  );
  return response.data;
}
