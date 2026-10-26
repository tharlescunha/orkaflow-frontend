import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { PageHeader } from "@/components/common/page-header";
import { SearchableSelect } from "@/components/common/searchable-select";
import { withApiDetail } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { createCredential, createCredentialItem } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";

type SecretFormItem = {
  tempId: string;
  key: string;
  value: string;
  showValue: boolean;
};

type CreateCredentialFormState = {
  label: string;
  repository_id: string;
  active: boolean;
  secrets: SecretFormItem[];
};

const createEmptySecret = (): SecretFormItem => ({
  tempId: uuidv4(),
  key: "",
  value: "",
  showValue: false,
});

const initialFormState: CreateCredentialFormState = {
  label: "",
  repository_id: "",
  active: true,
  secrets: [createEmptySecret()],
};

export function CredentialCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateCredentialFormState>(initialFormState);
  const [submitted, setSubmitted] = useState(false);

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const createdCredential = await createCredential({
        label: form.label.trim(),
        repository_id: Number(form.repository_id),
        active: form.active,
      });

      const validSecrets = form.secrets
        .map((item) => ({ key: item.key.trim(), value: item.value }))
        .filter((item) => item.key && item.value);

      for (const secret of validSecrets) {
        await createCredentialItem(createdCredential.id, {
          key: secret.key,
          value: secret.value,
          value_type: "secret",
          notes: null,
          active: true,
        });
      }

      return createdCredential;
    },
    onSuccess: (credential) => {
      toast.success("Credencial cadastrada.");
      navigate(`/credentials/${credential.id}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cadastrar a credencial.", error));
    },
  });

  const repositories = repositoriesQuery.data ?? [];

  const validSecretsCount = useMemo(
    () => form.secrets.filter((item) => item.key.trim() && item.value).length,
    [form.secrets]
  );

  const errors = {
    label: form.label.trim() ? null : "Informe o label.",
    repository: form.repository_id ? null : "Selecione o repositório.",
    secrets: validSecretsCount > 0 ? null : "Informe pelo menos um segredo com chave e valor.",
  };
  const formIsValid = !errors.label && !errors.repository && !errors.secrets;

  function handleChangeField<K extends keyof CreateCredentialFormState>(
    field: K,
    value: CreateCredentialFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateSecret(tempId: string, updater: (current: SecretFormItem) => SecretFormItem) {
    setForm((prev) => ({
      ...prev,
      secrets: prev.secrets.map((item) => (item.tempId === tempId ? updater(item) : item)),
    }));
  }

  function addSecret() {
    setForm((prev) => ({ ...prev, secrets: [...prev.secrets, createEmptySecret()] }));
  }

  function removeSecret(tempId: string) {
    setForm((prev) => {
      const nextSecrets = prev.secrets.filter((item) => item.tempId !== tempId);
      return { ...prev, secrets: nextSecrets.length > 0 ? nextSecrets : [createEmptySecret()] };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!formIsValid) return;
    createMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/credentials"
          backLabel="Voltar para credenciais"
          title="Nova credencial"
          description="Cadastre o label, o repositório e os segredos. Os valores são criptografados no servidor."
        />

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
                    onChange={(e) => handleChangeField("label", e.target.value)}
                    className={input}
                    placeholder="Ex.: SAP produção"
                    autoFocus
                  />
                </Field>

                <Field label="Repositório" error={submitted ? errors.repository : null}>
                  <SearchableSelect<number>
                    value={form.repository_id ? Number(form.repository_id) : ""}
                    onChange={(value) => handleChangeField("repository_id", value === "" ? "" : String(value))}
                    options={repositories.map((repository) => ({ value: repository.id, label: repository.name }))}
                    placeholder="Selecione"
                    searchPlaceholder="Buscar repositório..."
                    disabled={repositoriesQuery.isLoading}
                    loading={repositoriesQuery.isLoading}
                  />
                </Field>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                    <input
                      checked={form.active}
                      onChange={(e) => handleChangeField("active", e.target.checked)}
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
                    Pares chave/valor. O robô lê pela chave; o valor fica criptografado.
                  </p>
                </div>
                <button type="button" onClick={addSecret} className={cn(btn.secondary, btn.sm)}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>

              <div className={cn(cardBody, "space-y-4")}>
                {form.secrets.map((secret, index) => (
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

                      <Field label="Valor">
                        <div className="relative">
                          <input
                            value={secret.value}
                            onChange={(e) =>
                              updateSecret(secret.tempId, (current) => ({ ...current, value: e.target.value }))
                            }
                            type={secret.showValue ? "text" : "password"}
                            className={cn(input, "pr-10")}
                            placeholder="Valor secreto"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateSecret(secret.tempId, (current) => ({
                                ...current,
                                showValue: !current.showValue,
                              }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-900"
                            aria-label={secret.showValue ? "Ocultar valor" : "Mostrar valor"}
                            title={secret.showValue ? "Ocultar valor" : "Mostrar valor"}
                          >
                            {secret.showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </Field>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeSecret(secret.tempId)}
                          className={cn(btn.icon, "h-10 w-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700")}
                          title="Remover segredo"
                          aria-label={`Remover segredo ${index + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {submitted && errors.secrets ? <p className={fieldError}>{errors.secrets}</p> : null}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
            <button type="button" onClick={() => navigate("/credentials")} className={btn.secondary}>
              Cancelar
            </button>
            <button type="submit" disabled={createMutation.isPending || (submitted && !formIsValid)} className={btn.primary}>
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Salvando..." : "Criar credencial"}
            </button>
          </div>
        </form>
      </section>
    </div>
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
