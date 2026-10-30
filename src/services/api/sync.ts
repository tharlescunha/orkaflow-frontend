import { api } from "./client";

export type SyncCheck = {
  id: number;
  name: string;
  url: string;
  server: string | null;
  project: string | null;
  interval_seconds: number;
  expected_status: number | null;
  timeout_seconds: number;
  active: boolean;
  last_ping_at: string | null;
  last_ok: boolean | null;
  last_status_code: number | null;
  last_latency_ms: number | null;
  last_error: string | null;
};

export type SyncCheckPayload = {
  name: string;
  url: string;
  server: string | null;
  project: string | null;
  interval_seconds: number;
  expected_status: number | null;
  timeout_seconds: number;
  active: boolean;
};

export type SyncState = { automation_ids: number[]; checks: SyncCheck[] };

export async function setSyncPreference(sync_enabled: boolean) {
  const response = await api.put<{ sync_enabled: boolean }>("/api/v1/sync/preference", { sync_enabled });
  return response.data;
}

export async function getSyncState() {
  const response = await api.get<SyncState>("/api/v1/sync/state");
  return response.data;
}

export async function setSyncPicks(automation_ids: number[]) {
  const response = await api.put<{ automation_ids: number[] }>("/api/v1/sync/picks", { automation_ids });
  return response.data;
}

export async function createSyncCheck(payload: SyncCheckPayload) {
  const response = await api.post<SyncCheck>("/api/v1/sync/checks", payload);
  return response.data;
}

export async function updateSyncCheck(id: number, payload: SyncCheckPayload) {
  const response = await api.put<SyncCheck>(`/api/v1/sync/checks/${id}`, payload);
  return response.data;
}

export async function deleteSyncCheck(id: number) {
  const response = await api.delete<{ message: string }>(`/api/v1/sync/checks/${id}`);
  return response.data;
}

export async function pingSyncCheck(id: number) {
  const response = await api.post<SyncCheck>(`/api/v1/sync/checks/${id}/ping`);
  return response.data;
}
