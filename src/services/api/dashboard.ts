import { api } from "./client";

export type DashboardPeriod = "1d" | "7d" | "15d" | "30d";

export type DashboardQueryParams = {
  period?: DashboardPeriod;
  repository_id?: number;
  runner_id?: number;
  bot_id?: number;
};

export type DashboardTaskStatus =
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

export type DashboardRunnerStatus =
  | "online"
  | "offline"
  | "busy"
  | "maintenance"
  | "blocked";

export type DashboardOverviewSummary = {
  total_runners: number;
  online_runners: number;
  offline_runners: number;
  busy_runners: number;

  total_bots: number;
  total_tasks: number;

  success_tasks: number;
  error_tasks: number;
  running_tasks: number;
  queued_tasks: number;

  success_rate_percent: number;
  avg_queue_seconds: number;
  avg_execution_seconds: number;
};

export type DashboardTasksPerHourItem = {
  hour_label: string;
  total_tasks: number;
  execution_seconds: number;
};

export type DashboardRecentTaskItem = {
  task_id: number;
  automation_id: number | null;
  automation_name: string | null;
  bot_id: number | null;
  bot_name: string | null;
  runner_id: number | null;
  runner_name: string | null;
  status: DashboardTaskStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  queue_seconds: number | null;
  execution_duration_seconds: number | null;
  final_message: string | null;
};

export type DashboardOverviewResponse = {
  period: DashboardPeriod;
  date_from: string;
  date_to: string;
  summary: DashboardOverviewSummary;
  tasks_per_hour: DashboardTasksPerHourItem[];
  recent_tasks: DashboardRecentTaskItem[];
};

export type DashboardRunnerBotRef = {
  bot_id: number;
  bot_name: string;
};

export type DashboardRunnerLastExecution = {
  task_id: number | null;
  automation_id: number | null;
  automation_name: string | null;
  status: DashboardTaskStatus | null;
  started_at: string | null;
  finished_at: string | null;
  execution_duration_seconds: number | null;
  final_message: string | null;
};

export type DashboardRunnerMetrics = {
  runner_id: number;
  runner_name: string;
  runner_label: string | null;

  status: DashboardRunnerStatus | string;
  enabled: boolean;
  last_heartbeat: string | null;

  linked_bots_count: number;
  linked_bots: DashboardRunnerBotRef[];

  total_tasks: number;
  success_tasks: number;
  error_tasks: number;
  running_tasks: number;
  queued_tasks: number;

  utilization_percent: number;
  avg_queue_seconds: number;
  avg_execution_seconds: number;

  hottest_hour_label: string | null;
  hottest_hour_tasks: number;

  last_execution: DashboardRunnerLastExecution | null;
};

export type DashboardRunnersResponse = {
  period: DashboardPeriod;
  date_from: string;
  date_to: string;
  items: DashboardRunnerMetrics[];
  total: number;
};

export type DashboardBotMachineRef = {
  runner_id: number;
  runner_name: string;
};

export type DashboardBotMetrics = {
  bot_id: number;
  bot_name: string;
  execution_mode: string | null;
  current_version: string | null;
  active: boolean;

  total_tasks: number;
  success_tasks: number;
  error_tasks: number;
  running_tasks: number;
  queued_tasks: number;

  avg_queue_seconds: number;
  avg_execution_seconds: number;
  success_rate_percent: number;

  runners: DashboardBotMachineRef[];
  last_execution_status: DashboardTaskStatus | null;
  last_execution_at: string | null;
};

export type DashboardBotsResponse = {
  period: DashboardPeriod;
  date_from: string;
  date_to: string;
  items: DashboardBotMetrics[];
  total: number;
};

export async function getDashboardOverview(
  params: DashboardQueryParams = {}
) {
  const response = await api.get<DashboardOverviewResponse>(
    "/api/v1/dashboard/overview",
    {
      params,
    }
  );

  return response.data;
}

export async function getDashboardRunners(
  params: DashboardQueryParams = {}
) {
  const response = await api.get<DashboardRunnersResponse>(
    "/api/v1/dashboard/runners",
    {
      params,
    }
  );

  return response.data;
}

export async function getDashboardBots(
  params: DashboardQueryParams = {}
) {
  const response = await api.get<DashboardBotsResponse>(
    "/api/v1/dashboard/bots",
    {
      params,
    }
  );

  return response.data;
}
