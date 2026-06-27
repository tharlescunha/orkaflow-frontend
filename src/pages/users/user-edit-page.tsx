import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Shield, UserCog } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getUserById,
  updateUser,
  type UpdateUserPayload,
} from "@/services/api/users";
import { listProfiles } from "@/services/api/profiles";

type FormState = {
  name: string;
  login: string;
  email: string;
  password: string;
  confirmPassword: string;
  active: boolean;
  role: string;
  profile_id: string;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  submit?: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  login: "",
  email: "",
  password: "",
  confirmPassword: "",
  active: true,
  role: "viewer",
  profile_id: "",
};

export function UserEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ userId: string }>();

  const userId = Number(params.userId);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [initialized, setInitialized] = useState(false);

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUserById(userId),
    enabled: Number.isFinite(userId) && userId > 0,
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles-edit-user"],
    queryFn: () => listProfiles({ limit: 500 }),
  });

  useEffect(() => {
    if (!userQuery.data || initialized) return;

    setForm({
      name: userQuery.data.name ?? "",
      login: userQuery.data.login ?? "",
      email: userQuery.data.email ?? "",
      password: "",
      confirmPassword: "",
      active: !!userQuery.data.active,
      role: userQuery.data.role ?? "viewer",
      profile_id: userQuery.data.profile_id ? String(userQuery.data.profile_id) : "",
    });

    setInitialized(true);
  }, [userQuery.data, initialized]);

  const profiles = profilesQuery.data ?? [];

  const selectedProfile = useMemo(
    () => profiles.find((profile) => String(profile.id) === form.profile_id) ?? null,
    [profiles, form.profile_id]
  );

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateUserPayload) => updateUser(userId, payload),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      navigate(`/users/${user.id}`);
    },
    onError: (error: any) => {
      const detail =
        error?.response?.data?.detail ??
        "Não foi possível atualizar o usuário. Verifique os dados e tente novamente.";

      setErrors((prev) => ({
        ...prev,
        submit: String(detail),
      }));
    },
  });

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined }));
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) nextErrors.name = "Informe o nome.";
    if (!form.login.trim()) nextErrors.login = "Informe o login.";
    if (!form.email.trim()) nextErrors.email = "Informe o e-mail.";

    if (form.password) {
      if (form.password.length < 6) {
        nextErrors.password = "A senha deve ter pelo menos 6 caracteres.";
      }
      if (!form.confirmPassword) {
        nextErrors.confirmPassword = "Confirme a nova senha.";
      }
      if (form.confirmPassword && form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = "As senhas não conferem.";
      }
    }

    if (!form.password && form.confirmPassword) {
      nextErrors.password = "Informe a nova senha.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload(): UpdateUserPayload {
    const payload: UpdateUserPayload = {
      name: form.name.trim(),
      login: form.login.trim(),
      email: form.email.trim(),
      active: form.active,
      role: form.role,
      profile_id: form.profile_id ? Number(form.profile_id) : null,
    };

    if (form.password) {
      payload.password = form.password;
    }

    return payload;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validateForm()) return;

    updateMutation.mutate(buildPayload());
  }

  function goBack() {
    if (userId) {
      navigate(`/users/${userId}`);
      return;
    }
    navigate("/users");
  }

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        ID de usuário inválido.
      </div>
    );
  }

  if (userQuery.isLoading) {
    return (
      <div className="border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
        Carregando usuário...
      </div>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Não foi possível carregar os dados do usuário.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={goBack}
                className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Editar Usuário
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Atualize os dados do usuário e o perfil de acesso.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5">
            <div className="border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Dados do usuário
                </h2>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <Field
                  label="Nome"
                  required
                  error={errors.name}
                  input={
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                      className={inputClassName(errors.name)}
                      placeholder="Nome completo"
                    />
                  }
                />

                <Field
                  label="Login"
                  required
                  error={errors.login}
                  input={
                    <input
                      type="text"
                      value={form.login}
                      onChange={(e) => setField("login", e.target.value)}
                      className={inputClassName(errors.login)}
                      placeholder="Login de acesso"
                    />
                  }
                />

                <Field
                  label="E-mail"
                  required
                  error={errors.email}
                  input={
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setField("email", e.target.value)}
                      className={inputClassName(errors.email)}
                      placeholder="email@empresa.com"
                    />
                  }
                />

                <Field
                  label="Status"
                  input={
                    <select
                      value={form.active ? "true" : "false"}
                      onChange={(e) => setField("active", e.target.value === "true")}
                      className={inputClassName()}
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Bloqueado</option>
                    </select>
                  }
                />
              </div>
            </div>

            <div className="border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Alterar senha
                </h2>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <Field
                  label="Nova senha"
                  error={errors.password}
                  input={
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      className={inputClassName(errors.password)}
                      placeholder="Preencha apenas se quiser alterar"
                    />
                  }
                />

                <Field
                  label="Confirmar nova senha"
                  error={errors.confirmPassword}
                  input={
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => setField("confirmPassword", e.target.value)}
                      className={inputClassName(errors.confirmPassword)}
                      placeholder="Repita a nova senha"
                    />
                  }
                />
              </div>
            </div>

            <div className="border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Perfil e acesso
                </h2>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <Field
                  label="Role legado"
                  input={
                    <select
                      value={form.role}
                      onChange={(e) => setField("role", e.target.value)}
                      className={inputClassName()}
                    >
                      <option value="admin">admin</option>
                      <option value="operator">operator</option>
                      <option value="viewer">viewer</option>
                    </select>
                  }
                />

                <Field
                  label="Perfil"
                  input={
                    <select
                      value={form.profile_id}
                      onChange={(e) => setField("profile_id", e.target.value)}
                      className={inputClassName()}
                      disabled={profilesQuery.isLoading}
                    >
                      <option value="">Sem perfil vinculado</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  }
                />
              </div>

              {profilesQuery.isError ? (
                <div className="px-4 pb-4 text-sm text-red-600">
                  Não foi possível carregar os perfis.
                </div>
              ) : null}
            </div>

            {errors.submit ? (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errors.submit}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Resumo
                </h2>
              </div>

              <div className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 items-center justify-center border border-slate-200 bg-slate-50">
                    <UserCog className="h-4 w-4 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {form.name.trim() || userQuery.data.name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {form.email.trim() || userQuery.data.email}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-sm">
                  <SummaryItem label="Login" value={form.login || "---"} />
                  <SummaryItem
                    label="Status"
                    value={form.active ? "Ativo" : "Bloqueado"}
                  />
                  <SummaryItem label="Role legado" value={form.role} />
                  <SummaryItem
                    label="Perfil"
                    value={selectedProfile?.name || "Sem perfil vinculado"}
                  />
                </div>
              </div>
            </div>

            <div className="border border-amber-200 bg-amber-50">
              <div className="border-b border-amber-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-700" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                    Atenção
                  </h2>
                </div>
              </div>

              <div className="space-y-3 px-4 py-4 text-sm text-amber-900">
                <p>
                  A alteração de <strong>perfil</strong> impacta diretamente as
                  permissões do usuário no sistema.
                </p>
                <p>
                  A <strong>senha</strong> só será alterada se você preencher os
                  campos de nova senha.
                </p>
                <p>
                  Se o usuário for marcado como <strong>bloqueado</strong>, ele
                  perde o acesso imediatamente no backend.
                </p>
              </div>
            </div>
          </aside>
        </form>
      </section>
    </div>
  );
}

function inputClassName(hasError?: string) {
  return [
    "h-10 w-full border bg-white px-3 text-sm text-slate-900 outline-none transition",
    hasError
      ? "border-red-300 focus:border-red-500"
      : "border-slate-300 focus:border-slate-900",
  ].join(" ");
}

function Field({
  label,
  input,
  error,
  required,
}: {
  label: string;
  input: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {input}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
