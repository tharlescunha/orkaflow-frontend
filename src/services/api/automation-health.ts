import { api } from "./client";

export type AutomationHealthStatus =
  | "success"
  | "running"
  | "warning"
  | "error";

export type AutomationHealthTaskRead = {
  id?: number | null;
  status?: string | null;
  runner_id?: number | null;
  runner_name?: string | null;
  runner_label?: string | null;
  runner_display_name?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  last_update_at?: string | null;
  final_message?: string | null;
  execution_duration_seconds?: number | null;
};

export type AutomationHealthScheduleRead = {
  id: number;
  name: string;
  schedule_type: "calendar" | "cron";
  calendar_type?:
    | "once"
    | "second"
    | "minute"
    | "hour"
    | "day"
    | "week"
    | "month"
    | null;
  cron_expression?: string | null;
  interval_value?: number | null;
  interval_unit?: string | null;
  timezone: string;
  active: boolean;
  status?: "active" | "inactive" | "paused" | "error" | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  expected_interval_seconds?: number | null;
  rule_label?: string | null;
};

export type AutomationHealthItemRead = {
  automation_id: number;
  automation_name: string;
  automation_label?: string | null;
  automation_description?: string | null;
  automation_active: boolean;

  repository_id?: number | null;
  repository_name?: string | null;

  bot_id?: number | null;
  bot_name?: string | null;
  bot_active?: boolean | null;

  health_status: AutomationHealthStatus;
  health_label: string;
  status_color: "green" | "green_soft" | "yellow" | "red" | string;

  monitored_at: string;
  last_execution_at?: string | null;
  is_overdue: boolean;
  has_recent_success: boolean;
  has_recent_error: boolean;
  has_running_task: boolean;

  machine_name?: string | null;
  machine_label?: string | null;
  machine_display_name?: string | null;

  schedule?: AutomationHealthScheduleRead | null;
  last_task?: AutomationHealthTaskRead | null;
};

export type AutomationHealthListResponse = {
  items: AutomationHealthItemRead[];
  total: number;
};

export type ListAutomationHealthParams = {
  repository_id?: number;
  bot_id?: number;
  active?: boolean;
};

export async function listAutomationHealth(
  params?: ListAutomationHealthParams
) {
  const response = await api.get<AutomationHealthListResponse>(
    "/api/v1/automation-health/",
    {
      params,
    }
  );

  return response.data;
}
