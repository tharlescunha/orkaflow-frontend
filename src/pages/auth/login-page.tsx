import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, Mail, Orbit } from "lucide-react";
import { useAuthStore } from "../../store/auth-store";
import { loginRequest, meRequest } from "@/services/api/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const login = formData.get("login") as string;
    const password = formData.get("password") as string;

    try {
      const tokens = await loginRequest(login, password);

      setAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user: null as any,
      });

      const user = await meRequest();

      setAuth({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        user,
      });

      navigate("/dashboard");
      } catch (err: any) {
        console.error("Erro no login:", err);
        console.error("Resposta da API:", err?.response?.data);

        const message =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          "Erro ao realizar login";

        setError(Array.isArray(message) ? "Dados inválidos" : message);
      } finally {
        setLoading(false);
      }
  }

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#040b22]">
      <div className="grid min-h-screen w-full lg:grid-cols-[1.15fr_0.85fr]">
        <section className="relative hidden min-h-screen overflow-hidden lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_25%),radial-gradient(circle_at_center,rgba(29,78,216,0.10),transparent_35%),linear-gradient(180deg,#050b1f_0%,#071436_100%)]" />
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(59,130,246,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.06)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10 flex w-full flex-col justify-between px-14 py-12 xl:px-20 xl:py-14">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-cyan-400/20 bg-white/5 px-5 py-3 backdrop-blur-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-400/10 ring-1 ring-cyan-300/30">
                <Orbit className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <p className="text-lg font-semibold text-white">OrkaFlow</p>
                <p className="text-xs text-slate-300">
                  Automation Orchestration Platform
                </p>
              </div>
            </div>

            <div className="relative mx-auto flex h-[420px] w-full max-w-[760px] items-center justify-center">
              <div className="absolute h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="absolute h-[360px] w-[360px] rounded-full border border-cyan-400/10" />
              <div className="absolute h-[260px] w-[260px] rounded-full border border-cyan-300/10" />

              <div className="relative h-40 w-40 rounded-full bg-gradient-to-br from-[#2563eb] via-[#3b82f6] to-[#7c3aed] p-[9px] shadow-[0_0_80px_rgba(59,130,246,0.35)]">
                <div className="flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-[#0b1739] shadow-2xl shadow-blue-950/50">
                  <div className="absolute inset-4 rounded-full border border-cyan-300/15" />
                  <div className="absolute inset-7 rounded-full border border-dashed border-cyan-300/20 animate-spin [animation-duration:20s]" />
                  <div className="h-11 w-11 rounded-full bg-cyan-300 shadow-[0_0_35px_rgba(103,232,249,0.9)]" />
                </div>
              </div>

              <div className="absolute left-[14%] top-[14%] h-16 w-16 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c173a] to-[#16224d] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                <div className="flex h-full items-center justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.95)]" />
                </div>
              </div>

              <div className="absolute right-[14%] top-[14%] h-16 w-16 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c173a] to-[#16224d] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                <div className="flex h-full items-center justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.95)]" />
                </div>
              </div>

              <div className="absolute bottom-[14%] left-[18%] h-16 w-16 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c173a] to-[#16224d] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                <div className="flex h-full items-center justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.95)]" />
                </div>
              </div>

              <div className="absolute bottom-[12%] right-[18%] h-16 w-16 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0c173a] to-[#16224d] shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                <div className="flex h-full items-center justify-center">
                  <div className="h-3.5 w-3.5 rounded-full bg-blue-300 shadow-[0_0_18px_rgba(147,197,253,0.95)]" />
                </div>
              </div>

              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 760 420"
                fill="none"
              >
                <path
                  d="M380 210 L160 92"
                  stroke="rgba(56,189,248,0.35)"
                  strokeWidth="2"
                />
                <path
                  d="M380 210 L600 92"
                  stroke="rgba(96,165,250,0.35)"
                  strokeWidth="2"
                />
                <path
                  d="M380 210 L190 330"
                  stroke="rgba(168,85,247,0.35)"
                  strokeWidth="2"
                />
                <path
                  d="M380 210 L570 322"
                  stroke="rgba(59,130,246,0.35)"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <div className="max-w-[560px] space-y-5">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
                Controle centralizado
              </p>

              <h3 className="text-5xl font-semibold leading-[1.05] tracking-tight text-white xl:text-4xl">
                Orquestre, distribua e monitore automações em um só lugar.
              </h3>

              <p className="text-xl leading-8 text-slate-300/85">
                Um painel pensado para operação real: controle de tarefas,
                runners, bots, logs, versões e execução com estabilidade.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#0c1537_0%,#111d4a_100%)] px-6 py-10 sm:px-10 lg:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_35%)]" />


          <div className="relative z-10 w-full max-w-[520px] rounded-[34px] bg-[#f7f7fb] p-8 text-slate-900 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:p-10">
            <div className="mb-8">
              <h2 className="text-5xl font-semibold tracking-tight text-slate-950">
                Entrar
              </h2>

              <p className="mt-4 max-w-[700px] text-[14px] leading-8 text-slate-600">
                Acesse o painel para controlar tarefas, runners e automações.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Login
                </label>

                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm transition focus-within:border-slate-300">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input
                    name="login"
                    autoComplete="username"
                    className="h-full w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                    type="text"
                    placeholder="seu.login"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">
                  Senha
                </label>

                <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-slate-900 shadow-sm transition focus-within:border-slate-300">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  <input
                    name="password"
                    autoComplete="current-password"
                    className="h-full w-full bg-transparent text-base outline-none placeholder:text-slate-400"
                    type="password"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-1 text-sm">
                <label className="flex items-center gap-3 text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Lembrar acesso
                </label>

                <button
                  type="button"
                  className="font-medium text-[#314e86] transition hover:text-[#1f3c74]"
                >
                  Esqueci minha senha
                </button>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
            </form>

            <div className="mt-8 rounded-[24px] border border-slate-200 bg-[#fdfdff] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Plataforma
              </p>
              <p className="mt-3 text-[14px] leading-8 text-slate-600">
                Controle, execute e acompanhe automações com visão centralizada e
                operação estável.
              </p>
            </div>

            <p className="mt-8 text-center text-sm text-slate-500">
              © 2026 OrkaFlow. Todos os direitos reservados.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
