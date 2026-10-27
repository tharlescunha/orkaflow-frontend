import { api } from "./client";
import type {
  BotListResponse,
  BotRead,
  BotSourceInspection,
  BotCreatePayload as CreateBotPayload,
  BotUpdatePayload as UpdateBotPayload,
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

// O backend devolve no máximo 100 bots por chamada (limit > 100 dá 422).
// Para selects e filtros que precisam de todos, busca página por página.
const BOTS_PAGE_SIZE = 100;

export async function listAllBots(
  params: Omit<ListBotsParams, "skip" | "limit"> = {}
): Promise<BotListResponse> {
  const items: BotListResponse["items"] = [];
  let total = 0;

  for (let skip = 0; ; skip += BOTS_PAGE_SIZE) {
    const page = await listBots({ ...params, skip, limit: BOTS_PAGE_SIZE });
    items.push(...page.items);
    total = page.total;
    if (page.items.length < BOTS_PAGE_SIZE || items.length >= total) break;
  }

  return { items, total };
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

/** Confere se o link do Git funciona e traz nome, descrição, último commit e última tag. Nada é gravado. */
export async function inspectBotSource(sourceUrl: string) {
  const response = await api.post<BotSourceInspection>("/api/v1/bots/inspect-source", { source_url: sourceUrl });
  return response.data;
}
