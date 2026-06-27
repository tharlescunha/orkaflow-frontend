import { api } from "./client";

export type AutomationRead = {
  id: number;
  name: string;
  label?: string | null;
  description?: string | null;
  bot_id: number;
  bot_name?: string | null;
  repository_id: number;
  repository_name?: string | null;
  default_priority: number;
  notification_type?: string | null;
  active: boolean;
  exclusive_group_ids?: number[];
  exclusive_groups?: AutomationExclusiveGroupRead[];
  success_trigger_automation_ids?: number[];
  success_triggers?: AutomationSuccessTriggerRead[];
  default_parameters_json?: Record<string, unknown> | null;
  default_runtime_parameters_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
};

export type AutomationSuccessTriggerRead = {
  id: number;
  source_automation_id: number;
  target_automation_id: number;
  target_automation_name?: string | null;
  priority_override?: number | null;
  inherit_parent_parameters: boolean;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AutomationExclusiveGroupRead = {
  id: number;
  name: string;
  label?: string | null;
  description?: string | null;
  capacity: number;
  active: boolean;
  automation_ids?: number[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateAutomationExclusiveGroupPayload = {
  name: string;
  label?: string | null;
  description?: string | null;
  capacity?: number;
  active?: boolean;
};

export type ListAutomationsParams = {
  active?: boolean;
  repository_id?: number;
  bot_id?: number;
};

export type CreateAutomationPayload = {
  name: string;
  label?: string | null;
  description?: string | null;
  bot_id: number;
  repository_id: number;
  default_priority?: number;
  active?: boolean;
  exclusive_group_ids?: number[];
  success_trigger_automation_ids?: number[];
  default_parameters_json?: Record<string, unknown> | null;
  default_runtime_parameters_json?: Record<string, unknown> | null;
};

export type UpdateAutomationPayload = {
  name?: string;
  label?: string | null;
  description?: string | null;
  bot_id?: number;
  repository_id?: number;
  default_priority?: number;
  active?: boolean;
  exclusive_group_ids?: number[];
  success_trigger_automation_ids?: number[];
  default_parameters_json?: Record<string, unknown> | null;
  default_runtime_parameters_json?: Record<string, unknown> | null;
};

export type AutomationRunnerRead = {
  id: number;
  automation_id: number;
  runner_id: number;
  runner_name?: string | null;
  runner_label?: string | null;
  runner_status?: string | null;
  runner_enabled?: boolean | null;
  created_at?: string | null;
};

export async function listAutomations(params?: ListAutomationsParams) {
  const response = await api.get<AutomationRead[]>("/api/v1/automations/", {
    params,
  });
  return response.data;
}

export async function listAutomationExclusiveGroups(params?: { active?: boolean }) {
  const response = await api.get<AutomationExclusiveGroupRead[]>(
    "/api/v1/automations/exclusive-groups/",
    { params }
  );
  return response.data;
}

export async function createAutomationExclusiveGroup(
  payload: CreateAutomationExclusiveGroupPayload
) {
  const response = await api.post<AutomationExclusiveGroupRead>(
    "/api/v1/automations/exclusive-groups/",
    payload
  );
  return response.data;
}

export async function getAutomation(automationId: number) {
  const response = await api.get<AutomationRead>(`/api/v1/automations/${automationId}`);
  return response.data;
}

export async function createAutomation(payload: CreateAutomationPayload) {
  const response = await api.post<AutomationRead>("/api/v1/automations/", payload);
  return response.data;
}

export async function updateAutomation(
  automationId: number,
  payload: UpdateAutomationPayload
) {
  const response = await api.put<AutomationRead>(
    `/api/v1/automations/${automationId}`,
    payload
  );
  return response.data;
}

export async function activateAutomation(automationId: number) {
  const response = await api.post<AutomationRead>(
    `/api/v1/automations/${automationId}/activate`
  );
  return response.data;
}

export async function deactivateAutomation(automationId: number) {
  const response = await api.post<AutomationRead>(
    `/api/v1/automations/${automationId}/deactivate`
  );
  return response.data;
}

export async function listAutomationRunners(automationId: number) {
  const response = await api.get<AutomationRunnerRead[]>(
    `/api/v1/automations/${automationId}/runners`
  );
  return response.data;
}

export async function linkRunnerToAutomation(
  automationId: number,
  runnerId: number
) {
  const response = await api.post<AutomationRunnerRead>(
    `/api/v1/automations/${automationId}/runners`,
    { runner_id: runnerId }
  );
  return response.data;
}

export async function unlinkRunnerFromAutomation(
  automationId: number,
  linkId: number
) {
  await api.delete(`/api/v1/automations/${automationId}/runners/${linkId}`);
}
