import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuthStore } from "../../store/auth-store";
import { getUserById, updateUser } from "../../services/api/users";

export function ProfilePage() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      if (!authUser?.id) {
        setLoading(false);
        return;
      }

      try {
        const user = await getUserById(authUser.id);

        setName(user.name || "");
        setLogin(user.login || "");
        setEmail(user.email || "");
        setRole(user.role || "");

        setUser(user);
      } catch (error: any) {
        setErrorMessage(
          error?.response?.data?.detail || "Não foi possível carregar o perfil."
        );
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [authUser?.id, setUser]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setErrorMessage("");

    if (password && password !== confirmPassword) {
      setErrorMessage("A confirmação de senha não confere.");
      setSaving(false);
      return;
    }

    try {
      const payload = {
        name,
        login,
        email,
        active: authUser?.active ?? true,
        role,
        ...(password ? { password } : {}),
      };

      const updatedUser = await updateUser(authUser!.id, payload);

      setUser(updatedUser);
      setName(updatedUser.name || "");
      setLogin(updatedUser.login || "");
      setEmail(updatedUser.email || "");
      setRole(updatedUser.role || "");
      setPassword("");
      setConfirmPassword("");
      setMessage("Perfil atualizado com sucesso.");
    } catch (error: any) {
      setErrorMessage(
        error?.response?.data?.detail || "Não foi possível atualizar o perfil."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm text-slate-500">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-950">Perfil</h1>
          <p className="mt-2 text-sm text-slate-500">
            Visualize seus dados e altere sua senha.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
            <h2 className="mb-6 text-xl font-semibold text-slate-950">
              Dados do usuário
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nome
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  type="text"
                  placeholder="Seu nome"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Login
                </label>
                <input
                  value={login}
                  readOnly
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-600 outline-none"
                  type="text"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  type="email"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Perfil / Role
                </label>
                <input
                  value={role}
                  readOnly
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-600 outline-none"
                  type="text"
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
            <h2 className="mb-6 text-xl font-semibold text-slate-950">
              Atualizar senha
            </h2>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nova senha
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  type="password"
                  placeholder="Digite a nova senha"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Confirmar nova senha
                </label>
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900"
                  type="password"
                  placeholder="Confirme a nova senha"
                />
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Se não quiser alterar a senha, deixe os campos em branco.
            </p>
          </section>

          {message ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
