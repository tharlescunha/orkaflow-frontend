import { api } from "./client";
import type { NotificationStep, NotificationVariable } from "./notifications";

export type EventScopeType = "automation" | "bot" | "all";
export type EventHttpMethod = "POST" | "PUT" | "PATCH" | "GET";
export type EventRunStatus = "pending" | "running" | "success" | "error" | "test";

export type EventTrigger = {
  type: string;
  label: string;
  description: string;
};

export type EventVariable = NotificationVariable;

export type EventTriggerConfig = {
  key?: string | null;
  value?: string | null;
  code?: number | null;
};

export type EventRule = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  scope_type: EventScopeType;
  scope_id: number | null;
  /** Vários alvos (bots ou automações) na mesma regra; scope_id é o primeiro. */
  scope_ids: number[];
  scope_label: string | null;
  trigger_type: string;
  trigger_label: string;
  trigger_config: EventTriggerConfig;
  pre_steps: NotificationStep[];
  url: string;
  method: EventHttpMethod;
  headers: Record<string, string>;
  body_template: string;
  timeout_seconds: number;
  last_run_at: string | null;
  last_run_ok: boolean | null;
  runs_count: number;
  created_at: string;
  updated_at: string | null;
};

export type EventRulePayload = Omit<
  EventRule,
  "id" | "scope_label" | "trigger_label" | "last_run_at" | "last_run_ok" | "runs_count" | "created_at" | "updated_at"
>;

export type EventRun = {
  id: number;
  rule_id: number | null;
  rule_name: string;
  task_id: number | null;
  automation_name: string | null;
  trigger_type: string;
  trigger_label: string;
  status: EventRunStatus;
  ok: boolean;
  status_code: number | null;
  error: string | null;
  response_snippet: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type EventRunDetail = EventRun & {
  variables: Record<string, string>;
  details: Record<string, unknown> | null;
};

export type ListEventRunsParams = {
  rule_id?: number;
  task_id?: number;
  limit?: number;
};

export async function listEventTriggers() {
  const response = await api.get<EventTrigger[]>("/api/v1/events/triggers");
  return response.data;
}

export async function listEventVariables() {
  const response = await api.get<EventVariable[]>("/api/v1/events/variables");
  return response.data;
}

export async function listEventRules(params?: { active?: boolean }) {
  const response = await api.get<EventRule[]>("/api/v1/events/rules", { params });
  return response.data;
}

export async function getEventRule(id: number) {
  const response = await api.get<EventRule>(`/api/v1/events/rules/${id}`);
  return response.data;
}

export async function createEventRule(payload: EventRulePayload) {
  const response = await api.post<EventRule>("/api/v1/events/rules", payload);
  return response.data;
}

export async function updateEventRule(id: number, payload: EventRulePayload) {
  const response = await api.put<EventRule>(`/api/v1/events/rules/${id}`, payload);
  return response.data;
}

export async function deleteEventRule(id: number) {
  const response = await api.delete<{ message: string }>(`/api/v1/events/rules/${id}`);
  return response.data;
}

export async function testEventRule(id: number, taskId?: number | null) {
  const response = await api.post<EventRunDetail>(`/api/v1/events/rules/${id}/test`, {
    task_id: taskId ?? null,
  });
  return response.data;
}

export async function listEventRuns(params: ListEventRunsParams = {}) {
  const response = await api.get<EventRun[]>("/api/v1/events/runs", { params });
  return response.data;
}

export async function getEventRun(id: number) {
  const response = await api.get<EventRunDetail>(`/api/v1/events/runs/${id}`);
  return response.data;
}
