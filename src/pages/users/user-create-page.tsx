import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, select } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listProfiles } from "@/services/api/profiles";
import { createUser, type CreateUserPayload } from "@/services/api/users";
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

export function UserCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const profilesQuery = useQuery({
    queryKey: ["profiles-create-user"],
    queryFn: () => listProfiles({ active: true, limit: 500 }),
  });

  const profiles = profilesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: CreateUserPayload) => createUser(payload),
    onSuccess: (user) => {
      toast.success(`Usuário ${user.name} criado.`);
      navigate(`/users/${user.id}`);
    },
    onError: (error) => {
      setErrors((prev) => ({
        ...prev,
        submit: getApiErrorMessage(error, "Não foi possível criar o usuário. Verifique os dados e tente de novo."),
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
    if (!form.password) nextErrors.password = "Informe a senha.";
    if (form.password && form.password.length < 6) {
      nextErrors.password = "A senha deve ter pelo menos 6 caracteres.";
    }
    if (!form.confirmPassword) {
      nextErrors.confirmPassword = "Confirme a senha.";
    }
    if (form.password && form.confirmPassword && form.password !== form.confirmPassword) {
      nextErrors.confirmPassword = "As senhas não conferem.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function buildPayload(): CreateUserPayload {
    return {
      name: form.name.trim(),
      login: form.login.trim(),
      email: form.email.trim(),
      password: form.password,
      active: form.active,
      role: form.role,
      profile_id: form.profile_id ? Number(form.profile_id) : null,
    };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validateForm()) return;
    createMutation.mutate(buildPayload());
  }

  function goBack() {
    navigate("/users");
  }

  return (
    <section className={card}>
      <PageHeader
        title="Novo usuário"
        description="Cadastre quem vai acessar o painel e vincule o perfil de acesso."
        backTo="/users"
        backLabel="Voltar para usuários"
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
                autoFocus
                aria-invalid={Boolean(errors.name)}
              />
            </Field>

            <Field label="Login" required error={errors.login} hintText="É o que a pessoa digita para entrar.">
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

            <Field label="Status inicial">
              <select
                value={form.active ? "true" : "false"}
                onChange={(e) => setField("active", e.target.value === "true")}
                className={select}
              >
                <option value="true">Ativo</option>
                <option value="false">Bloqueado</option>
              </select>
            </Field>

            <Field label="Senha" required error={errors.password}>
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

            <Field label="Confirmar senha" required error={errors.confirmPassword}>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setField("confirmPassword", e.target.value)}
                className={input}
                placeholder="Repita a senha"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
              />
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
              error={profilesQuery.isError ? getApiErrorMessage(profilesQuery.error, "Não foi possível carregar os perfis.") : undefined}
            >
              <SearchableSelect<number>
                value={form.profile_id ? Number(form.profile_id) : ""}
                onChange={(value) => setField("profile_id", value === "" ? "" : String(value))}
                options={profiles.map((profile) => ({
                  value: profile.id,
                  label: profile.name,
                  description: profile.description ?? null,
                }))}
                emptyLabel="Sem perfil vinculado"
                searchPlaceholder="Buscar perfil..."
                loading={profilesQuery.isLoading}
                disabled={profilesQuery.isLoading}
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

        {errors.submit && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errors.submit}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={goBack} className={btn.secondary} disabled={createMutation.isPending}>
            Cancelar
          </button>
          <button type="submit" disabled={createMutation.isPending} className={btn.primary}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {createMutation.isPending ? "Salvando..." : "Salvar usuário"}
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
