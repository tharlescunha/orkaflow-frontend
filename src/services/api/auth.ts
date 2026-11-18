import { api } from "./client";

export async function loginRequest(login: string, password: string) {
  const response = await api.post("/api/v1/auth/login", {
    login,
    password,
  });

  return response.data;
}

/** Configuração pública da tela de entrada: se o login com a conta Microsoft está ligado e os IDs públicos do aplicativo. */
export type AuthConfig = {
  microsoft: { enabled: boolean; tenant_id: string | null; client_id: string | null };
};

export async function getAuthConfig() {
  const response = await api.get<AuthConfig>("/api/v1/auth/config");
  return response.data;
}

/** Troca o id_token da Microsoft (o backend valida tudo) pelos tokens do Regente. */
export async function microsoftLoginRequest(idToken: string, nonce: string) {
  const response = await api.post("/api/v1/auth/microsoft", { id_token: idToken, nonce });
  return response.data;
}

export async function refreshRequest(refreshToken: string) {
  const response = await api.post("/api/v1/auth/refresh", {
    refresh_token: refreshToken,
  });

  return response.data;
}

export async function meRequest() {
  const response = await api.get("/api/v1/auth/me");
  return response.data;
}

export async function logoutRequest() {
  const response = await api.post("/api/v1/auth/logout");
  return response.data;
}
