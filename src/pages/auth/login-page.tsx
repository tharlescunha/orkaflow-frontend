import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarClock, Eye, EyeOff, Loader2, Server } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { ENVIRONMENT_LABEL } from "@/lib/navigation";
import { btn, input, label } from "@/lib/ui";
import { loginRequest, meRequest } from "@/services/api/auth";
import { useAuthStore } from "../../store/auth-store";

const HIGHLIGHTS = [
  { icon: Activity, text: "Saúde de cada automação e o erro de cada execução num lugar só." },
  { icon: Server, text: "Máquinas, filas e logs ao vivo, sem precisar abrir o servidor." },
  { icon: CalendarClock, text: "Agendamentos, versões dos robôs e execução manual com um clique." },
];

// Tela de login na marca Regente: painel azul com o logo na versão escura, cartão branco com o formulário.
// O formulário e o fluxo de autenticação não mudam.
export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const login = String(formData.get("login") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const tokens = await loginRequest(login, password);
      setTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
      const user = await meRequest();
      setAuth({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user });
      navigate("/");
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível entrar. Confira o login e a senha."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-regente-bg bg-[radial-gradient(ellipse_at_top,rgba(29,78,216,0.12),transparent_55%)] px-4 py-10 text-slate-800">
      <div className="w-full max-w-[960px]">
        <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_30px_70px_-30px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_1fr]">
          {/* Lado esquerdo: painel azul do guia, logo na versão escura e a frase de assinatura. */}
          <section className="hidden flex-col justify-between bg-regente-gradient p-10 text-white lg:flex">
            <div className="flex items-center gap-3">
              <img src="/brand/regente-icone-sobre-escuro.svg" alt="Regente" className="h-12 w-12 shrink-0" />
              <span>
                <span className="block text-[26px] font-bold leading-tight tracking-[-0.035em] text-white">Regente</span>
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-regente-200">{ENVIRONMENT_LABEL}</span>
              </span>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white">Cada automação no seu compasso.</h2>
                <p className="text-[15px] leading-6 text-regente-200">Agende, dispare e acompanhe bots, APIs e robôs em um só painel.</p>
              </div>
              <ul className="space-y-3">
                {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-regente-200">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[14px] leading-6">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-regente-200/80">Orquestrador de automações da ALZ Grãos · © 2026</p>
          </section>

          {/* Lado direito: o formulário. */}
          <section className="flex items-center justify-center p-8 sm:p-10">
            <div className="w-full max-w-[380px]">
              <div className="mb-6 flex items-center gap-3 lg:hidden">
                <img src="/brand/regente-icone.svg" alt="Regente" className="h-10 w-10 shrink-0" />
                <span>
                  <span className="block text-xl font-bold leading-tight tracking-[-0.035em] text-regente-ink">Regente</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-regente-muted">{ENVIRONMENT_LABEL}</span>
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-regente-ink">Entrar</h1>
              <p className="mt-1 text-sm text-regente-muted">Use o seu login do painel.</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                <div>
                  <label htmlFor="login" className={label}>
                    Login
                  </label>
                  <input id="login" name="login" type="text" autoComplete="username" autoFocus required className={input} placeholder="seu.login" />
                </div>

                <div>
                  <label htmlFor="password" className={label}>
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className={`${input} pr-11`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                      aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className={`${btn.primary} w-full`}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-500">
                Esqueceu a senha? Peça a um administrador do painel para redefinir.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
