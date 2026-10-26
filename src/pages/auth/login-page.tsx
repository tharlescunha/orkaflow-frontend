import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, CalendarClock, Eye, EyeOff, Loader2, Server } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { btn, input, label } from "@/lib/ui";
import { loginRequest, meRequest } from "@/services/api/auth";
import { useAuthStore } from "../../store/auth-store";

const HIGHLIGHTS = [
  { icon: Activity, text: "Saúde de cada automação e o erro de cada execução num lugar só." },
  { icon: Server, text: "Máquinas, filas e logs ao vivo, sem precisar abrir o servidor." },
  { icon: CalendarClock, text: "Agendamentos, versões dos robôs e execução manual com um clique." },
];

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
    <div className="min-h-screen w-full bg-[#040b22]">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_0.95fr]">
        {/* Lado esquerdo: só o essencial sobre o sistema. */}
        <section className="relative hidden overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_30%),linear-gradient(180deg,#050b1f_0%,#071436_100%)]" />
          <div className="relative z-10 flex w-full flex-col justify-between px-14 py-12 xl:px-20">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                <img src="/favicon.svg" alt="" className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">OrkaFlow</p>
                <p className="text-xs text-slate-400">Orquestrador de robôs da ALZ Grãos</p>
              </div>
            </div>

            <div className="max-w-[520px] space-y-8">
              <h2 className="text-4xl font-semibold leading-tight tracking-tight text-white">
                Tudo que roda, onde roda e o que deu errado. Em uma tela.
              </h2>
              <ul className="space-y-4">
                {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-slate-300">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[15px] leading-7">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-slate-500">© 2026 OrkaFlow</p>
          </div>
        </section>

        {/* Lado direito: o formulário. */}
        <section className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px] rounded-2xl border border-white/10 bg-white p-8 text-slate-900 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img src="/favicon.svg" alt="" className="h-8 w-8" />
              <span className="text-lg font-semibold">OrkaFlow</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Entrar</h1>
            <p className="mt-1 text-sm text-slate-500">Use o seu login do painel.</p>

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
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700"
                    aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
  );
}
