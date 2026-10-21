import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../../store/auth-store";

export const API_TIMEOUT_MS = 20_000;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

type TokenPair = { access_token: string; refresh_token: string };

// Fila unica de refresh: varias 401 simultaneas compartilham a mesma promise.
let refreshPromise: Promise<string> | null = null;

function forceLogout() {
  // PrivateRoute assina o store: ao limpar a sessao ele navega para /login.
  useAuthStore.getState().logout();
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  // usa axios "cru" para nao passar pelos interceptors (evita loop de 401)
  const response = await axios.post<TokenPair>(
    `${import.meta.env.VITE_API_URL ?? ""}/api/v1/auth/refresh`,
    { refresh_token: refreshToken },
    { timeout: API_TIMEOUT_MS }
  );

  useAuthStore.getState().setTokens({
    accessToken: response.data.access_token,
    refreshToken: response.data.refresh_token,
  });

  return response.data.access_token;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error?.config as RetriableConfig | undefined;
    const refreshToken = useAuthStore.getState().refreshToken;
    const requestUrl = String(originalRequest?.url ?? "");
    const isAuthRoute = requestUrl.includes("/auth/refresh") || requestUrl.includes("/auth/login");

    // 401 que não tem como ser recuperado (sem refresh token, ou já tentou renovar e
    // continuou 401): a sessão salva está vencida. Desloga em vez de ficar com a tela
    // "logada" e todas as chamadas falhando.
    if (
      error.response?.status === 401 &&
      !requestUrl.includes("/auth/login") &&
      (!refreshToken || originalRequest?._retry || requestUrl.includes("/auth/refresh"))
    ) {
      forceLogout();
      return Promise.reject(error);
    }

    if (
      originalRequest &&
      error.response?.status === 401 &&
      refreshToken &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken(refreshToken).finally(() => {
            refreshPromise = null;
          });
        }

        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // so desloga se o servidor recusou o refresh; falha de rede mantem a sessao
        if (axios.isAxiosError(refreshError) && !refreshError.response) {
          return Promise.reject(refreshError);
        }
        forceLogout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
