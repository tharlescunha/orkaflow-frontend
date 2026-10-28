import { api } from "./client";

/** Situação do token do ambiente: válido, vence em até 15 dias, ou já venceu. */
export type GitEnvironmentExpiry = "valido" | "vence_em_breve" | "vencido";

export type GitEnvironment = {
  id: number;
  name: string;
  /** Começo dos links que este ambiente cobre, ex.: https://dev.azure.com/alzgraos/ */
  url_prefix: string;
  username: string | null;
  /** Últimos caracteres do token, só para reconhecer; o valor nunca volta. */
  token_hint: string | null;
  expires_at: string | null;
  expiry_status: GitEnvironmentExpiry;
  days_to_expire: number | null;
  active: boolean;
  created_at: string;
  updated_at: string | null;
};

export type GitEnvironmentPayload = {
  name: string;
  url_prefix: string;
  /** Vazio na edição mantém o token salvo. */
  token?: string | null;
  username?: string | null;
  expires_at?: string | null;
  active: boolean;
};

export type GitUrlCheck = {
  token_source: "link" | "ambiente" | "nenhum";
  environment_id: number | null;
  environment_name: string | null;
  expiry_status: GitEnvironmentExpiry | null;
  days_to_expire: number | null;
  message: string;
};

export async function listGitEnvironments() {
  const response = await api.get<GitEnvironment[]>("/api/v1/settings/git-environments");
  return response.data;
}

export async function createGitEnvironment(payload: GitEnvironmentPayload) {
  const response = await api.post<GitEnvironment>("/api/v1/settings/git-environments", payload);
  return response.data;
}

export async function updateGitEnvironment(id: number, payload: GitEnvironmentPayload) {
  const response = await api.put<GitEnvironment>(`/api/v1/settings/git-environments/${id}`, payload);
  return response.data;
}

export async function deleteGitEnvironment(id: number) {
  const response = await api.delete<{ message: string }>(`/api/v1/settings/git-environments/${id}`);
  return response.data;
}

/** Formulário do bot: de onde vem o token para esse link. */
export async function checkGitUrl(url: string) {
  const response = await api.post<GitUrlCheck>("/api/v1/settings/git-environments/check-url", { url });
  return response.data;
}
