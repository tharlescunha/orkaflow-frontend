import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableSelect } from "@/components/common/searchable-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  createCredentialItem,
  deleteCredentialItem,
  getCredential,
  revealCredentialItemSecret,
  updateCredential,
  updateCredentialItem,
} from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";
import type { CredentialWithItemsRead, RepositoryOption } from "@/types/credential";

type SecretFormItem = {
  // id presente = segredo já gravado; ausente = novo.
  id?: number;
  tempId: string;
  key: string;
  originalKey: string;
  // Para itens gravados, "" significa "manter o valor atual".
  value: string;
  // Valor que veio do reveal (só depois de a pessoa clicar no olho).
  revealedValue: string | null;
  revealing: boolean;
  showValue: boolean;
  markedForDelete: boolean;
};

type EditFormState = {
  label: string;
  repository_id: string;
  active: boolean;
  secrets: SecretFormItem[];
};

const KEEP_PLACEHOLDER = "mantido (clique no olho para ver)";

function newSecret(): SecretFormItem {
  return {
    tempId: crypto.randomUUID(),
    key: "",
    originalKey: "",
    value: "",
    revealedValue: null,
    revealing: false,
    showValue: false,
    markedForDelete: false,
  };
}

// Só as chaves vêm do GET; nenhum valor é buscado até a pessoa pedir.
function buildInitialState(credential: CredentialWithItemsRead): EditFormState {
  return {
    label: credential.label ?? "",
    repository_id: String(credential.repository_id ?? ""),
    active: Boolean(credential.active),
    secrets: (credential.items ?? []).map((item) => ({
      id: item.id,
      tempId: crypto.randomUUID(),
      key: item.key ?? "",
      originalKey: item.key ?? "",
      value: "",
      revealedValue: null,
      revealing: false,
      showValue: false,
      markedForDelete: false,
    })),
  };
}

export function CredentialEditPage() {
  const navigate = useNavigate();
  const params = useParams();
  const credentialId = Number(params.credentialId);
  const validId = Number.isFinite(credentialId) && credentialId > 0;
  const backTo = validId ? `/credentials/${credentialId}` : "/credentials";

  const credentialQuery = useQuery({
    queryKey: ["credential-edit", credentialId],
    queryFn: () => getCredential(credentialId),
    enabled: validId,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo={backTo}
          title={credentialQuery.data ? `Editar ${credentialQuery.data.label}` : "Editar credencial"}
          description="Altere o cadastro e os segredos. Os valores atuais só são mostrados quando você clica no olho."
        />

        {!validId ? (
          <EmptyState
            title="ID de credencial inválido"
            description="O endereço não aponta para uma credencial existente."
            action={
              <button type="button" onClick={() => navigate("/credentials")} className={btn.secondary}>
                Ver credenciais
              </button>
            }
          />
        ) : credentialQuery.isLoading ? (
          <div className={cardBody}>
            <DetailSkeleton fields={6} />
          </div>
        ) : credentialQuery.isError ? (
          <div className={cardBody}>
            <QueryError
              error={credentialQuery.error}
              what="a credencial"
              onRetry={() => credentialQuery.refetch()}
              retrying={credentialQuery.isFetching}
            />
          </div>
        ) : credentialQuery.data ? (
          // Montado só com os dados em mãos: nada de re-hidratar por efeito depois.
          <CredentialEditForm
            key={credentialQuery.data.id}
            credentialId={credentialId}
            credential={credentialQuery.data}
            repositories={repositoriesQuery.data ?? []}
            repositoriesLoading={repositoriesQuery.isLoading}
            backTo={backTo}
          />
        ) : null}
      </section>
    </div>
  );
}

function CredentialEditForm({
  credentialId,
  credential,
  repositories,
  repositoriesLoading,
  backTo,
}: {
  credentialId: number;
  credential: CredentialWithItemsRead;
  repositories: RepositoryOption[];
  repositoriesLoading: boolean;
  backTo: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<EditFormState>(() => buildInitialState(credential));
  const [submitted, setSubmitted] = useState(false);

  const visibleSecrets = useMemo(() => form.secrets.filter((item) => !item.markedForDelete), [form.secrets]);

  const errors = useMemo(() => {
    const halfFilled = visibleSecrets.some((item) => {
      const hasKey = item.key.trim() !== "";
      if (item.id) return !hasKey;
      // Novo: ou está em branco (ignorado) ou precisa de chave e valor.
      return (hasKey && !item.value) || (!hasKey && item.value !== "");
    });
    const complete = visibleSecrets.filter((item) => item.key.trim() && (item.id || item.value));
    return {
      label: form.label.trim() ? null : "Informe o label.",
      repository: form.repository_id ? null : "Selecione o repositório.",
      secrets: halfFilled
        ? "Todo segredo precisa de chave e valor."
        : complete.length === 0
          ? "Mantenha pelo menos um segredo."
          : null,
    };
  }, [form.label, form.repository_id, visibleSecrets]);

  const formIsValid = !errors.label && !errors.repository && !errors.secrets;

  const updateMutation = useMutation({
    mutationFn: async () => {
      await updateCredential(credentialId, {
        label: form.label.trim(),
        repository_id: Number(form.repository_id),
        active: form.active,
      });

      for (const secret of form.secrets) {
        if (secret.id && secret.markedForDelete) {
          await deleteCredentialItem(credentialId, secret.id);
          continue;
        }
        if (secret.markedForDelete) continue;

        const key = secret.key.trim();

        if (!secret.id) {
          if (!key || !secret.value) continue;
          await createCredentialItem(credentialId, {
            key,
            value: secret.value,
            value_type: "secret",
            notes: null,
            active: true,
          });
          continue;
        }

        // Só o que mudou de fato: chave renomeada e/ou valor digitado. Vazio = manter.
        const keyChanged = key !== secret.originalKey;
        const valueChanged = secret.value !== "" && secret.value !== secret.revealedValue;
        if (!keyChanged && !valueChanged) continue;

        await updateCredentialItem(credentialId, secret.id, {
          ...(keyChanged ? { key } : {}),
          ...(valueChanged ? { value: secret.value, value_type: "secret" } : {}),
        });
      }
    },
    onSuccess: async () => {
      toast.success("Credencial atualizada.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["credentials"] }),
        queryClient.invalidateQueries({ queryKey: ["credential-edit", credentialId] }),
        queryClient.invalidateQueries({ queryKey: ["credential-detail", credentialId] }),
      ]);
      navigate(`/credentials/${credentialId}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar a credencial.", error));
    },
  });

  function handleChange<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateSecret(tempId: string, updater: (current: SecretFormItem) => SecretFormItem) {
    setForm((prev) => ({
      ...prev,
      secrets: prev.secrets.map((item) => (item.tempId === tempId ? updater(item) : item)),
    }));
  }

  function addSecret() {
    setForm((prev) => ({ ...prev, secrets: [...prev.secrets, newSecret()] }));
  }

  function removeSecret(tempId: string) {
    setForm((prev) => ({
      ...prev,
      secrets: prev.secrets.flatMap((item) => {
        if (item.tempId !== tempId) return [item];
        return item.id ? [{ ...item, markedForDelete: true }] : [];
      }),
    }));
  }

  // O olho de um item gravado busca o segredo daquele item, uma vez, só quando pedido.
  async function toggleReveal(secret: SecretFormItem) {
    if (!secret.id || secret.revealedValue !== null) {
      updateSecret(secret.tempId, (current) => ({ ...current, showValue: !current.showValue }));
      return;
    }
    if (secret.revealing) return;

    updateSecret(secret.tempId, (current) => ({ ...current, revealing: true }));
    try {
      const revealed = await revealCredentialItemSecret(credentialId, secret.id);
      updateSecret(secret.tempId, (current) => ({
        ...current,
        revealing: false,
        showValue: true,
        revealedValue: revealed.value ?? "",
        // Preenche só se a pessoa ainda não começou a digitar um valor novo.
        value: current.value === "" ? (revealed.value ?? "") : current.value,
      }));
    } catch (error) {
      updateSecret(secret.tempId, (current) => ({ ...current, revealing: false }));
      toast.error(withApiDetail("Não foi possível mostrar o segredo.", error));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!formIsValid) return;
    updateMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={cn(cardBody, "space-y-5")}>
        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Informações básicas</h2>
          </div>

          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
            <Field label="Label" error={submitted ? errors.label : null}>
              <input
                value={form.label}
                onChange={(e) => handleChange("label", e.target.value)}
                className={input}
                placeholder="Ex.: SAP produção"
              />
            </Field>

            <Field label="Repositório" error={submitted ? errors.repository : null}>
              <SearchableSelect<number>
                value={form.repository_id ? Number(form.repository_id) : ""}
                onChange={(value) => handleChange("repository_id", value === "" ? "" : String(value))}
                options={repositories.map((repository) => ({ value: repository.id, label: repository.name }))}
                placeholder="Selecione"
                searchPlaceholder="Buscar repositório..."
                disabled={repositoriesLoading}
                loading={repositoriesLoading}
              />
            </Field>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                <input
                  checked={form.active}
                  onChange={(e) => handleChange("active", e.target.checked)}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Credencial ativa
              </label>
            </div>
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <div>
              <h2 className={cardTitle}>Segredos</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Campo de valor em branco mantém o segredo atual. Digite um valor novo para substituir.
              </p>
            </div>
            <button type="button" onClick={addSecret} className={cn(btn.secondary, btn.sm)}>
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </div>

          <div className={cn(cardBody, "space-y-4")}>
            {visibleSecrets.length === 0 ? (
              <EmptyState
                compact
                title="Nenhum segredo ativo"
                description="Adicione pelo menos um segredo para a credencial continuar útil."
                action={
                  <button type="button" onClick={addSecret} className={btn.secondary}>
                    <Plus className="h-4 w-4" />
                    Adicionar segredo
                  </button>
                }
              />
            ) : null}

            {visibleSecrets.map((secret) => {
              const isStored = Boolean(secret.id);
              const keepsCurrent = isStored && secret.value === "";
              return (
                <div key={secret.tempId} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                    <Field label="Chave">
                      <input
                        value={secret.key}
                        onChange={(e) =>
                          updateSecret(secret.tempId, (current) => ({ ...current, key: e.target.value }))
                        }
                        className={cn(input, "font-mono")}
                        placeholder="TOKEN"
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </Field>

                    <Field
                      label="Valor"
                      help={keepsCurrent ? "Em branco: o valor gravado é mantido." : undefined}
                    >
                      <div className="relative">
                        <input
                          value={secret.value}
                          onChange={(e) =>
                            updateSecret(secret.tempId, (current) => ({ ...current, value: e.target.value }))
                          }
                          type={secret.showValue ? "text" : "password"}
                          className={cn(input, "pr-10")}
                          placeholder={isStored ? KEEP_PLACEHOLDER : "Valor secreto"}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => toggleReveal(secret)}
                          disabled={secret.revealing}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-900 disabled:opacity-60"
                          aria-label={secret.showValue ? "Ocultar valor" : "Mostrar valor"}
                          title={
                            isStored && secret.revealedValue === null
                              ? "Ver o valor gravado"
                              : secret.showValue
                                ? "Ocultar valor"
                                : "Mostrar valor"
                          }
                        >
                          {secret.revealing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : secret.showValue ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </Field>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeSecret(secret.tempId)}
                        className={cn(btn.icon, "h-10 w-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700")}
                        title="Remover segredo"
                        aria-label={`Remover segredo ${secret.key || "novo"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {submitted && errors.secrets ? <p className={fieldError}>{errors.secrets}</p> : null}
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
        <button type="button" onClick={() => navigate(backTo)} className={btn.secondary}>
          Cancelar
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending || (submitted && !formIsValid)}
          className={btn.primary}
        >
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  help,
  children,
}: {
  label: string;
  error?: string | null;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {error ? <p className={fieldError}>{error}</p> : help ? <p className={hint}>{help}</p> : null}
    </div>
  );
}
