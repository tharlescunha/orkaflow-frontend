import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Save, X } from "lucide-react";

import {
  createRepository,
  getRepository,
  updateRepository,
  type CreateRepositoryPayload,
  type UpdateRepositoryPayload,
} from "@/services/api/repositories";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type RepositoryFormState = {
  name: string;
  description: string;
  active: boolean;
};

export function RepositoryFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ repositoryId?: string }>();

  const repositoryId = params.repositoryId ? Number(params.repositoryId) : null;
  const isEdit = Number.isFinite(repositoryId) && !!repositoryId;

  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<RepositoryFormState>({
    name: "",
    description: "",
    active: true,
  });

  const repositoryQuery = useQuery({
    queryKey: ["repository-form", repositoryId],
    queryFn: () => getRepository(repositoryId as number),
    enabled: !!isEdit,
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!repositoryQuery.data) return;

    setForm({
      name: repositoryQuery.data.name ?? "",
      description: repositoryQuery.data.description ?? "",
      active: Boolean(repositoryQuery.data.active),
    });
  }, [repositoryQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateRepositoryPayload) => createRepository(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      setToast({
        type: "success",
        message: "Repositório criado com sucesso.",
      });

      setTimeout(() => {
        navigate(`/repositories/${data.id}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível criar o repositório.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRepositoryPayload) =>
      updateRepository(repositoryId as number, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({
        queryKey: ["repository-detail", data.id],
      });

      setToast({
        type: "success",
        message: "Repositório atualizado com sucesso.",
      });

      setTimeout(() => {
        navigate(`/repositories/${data.id}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível atualizar o repositório.",
      });
    },
  });

  const isSubmitting = useMemo(() => {
    return createMutation.isPending || updateMutation.isPending;
  }, [createMutation.isPending, updateMutation.isPending]);

  function handleChangeField<K extends keyof RepositoryFormState>(
    field: K,
    value: RepositoryFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
    };

    if (!payload.name) {
      setToast({
        type: "error",
        message: "O nome do repositório é obrigatório.",
      });
      return;
    }

    if (isEdit) {
      updateMutation.mutate(payload);
      return;
    }

    createMutation.mutate(payload);
  }

  if (params.repositoryId && (!Number.isFinite(repositoryId) || repositoryId! <= 0)) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de repositório inválido.
          </div>
        </section>
      </div>
    );
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
                onClick={() =>
                  navigate(
                    isEdit
                      ? `/repositories/${repositoryId}`
                      : "/repositories"
                  )
                }
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                {isEdit ? "Voltar para detalhes" : "Voltar para repositórios"}
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                {isEdit ? "Editar Repositório" : "Novo Repositório"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {isEdit
                  ? "Altere os dados cadastrais do repositório."
                  : "Cadastre um novo repositório no OrkaFlow."}
              </p>
            </div>
          </div>
        </div>

        {isEdit && repositoryQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            Carregando repositório...
          </div>
        ) : isEdit && (repositoryQuery.isError || !repositoryQuery.data) ? (
          <div className="px-6 py-10 text-sm text-red-600">
            Não foi possível carregar os dados do repositório.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Dados do repositório
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Nome">
                    <input
                      value={form.name}
                      onChange={(e) => handleChangeField("name", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="text"
                      maxLength={100}
                      required
                    />
                  </FormField>

                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.active}
                        onChange={(e) =>
                          handleChangeField("active", e.target.checked)
                        }
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Repositório ativo
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <FormField label="Descrição">
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          handleChangeField("description", e.target.value)
                        }
                        className="min-h-[140px] w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        placeholder="Descrição do repositório"
                        maxLength={500}
                      />
                    </FormField>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    isEdit
                      ? `/repositories/${repositoryId}`
                      : "/repositories"
                  )
                }
                className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        )}
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
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
