import { api } from "./client";

export async function loginRequest(login: string, password: string) {
  const response = await api.post("/api/v1/auth/login", {
    login,
    password,
  });

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
