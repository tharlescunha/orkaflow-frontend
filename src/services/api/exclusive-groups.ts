import { api } from "./client";

/** Grupo exclusivo: automações que não rodam ao mesmo tempo, mesmo em máquinas diferentes. */
export type ExclusiveGroupMember = {
  id: number;
  name: string;
  label?: string | null;
  active: boolean;
};

export type ExclusiveGroupLock = {
  task_id: number;
  automation_id?: number | null;
  automation_name?: string | null;
  runner_id?: number | null;
  runner_name?: string | null;
  acquired_at?: string | null;
};

export type ExclusiveGroupRead = {
  id: number;
  name: string;
  label?: string | null;
  description?: string | null;
  capacity: number;
  active: boolean;
  automation_ids: number[];
  automations: ExclusiveGroupMember[];
  current_lock?: ExclusiveGroupLock | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ExclusiveGroupPayload = {
  name: string;
  label?: string | null;
  description?: string | null;
  active: boolean;
  automation_ids: number[];
};

const BASE = "/api/v1/automations/exclusive-groups";

export async function listExclusiveGroups(params?: { active?: boolean }) {
  const response = await api.get<ExclusiveGroupRead[]>(`${BASE}/`, { params });
  return response.data;
}

export async function getExclusiveGroup(groupId: number) {
  const response = await api.get<ExclusiveGroupRead>(`${BASE}/${groupId}`);
  return response.data;
}

export async function createExclusiveGroup(payload: ExclusiveGroupPayload) {
  const response = await api.post<ExclusiveGroupRead>(`${BASE}/`, { ...payload, capacity: 1 });
  return response.data;
}

export async function updateExclusiveGroup(groupId: number, payload: Partial<ExclusiveGroupPayload>) {
  const response = await api.put<ExclusiveGroupRead>(`${BASE}/${groupId}`, payload);
  return response.data;
}

export async function deleteExclusiveGroup(groupId: number) {
  await api.delete(`${BASE}/${groupId}`);
}
