import { api } from "./client";

export type BotVersionRead = {
  id: number;
  bot_id: number;
  bot_name?: string | null;
  version: string;
  storage_type: string;
  commit_hash?: string | null;
  branch?: string | null;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;
  commit_author?: string | null;
  committed_at?: string | null;
  created_by?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
  // Versão que o orquestrador executa hoje (fixada por Release ou a mais nova).
  in_use?: boolean;
  pinned?: boolean;
};

export type CreateBotVersionPayload = {
  bot_id: number;
  version: string;
  storage_type: string;
  commit_hash?: string | null;
  branch?: string | null;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;
  commit_author?: string | null;
  committed_at?: string | null;
  is_active: boolean;
};

export type GitCommitRead = {
  hash: string;
  short: string;
  author: string;
  committed_at: string;
  message: string;
};

export type BotVersionGitStatus = "sincronizado" | "nova_versao" | "ja_registrado";

export type BotVersionGitPreview = {
  bot_id: number;
  bot_name: string;
  status: BotVersionGitStatus;
  message: string;
  branch: string;
  repository: string;
  head: GitCommitRead;
  commits: GitCommitRead[];
  suggested_version: string;
  changelog: string;
  last_version?: string | null;
  last_commit?: string | null;
  existing_version_id?: number | null;
  existing_version?: string | null;
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

// Lê o Git do bot e sugere a nova versão (número, commit, changelog). Não grava nada.
// O git pode demorar no primeiro acesso ao repositório, por isso o timeout maior.
export async function getBotVersionGitPreview(botId: number) {
  const response = await api.get<BotVersionGitPreview>(
    "/api/v1/bot-versions/git-preview",
    { params: { bot_id: botId }, timeout: 120_000 }
  );
  return response.data;
}

// Passa a executar esta versão. Na mais nova, o bot volta a seguir sempre a mais nova.
export async function releaseBotVersion(botVersionId: number) {
  const response = await api.post<BotVersionRead>(
    `/api/v1/bot-versions/${botVersionId}/release`
  );
  return response.data;
}
