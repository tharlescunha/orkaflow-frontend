import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableSelect } from "@/components/common/searchable-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, select } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listProfiles, type ProfileRead } from "@/services/api/profiles";
import { getUserById, updateUser, type UpdateUserPayload, type UserRead } from "@/services/api/users";
import { toast } from "@/store/toast-store";

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

export function UserEditPage() {
  const navigate = useNavigate();
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const validId = Number.isFinite(userId) && userId > 0;

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUserById(userId),
    enabled: validId,
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles-edit-user"],
    queryFn: () => listProfiles({ limit: 500 }),
  });

  const backTo = validId ? `/users/${userId}` : "/users";

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Editar usuário" backTo="/users" backLabel="Voltar para usuários" />
        <div className="p-5">
          <QueryError error={new Error("ID de usuário inválido.")} what="o usuário" />
        </div>
      </section>
    );
  }

  if (userQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Editar usuário" backTo={backTo} />
        <div className="p-5">
          <DetailSkeleton fields={6} />
        </div>
      </section>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Editar usuário" backTo={backTo} />
        <div className="p-5">
          <QueryError error={userQuery.error} what="o usuário" onRetry={() => userQuery.refetch()} retrying={userQuery.isFetching} />
        </div>
      </section>
    );
  }

  // O formulário só é montado quando o usuário chegou: o estado inicial vem direto dos dados,
  // sem efeito re-hidratando (que sobrescrevia o que a pessoa já tinha digitado).
  return (
    <UserEditForm
      key={userQuery.data.id}
      initial={userQuery.data}
      profiles={profilesQuery.data ?? []}
      profilesLoading={profilesQuery.isLoading}
      profilesError={profilesQuery.isError ? profilesQuery.error : null}
      onCancel={() => navigate(backTo)}
    />
  );
}

function UserEditForm({
  initial,
  profiles,
  profilesLoading,
  profilesError,
  onCancel,
}: {
  initial: UserRead;
  profiles: ProfileRead[];
  profilesLoading: boolean;
  profilesError: unknown;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = initial.id;

  const [form, setForm] = useState<FormState>({
    name: initial.name ?? "",
    login: initial.login ?? "",
    email: initial.email ?? "",
    password: "",
    confirmPassword: "",
    active: Boolean(initial.active),
    role: initial.role ?? "viewer",
    profile_id: initial.profile_id ? String(initial.profile_id) : "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateUserPayload) => updateUser(userId, payload),
    onSuccess: async (user) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      toast.success("Usuário atualizado.");
      navigate(`/users/${user.id}`);
    },
    onError: (error) => {
      setErrors((prev) => ({
        ...prev,
        submit: getApiErrorMessage(error, "Não foi possível atualizar o usuário. Verifique os dados e tente de novo."),
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

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateForm()) return;
    updateMutation.mutate(buildPayload());
  }

  return (
    <section className={card}>
      <PageHeader
        title={`Editar ${initial.name}`}
        description="Atualize os dados, o perfil de acesso ou a senha."
        backTo={`/users/${userId}`}
        backLabel="Voltar para o usuário"
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5">
        <div className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Dados do usuário</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
            <Field label="Nome" required error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className={input}
                placeholder="Nome completo"
                aria-invalid={Boolean(errors.name)}
              />
            </Field>

            <Field label="Login" required error={errors.login}>
              <input
                type="text"
                value={form.login}
                onChange={(e) => setField("login", e.target.value)}
                className={input}
                placeholder="Login de acesso"
                autoComplete="off"
                aria-invalid={Boolean(errors.login)}
              />
            </Field>

            <Field label="E-mail" required error={errors.email}>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className={input}
                placeholder="email@empresa.com"
                aria-invalid={Boolean(errors.email)}
              />
            </Field>

            <Field label="Status" hintText="Bloqueado perde o acesso ao painel na hora.">
              <select
                value={form.active ? "true" : "false"}
                onChange={(e) => setField("active", e.target.value === "true")}
                className={select}
              >
                <option value="true">Ativo</option>
                <option value="false">Bloqueado</option>
              </select>
            </Field>
          </div>
        </div>

        <div className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Perfil e acesso</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
            <Field
              label="Perfil"
              hintText="O perfil define o que o usuário pode fazer no painel."
              error={profilesError ? getApiErrorMessage(profilesError, "Não foi possível carregar os perfis.") : undefined}
            >
              <SearchableSelect<number>
                value={form.profile_id ? Number(form.profile_id) : ""}
                onChange={(value) => setField("profile_id", value === "" ? "" : String(value))}
                options={profiles.map((profile) => ({
                  value: profile.id,
                  label: profile.active ? profile.name : `${profile.name} (inativo)`,
                  description: profile.description ?? null,
                }))}
                emptyLabel="Sem perfil vinculado"
                searchPlaceholder="Buscar perfil..."
                loading={profilesLoading}
                disabled={profilesLoading}
              />
            </Field>

            <Field label="Role legado" hintText="Mantido só por compatibilidade com partes antigas do sistema.">
              <select value={form.role} onChange={(e) => setField("role", e.target.value)} className={select}>
                <option value="admin">admin</option>
                <option value="operator">operator</option>
                <option value="viewer">viewer</option>
              </select>
            </Field>
          </div>
        </div>

        <div className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Alterar senha</h2>
            <span className="text-xs text-slate-500">Deixe em branco para manter a senha atual</span>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
            <Field label="Nova senha" error={errors.password}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                className={input}
                placeholder="Mínimo de 6 caracteres"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
              />
            </Field>

            <Field label="Confirmar nova senha" error={errors.confirmPassword}>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                className={input}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
              />
            </Field>
          </div>
        </div>

        {errors.submit && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errors.submit}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onCancel} className={btn.secondary} disabled={updateMutation.isPending}>
            Cancelar
          </button>
          <button type="submit" disabled={updateMutation.isPending} className={btn.primary}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  children,
  error,
  hintText,
  required,
}: {
  label: string;
  children: ReactNode;
  error?: string;
  hintText?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      {children}
      {error ? <p className={fieldError}>{error}</p> : hintText ? <p className={hint}>{hintText}</p> : null}
    </label>
  );
}
