import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { finishMicrosoftLogin, SsoError } from "@/lib/microsoft-sso";
import { btn } from "@/lib/ui";
import { meRequest, microsoftLoginRequest } from "@/services/api/auth";
import { useAuthStore } from "../../store/auth-store";

type Failure = { message: string; detail?: string };

// Página de retorno da Microsoft (/auth/callback): troca o código pelo id_token, entrega ao backend e entra no painel.
export function MicrosoftCallbackPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTokens = useAuthStore((state) => state.setTokens);
  const [failure, setFailure] = useState<Failure | null>(null);
  // O código da Microsoft vale uma vez: no desenvolvimento o React roda o efeito duas vezes, então só a primeira conta.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const search = new URLSearchParams(window.location.search);
    // Tira o código do endereço (e do histórico do navegador) antes de qualquer outra coisa.
    window.history.replaceState({}, "", "/auth/callback");

    (async () => {
      try {
        const { idToken, nonce } = await finishMicrosoftLogin(search);
        const tokens = await microsoftLoginRequest(idToken, nonce);
        setTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
        const user = await meRequest();
        setAuth({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user });
        navigate("/", { replace: true });
      } catch (err) {
        if (err instanceof SsoError) {
          setFailure({ message: err.message, detail: err.detail });
        } else {
          setFailure({ message: getApiErrorMessage(err, "Não foi possível entrar com a conta Microsoft.") });
        }
      }
    })();
  }, [navigate, setAuth, setTokens]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-regente-bg px-4 py-10 text-slate-800">
      <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.06),0_30px_70px_-30px_rgba(15,23,42,0.45)]">
        {failure ? (
          <>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-lg font-bold tracking-tight text-regente-ink">Não foi possível entrar com a Microsoft</h1>
            <p role="alert" className="mt-2 text-sm leading-6 text-slate-600">
              {failure.message}
            </p>
            {failure.detail && <p className="mt-3 break-words rounded-lg bg-slate-50 px-3 py-2 text-left font-mono text-[11px] text-slate-500">{failure.detail}</p>}
            <button type="button" onClick={() => navigate("/login", { replace: true })} className={`${btn.primary} mt-6 w-full`}>
              Voltar para o login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
            <h1 className="mt-4 text-lg font-bold tracking-tight text-regente-ink">Entrando com a conta Microsoft...</h1>
            <p className="mt-2 text-sm text-slate-500">Só um instante.</p>
          </>
        )}
      </div>
    </div>
  );
}
