import { api } from "./client";

export type HttpMethod = "POST" | "PUT" | "PATCH";

export type StepMethod = "GET" | "POST" | "PUT" | "PATCH";

export type StepExtract = { variable: string; path: string };

export type NotificationStep = {
  name: string;
  method: StepMethod;
  url: string;
  headers: Record<string, string>;
  body_template: string;
  extract: StepExtract[];
};

export type NotificationChannel = {
  id: number;
  name: string;
  enabled: boolean;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body_template: string;
  pre_steps?: NotificationStep[];
  timeout_seconds: number;
  failure_threshold: number;
  pause_schedule: boolean;
  deactivate_automation: boolean;
  panel_base_url: string | null;
  updated_at: string | null;
};

export type UpdateNotificationChannelPayload = Partial<
  Omit<NotificationChannel, "id" | "updated_at">
>;

export type NotificationTestStep = {
  name: string;
  ok: boolean;
  status_code: number | null;
  error: string | null;
  extracted: string[];
};

export type NotificationTestResult = {
  steps?: NotificationTestStep[];
  ok: boolean;
  status_code: number | null;
  response_snippet: string | null;
  error: string | null;
  request_preview: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  };
};

export type NotificationLog = {
  id: number;
  created_at: string;
  kind: "failure_alert" | "test";
  schedule_id: number | null;
  schedule_name: string | null;
  automation_name: string | null;
  task_ids: string | null;
  ok: boolean;
  status_code: number | null;
  error: string | null;
  response_snippet: string | null;
  paused_schedule: boolean;
};

export type NotificationLogDetail = NotificationLog & {
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
  } | null;
  steps: NotificationTestStep[] | null;
  response_body: string | null;
};

export type NotificationVariable = {
  name: string;
  description: string;
  example: string;
};

export async function getNotificationChannel() {
  const response = await api.get<NotificationChannel>("/api/v1/notifications/channel");
  return response.data;
}

export async function updateNotificationChannel(payload: UpdateNotificationChannelPayload) {
  const response = await api.put<NotificationChannel>(
    "/api/v1/notifications/channel",
    payload
  );
  return response.data;
}

export async function testNotificationChannel() {
  const response = await api.post<NotificationTestResult>(
    "/api/v1/notifications/channel/test"
  );
  return response.data;
}

export async function listNotificationLogs(limit = 50) {
  const response = await api.get<NotificationLog[]>("/api/v1/notifications/logs", {
    params: { limit },
  });
  return response.data;
}

export async function getNotificationLog(id: number) {
  const response = await api.get<NotificationLogDetail>(`/api/v1/notifications/logs/${id}`);
  return response.data;
}

export async function listNotificationVariables() {
  const response = await api.get<NotificationVariable[]>(
    "/api/v1/notifications/variables"
  );
  return response.data;
}
