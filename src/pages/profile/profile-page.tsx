import { useState, type FormEvent } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Shield } from "lucide-react";

import { ApiTokensCard } from "@/components/common/api-tokens-card";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { badge, btn, card, cardBody, cardHeader, cardTitle, chip, fieldError, hint, input, label, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { setSyncPreference } from "@/services/api/sync";
import { getUserById, updateUser, type UpdateUserPayload, type UserRead } from "@/services/api/users";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/toast-store";

export function ProfilePage() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const userId = authUser?.id;

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const user = await getUserById(userId as number);
      // Mantém o usuário da sessão em dia com o que a API devolveu.
      setUser(user);
      return user;
    },
    enabled: Boolean(userId),
  });

  if (!userId) {
    return (
      <section className={card}>
        <PageHeader title="Meu perfil" />
        <div className="p-5">
          <QueryError error={new Error("Sessão sem usuário. Saia e entre de novo.")} what="o seu perfil" />
        </div>
      </section>
    );
  }

  if (userQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Meu perfil" description="Seus dados de acesso e tokens de integração." />
        <div className="p-5">
          <DetailSkeleton fields={4} />
        </div>
      </section>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Meu perfil" description="Seus dados de acesso e tokens de integração." />
        <div className="p-5">
          <QueryError error={userQuery.error} what="o seu perfil" onRetry={() => userQuery.refetch()} retrying={userQuery.isFetching} />
        </div>
      </section>
    );
  }

  // O formulário só é montado quando os dados chegam; nada de efeito re-hidratando depois.
  return <ProfileForm key={userQuery.data.id} initial={userQuery.data} />;
}

type FormState = {
  name: string;
  login: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormState, string>> & {
  submit?: string;
  forbidden?: boolean;
};

function ProfileForm({ initial }: { initial: UserRead }) {
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>({
    name: initial.name ?? "",
    login: initial.login ?? "",
    email: initial.email ?? "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) => updateUser(initial.id, payload),
    onSuccess: async (updatedUser) => {
      setUser(updatedUser);
      setForm({
        name: updatedUser.name ?? "",
        login: updatedUser.login ?? "",
        email: updatedUser.email ?? "",
        password: "",
        confirmPassword: "",
      });
      setErrors({});
      toast.success("Seus dados foram atualizados.");
      await queryClient.invalidateQueries({ queryKey: ["user", initial.id] });
    },
    onError: (error) => {
      const forbidden = axios.isAxiosError(error) && error.response?.status === 403;
      setErrors((prev) => ({
        ...prev,
        submit: getApiErrorMessage(error, "Não foi possível atualizar seus dados."),
        forbidden,
      }));
    },
  });

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, submit: undefined, forbidden: undefined }));
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) nextErrors.name = "Informe o nome.";
    if (!form.email.trim()) nextErrors.email = "Informe o e-mail.";

    if (form.password) {
      if (form.password.length < 6) nextErrors.password = "A senha deve ter pelo menos 6 caracteres.";
      if (!form.confirmPassword) nextErrors.confirmPassword = "Confirme a nova senha.";
      else if (form.password !== form.confirmPassword) nextErrors.confirmPassword = "As senhas não conferem.";
    } else if (form.confirmPassword) {
      nextErrors.password = "Informe a nova senha.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateForm()) return;

    // Só o que a pessoa pode mudar nela mesma: nada de role/active no payload.
    const payload: UpdateUserPayload = {
      name: form.name.trim(),
      login: form.login.trim(),
      email: form.email.trim(),
      ...(form.password ? { password: form.password } : {}),
    };

    updateMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Meu perfil"
          description="Seus dados de acesso e tokens de integração."
          meta={
            <>
              <span className={cn(badge, initial.active ? tone.success : tone.danger)}>{initial.active ? "Ativo" : "Bloqueado"}</span>
              {initial.profile?.name && (
                <span className={chip}>
                  <Shield className="h-3 w-3" />
                  {initial.profile.name}
                </span>
              )}
            </>
          }
        />

        <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5">
          <div className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Dados do usuário</h2>
            </div>
            <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
              <label className="block">
                <span className={label}>Nome</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={input}
                  placeholder="Seu nome"
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <p className={fieldError}>{errors.name}</p>}
              </label>

              <label className="block">
                <span className={label}>Login</span>
                <input type="text" value={form.login} readOnly className={input} />
                <p className={hint}>O login é definido pelo administrador.</p>
              </label>

              <label className="block">
                <span className={label}>E-mail</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={input}
                  placeholder="seu@email.com"
                  aria-invalid={Boolean(errors.email)}
                />
                {errors.email && <p className={fieldError}>{errors.email}</p>}
              </label>

              <label className="block">
                <span className={label}>Perfil de acesso</span>
                <input type="text" value={initial.profile?.name ?? initial.role ?? ""} readOnly className={input} />
                <p className={hint}>Define o que você pode fazer no painel. Só um administrador altera.</p>
              </label>
            </div>
          </div>

          <div className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Alterar senha</h2>
              <span className="text-xs text-slate-500">Deixe em branco para manter a senha atual</span>
            </div>
            <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
              <label className="block">
                <span className={label}>Nova senha</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  className={input}
                  placeholder="Mínimo de 6 caracteres"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                />
                {errors.password && <p className={fieldError}>{errors.password}</p>}
              </label>

              <label className="block">
                <span className={label}>Confirmar nova senha</span>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setField("confirmPassword", e.target.value)}
                  className={input}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
                {errors.confirmPassword && <p className={fieldError}>{errors.confirmPassword}</p>}
              </label>
            </div>
          </div>

          {errors.submit && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p>{errors.submit}</p>
              {errors.forbidden && (
                <p className="mt-1 text-red-700/80">
                  Peça a um administrador para alterar seus dados: só quem é administrador consegue editar usuários.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={updateMutation.isPending} className={btn.primary}>
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>

        <div className="space-y-5 px-5 pb-5">
          <SyncPreferenceCard initial={Boolean(initial.sync_enabled)} userId={initial.id} />
          <ApiTokensCard />
        </div>
      </section>
    </div>
  );
}

/** Cada pessoa liga o Sync no próprio perfil; para quem não ligou, o menu nem aparece. */
function SyncPreferenceCard({ initial, userId }: { initial: boolean; userId: number }) {
  const setUser = useAuthStore((state) => state.setUser);
  const authUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => setSyncPreference(enabled),
    onSuccess: async (result) => {
      if (authUser) setUser({ ...authUser, sync_enabled: result.sync_enabled });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      toast.success(result.sync_enabled ? "Sync ligado. O item apareceu em Operação." : "Sync desligado.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível mudar o Sync.")),
  });

  const enabled = mutation.data?.sync_enabled ?? initial;

  return (
    <div className={card}>
      <div className={cardHeader}>
        <h2 className={cardTitle}>Sync</h2>
      </div>
      <div className={cn(cardBody, "flex flex-wrap items-center justify-between gap-4")}>
        <p className="max-w-2xl text-sm text-slate-600">
          Painel pessoal para acompanhar só as automações que você escolher e também sistemas de fora do Regente. Vale só para o seu
          usuário; ligado, aparece no fim de <strong>Operação</strong>.
        </p>
        <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            disabled={mutation.isPending}
            onChange={(e) => mutation.mutate(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          {mutation.isPending ? "Salvando..." : enabled ? "Ligado" : "Desligado"}
        </label>
      </div>
    </div>
  );
}
