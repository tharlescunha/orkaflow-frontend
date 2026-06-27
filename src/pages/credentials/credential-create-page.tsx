import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Plus, Save, Trash2, X } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

import { createCredential, createCredentialItem } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

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

  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<CreateCredentialFormState>(initialFormState);

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const createdCredential = await createCredential({
        label: form.label.trim(),
        repository_id: Number(form.repository_id),
        active: form.active,
      });

      const validSecrets = form.secrets
        .map((item) => ({
          key: item.key.trim(),
          value: item.value,
        }))
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
      setToast({
        type: "success",
        message: "Credencial cadastrada com sucesso.",
      });

      setTimeout(() => {
        navigate(`/credentials/${credential.id}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível cadastrar a credencial.",
      });
    },
  });

  const repositories = repositoriesQuery.data ?? [];

  const formIsValid = useMemo(() => {
    const hasMainData = form.label.trim() && form.repository_id;
    const validSecrets = form.secrets.filter((item) => item.key.trim() && item.value);
    return Boolean(hasMainData && validSecrets.length > 0);
  }, [form]);

  function handleChangeField<K extends keyof CreateCredentialFormState>(
    field: K,
    value: CreateCredentialFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateSecret(
    tempId: string,
    updater: (current: SecretFormItem) => SecretFormItem
  ) {
    setForm((prev) => ({
      ...prev,
      secrets: prev.secrets.map((item) => (item.tempId === tempId ? updater(item) : item)),
    }));
  }

  function addSecret() {
    setForm((prev) => ({
      ...prev,
      secrets: [...prev.secrets, createEmptySecret()],
    }));
  }

  function removeSecret(tempId: string) {
    setForm((prev) => {
      const nextSecrets = prev.secrets.filter((item) => item.tempId !== tempId);

      return {
        ...prev,
        secrets: nextSecrets.length > 0 ? nextSecrets : [createEmptySecret()],
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formIsValid) return;
    createMutation.mutate();
  }

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`fixed right-6 top-20 z-[80] flex items-start gap-3 border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="pr-4 text-sm font-medium">{toast.message}</div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 transition hover:text-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/credentials")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para credenciais
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">Nova Credencial</h1>
              <p className="mt-1 text-sm text-slate-500">
                Cadastro de nova credencial com segredos protegidos.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-6 py-6">
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Informações básicas
                </h2>
              </div>

              <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                <FormField label="Label">
                  <input
                    value={form.label}
                    onChange={(e) => handleChangeField("label", e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder="Nome identificador da credencial"
                    required
                  />
                </FormField>

                <FormField label="Repositório">
                  <select
                    value={form.repository_id}
                    onChange={(e) => handleChangeField("repository_id", e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    required
                    disabled={repositoriesQuery.isLoading}
                  >
                    <option value="">Selecione</option>
                    {repositories.map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                    <input
                      checked={form.active}
                      onChange={(e) => handleChangeField("active", e.target.checked)}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Credencial ativa
                  </label>
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Segredos
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Os valores serão enviados ao backend para armazenamento criptografado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addSecret}
                  className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>

              <div className="space-y-4 px-5 py-5">
                {form.secrets.map((secret) => (
                  <div key={secret.tempId} className="border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                      <FormField label="Chave">
                        <input
                          value={secret.key}
                          onChange={(e) =>
                            updateSecret(secret.tempId, (current) => ({
                              ...current,
                              key: e.target.value,
                            }))
                          }
                          className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          placeholder="TOKEN"
                        />
                      </FormField>

                      <FormField label="Valor">
                        <div className="relative">
                          <input
                            value={secret.value}
                            onChange={(e) =>
                              updateSecret(secret.tempId, (current) => ({
                                ...current,
                                value: e.target.value,
                              }))
                            }
                            type={secret.showValue ? "text" : "password"}
                            className="h-10 w-full border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            placeholder="Valor secreto"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateSecret(secret.tempId, (current) => ({
                                ...current,
                                showValue: !current.showValue,
                              }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                          >
                            {secret.showValue ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormField>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeSecret(secret.tempId)}
                          className="inline-flex h-10 w-10 items-center justify-center border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                          title="Remover segredo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => navigate("/credentials")}
              className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending || !formIsValid}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-slate-900">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
