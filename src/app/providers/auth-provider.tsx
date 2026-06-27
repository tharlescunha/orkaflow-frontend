import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { meRequest, refreshRequest } from "@/services/api/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, refreshToken, setAuth, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        if (!accessToken && refreshToken) {
          const tokens = await refreshRequest(refreshToken);

          setAuth({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            user: null as any,
          });
        }

        if (accessToken) {
          const user = await meRequest();

          setAuth({
            accessToken,
            refreshToken: refreshToken!,
            user,
          });
        }
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) return null;

  return <>{children}</>;
}
