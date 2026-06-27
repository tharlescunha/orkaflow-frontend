import { api } from "./client";

export type RunnerConfigRead = {
  id: number;
  runner_id: number;
  max_concurrency: number;
  allowed_parallel_bots?: Record<string, unknown> | unknown[] | null;
  polling_interval: number;
  auto_update_bots: boolean;
  install_all_bots_on_register: boolean;
  maintenance_mode: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type RunnerRead = {
  id: number;
  uuid: string;
  name: string;
  label?: string | null;
  host_name?: string | null;
  ip?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  cpu_arch?: string | null;
  memory_total?: number | null;
  access_remote: boolean;
  enabled: boolean;
  status: string;
  last_heartbeat?: string | null;
  created_at: string;
  updated_at?: string | null;
  config?: RunnerConfigRead | null;
  linked_tasks_count?: number;
  linked_bots_count?: number;
  running_tasks_count?: number;
  has_running_task?: boolean;
  last_screenshot_at?: string | null;
  has_screenshot?: boolean;
};

export type ListRunnersParams = {
  skip?: number;
  limit?: number;
  enabled?: boolean;
  status?: string;
};

export type UpdateRunnerPayload = {
  name?: string;
  label?: string | null;
  host_name?: string | null;
  ip?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  cpu_arch?: string | null;
  memory_total?: number | null;
  access_remote?: boolean;
  enabled?: boolean;
  status?: string;
};

export type UpdateRunnerConfigPayload = {
  max_concurrency?: number;
  allowed_parallel_bots?: Record<string, unknown> | unknown[] | null;
  polling_interval?: number;
  auto_update_bots?: boolean;
  install_all_bots_on_register?: boolean;
  maintenance_mode?: boolean;
};

export async function listRunners(params?: ListRunnersParams) {
  const response = await api.get<RunnerRead[]>("/api/v1/runners/", {
    params,
  });

  return response.data;
}

export async function getRunner(runnerId: number) {
  const response = await api.get<RunnerRead>(`/api/v1/runners/${runnerId}`);

  return response.data;
}

export async function getRunnerScreenshotBlobUrl(runnerId: number) {
  const response = await api.get<Blob>(
    `/api/v1/runners/${runnerId}/screenshot`,
    {
      responseType: "blob",
      headers: {
        Accept: "image/png,image/jpeg,image/*",
      },
    }
  );

  return URL.createObjectURL(response.data);
}

export async function updateRunner(
  runnerId: number,
  payload: UpdateRunnerPayload
) {
  const response = await api.put<RunnerRead>(
    `/api/v1/runners/${runnerId}`,
    payload
  );

  return response.data;
}

export async function activateRunner(runnerId: number) {
  return updateRunner(runnerId, { enabled: true });
}

export async function disableRunner(runnerId: number) {
  return updateRunner(runnerId, { enabled: false });
}

export async function getRunnerConfig(runnerId: number) {
  const response = await api.get<RunnerConfigRead>(
    `/api/v1/runners/${runnerId}/config`
  );

  return response.data;
}

export async function updateRunnerConfig(
  runnerId: number,
  payload: UpdateRunnerConfigPayload
) {
  const response = await api.put<RunnerConfigRead>(
    `/api/v1/runners/${runnerId}/config`,
    payload
  );

  return response.data;
}

export type RunnerOverviewLinkedBot = {
  bot_id: number;
  bot_name?: string | null;
};

export type RunnerOverviewTaskItem = {
  task_id: number;
  automation_id?: number | null;
  automation_name?: string | null;
  status: string;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  execution_duration_seconds?: number | null;
  final_message?: string | null;
};

export type RunnerOverviewResponse = {
  runner: {
    id: number;
    uuid: string;
    name: string;
    label?: string | null;
    host_name?: string | null;
    ip?: string | null;
    os_name?: string | null;
    os_version?: string | null;
    cpu_arch?: string | null;
    memory_total?: number | null;
    access_remote: boolean;
    enabled: boolean;
    status: string;
    created_at: string;
    updated_at?: string | null;
    last_heartbeat?: string | null;
    last_screenshot_at?: string | null;
    has_screenshot?: boolean;
  };
  summary: {
    linked_bots_count: number;
    running_tasks_count: number;
    waiting_tasks_count: number;
    scheduled_tasks_count: number;
    ready_tasks_count: number;
    stop_requested_tasks_count: number;
    finished_tasks_count: number;
    error_tasks_count: number;
    timeout_tasks_count: number;
    canceled_tasks_count: number;
    forced_stop_tasks_count: number;
    executed_total_count: number;
    success_total_count: number;
    error_total_count: number;
  };
  utilization: {
    registered_seconds: number;
    execution_seconds: number;
    utilization_percent: number;
  };
  queue: {
    waiting_tasks_count: number;
    oldest_waiting_task_id?: number | null;
    oldest_waiting_automation_name?: string | null;
    oldest_waiting_since?: string | null;
    oldest_waiting_seconds?: number | null;
  };
  last_execution: {
    task_id?: number | null;
    automation_id?: number | null;
    automation_name?: string | null;
    status?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    execution_duration_seconds?: number | null;
    final_message?: string | null;
  };
  linked_bots: RunnerOverviewLinkedBot[];
  running_tasks: RunnerOverviewTaskItem[];
  recent_tasks: RunnerOverviewTaskItem[];
};

export async function getRunnerOverview(
  runnerId: number,
  params?: {
    date_from?: string;
    date_to?: string;
    task_status?: string;
    automation_id?: number;
  }
) {
  const response = await api.get<RunnerOverviewResponse>(
    `/api/v1/runners/${runnerId}/overview`,
    { params }
  );

  return response.data;
}
