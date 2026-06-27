import { api } from "./client";

export type BotVersionRead = {
  id: number;
  bot_id: number;
  bot_name?: string | null;
  version: string;
  storage_type: string;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;
  created_by?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type CreateBotVersionPayload = {
  bot_id: number;
  version: string;
  storage_type: string;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;
  is_active: boolean;
};

export async function listBotVersions() {
  const response = await api.get<BotVersionRead[]>("/api/v1/bot-versions/");
  return response.data;
}

export async function getBotVersion(botVersionId: number) {
  const response = await api.get<BotVersionRead>(
    `/api/v1/bot-versions/${botVersionId}`
  );
  return response.data;
}

export async function createBotVersion(payload: CreateBotVersionPayload) {
  const response = await api.post<BotVersionRead>(
    "/api/v1/bot-versions/",
    payload
  );
  return response.data;
}
