export type ScheduleType = "calendar" | "cron";

export type CalendarType =
  | "once"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month";

export type SchedulePolicy =
  | "create_always"
  | "ignore_if_running"
  | "enqueue_if_none_pending"
  | "run_if_missed"
  | "skip_if_missed";

export type ScheduleStatus = "active" | "inactive" | "paused" | "error";

export type ScheduleRead = {
  id: number;
  name: string;
  automation_id: number;
  priority: number;
  schedule_type: ScheduleType;
  calendar_type?: CalendarType | null;
  cron_expression?: string | null;
  policy: SchedulePolicy;
  runtime_parameters_json?: Record<string, unknown> | null;
  use_default_runtime_parameters: boolean;
  timezone: string;
  active: boolean;
  status?: ScheduleStatus | null;
  start_at?: string | null;
  end_at?: string | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  interval_value?: number | null;
  interval_unit?: string | null;
  misfire_policy?: string | null;
  created_at: string;
  updated_at: string;
};

export type ListSchedulesParams = {
  automation_id?: number;
  active?: boolean;
  status?: string;
};

export type CreateSchedulePayload = {
  name: string;
  automation_id: number;
  priority: number;
  schedule_type: ScheduleType;
  calendar_type?: CalendarType | null;
  cron_expression?: string | null;
  policy: SchedulePolicy;
  runtime_parameters_json?: Record<string, unknown> | null;
  use_default_runtime_parameters: boolean;
  timezone: string;
  active: boolean;
};

export type UpdateSchedulePayload = {
  name?: string;
  automation_id?: number;
  priority?: number;
  schedule_type?: ScheduleType;
  calendar_type?: CalendarType | null;
  cron_expression?: string | null;
  policy?: SchedulePolicy;
  runtime_parameters_json?: Record<string, unknown> | null;
  use_default_runtime_parameters?: boolean;
  timezone?: string;
  active?: boolean;
  status?: ScheduleStatus;
  start_at?: string | null;
  end_at?: string | null;
  interval_value?: number | null;
  interval_unit?: string | null;
  misfire_policy?: string | null;
};
