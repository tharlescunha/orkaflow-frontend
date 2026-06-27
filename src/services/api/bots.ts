import { api } from "./client";
import type {
  BotListResponse,
  BotRead,
  CreateBotPayload,
  UpdateBotPayload,
} from "@/types/bot";

type ListBotsParams = {
  skip?: number;
  limit?: number;
  search?: string;
  repository_id?: number;
  active?: boolean;
};

export async function listBots(params: ListBotsParams = {}) {
  const response = await api.get<BotListResponse>("/api/v1/bots/", {
    params,
  });

  return response.data;
}

export async function getBot(botId: number) {
  const response = await api.get<BotRead>(`/api/v1/bots/${botId}`);
  return response.data;
}

export async function createBot(payload: CreateBotPayload) {
  const response = await api.post<BotRead>("/api/v1/bots/", payload);
  return response.data;
}

export async function updateBot(botId: number, payload: UpdateBotPayload) {
  const response = await api.put<BotRead>(`/api/v1/bots/${botId}`, payload);
  return response.data;
}

export async function deleteBot(botId: number) {
  const response = await api.delete(`/api/v1/bots/${botId}`);
  return response.data;
}
