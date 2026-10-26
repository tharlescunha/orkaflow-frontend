import { useEffect, useState } from "react";
import axios from "axios";
import { useAuthStore } from "@/store/auth-store";
import { meRequest, refreshRequest } from "@/services/api/auth";

function isAuthRejection(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
}

const SLOW_AFTER_MS = 4000;

// Tela de boot enquanto a sessão é validada (antes era fundo vazio por até 20 s com a API lenta).
function BootSplash() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#040b22] px-6 text-slate-100">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
        </div>
        <div>
          <p className="text-lg font-semibold">OrkaFlow</p>
          <p className="mt-1 text-sm text-slate-400">Conectando ao servidor...</p>
        </div>
        {slow && (
          <div className="max-w-sm border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            O servidor está demorando para responder. Se não abrir em instantes, confira a rede ou se a API está no ar.
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 block font-medium text-amber-200 underline underline-offset-2"
            >
              Tentar de novo
            </button>
          </div>
        )}
      </div>
    </div>
  );
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

  if (loading) return <BootSplash />;

  return <>{children}</>;
}
