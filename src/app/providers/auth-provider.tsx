import { useEffect, useState } from "react";
import axios from "axios";
import { useAuthStore } from "@/store/auth-store";
import { meRequest, refreshRequest } from "@/services/api/auth";

function isAuthRejection(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const { logout, setTokens, setUser } = useAuthStore.getState();

      try {
        let { accessToken } = useAuthStore.getState();
        const { refreshToken } = useAuthStore.getState();

        if (!accessToken && refreshToken) {
          const tokens = await refreshRequest(refreshToken);
          setTokens({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          });
          accessToken = tokens.access_token;
        }

        if (accessToken) {
          const user = await meRequest();
          setUser(user);
        }
      } catch (error) {
        // so 401/403 derruba a sessao; falha de rede/timeout/5xx mantem
        // os tokens salvos (a API pode estar apenas fora do ar).
        if (isAuthRejection(error)) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) return null;

  return <>{children}</>;
}
