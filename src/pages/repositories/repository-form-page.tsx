import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Save } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  createRepository,
  getRepository,
  updateRepository,
  type CreateRepositoryPayload,
  type RepositoryRead,
  type UpdateRepositoryPayload,
} from "@/services/api/repositories";
import { toast } from "@/store/toast-store";

type RepositoryFormState = {
  name: string;
  description: string;
  active: boolean;
};

type FormErrors = Partial<Record<keyof RepositoryFormState, string>>;

const NAME_MAX = 100;
const DESCRIPTION_MAX = 500;

const emptyForm: RepositoryFormState = {
  name: "",
  description: "",
  active: true,
};

function repositoryToForm(repository: RepositoryRead): RepositoryFormState {
  return {
    name: repository.name ?? "",
    description: repository.description ?? "",
    active: Boolean(repository.active),
  };
}

export function RepositoryFormPage() {
  const params = useParams<{ repositoryId?: string }>();

  const repositoryId = params.repositoryId ? Number(params.repositoryId) : null;
  const isEdit = repositoryId !== null && Number.isFinite(repositoryId) && repositoryId > 0;
  const invalidId = params.repositoryId !== undefined && !isEdit;

  const repositoryQuery = useQuery({
    queryKey: ["repository-form", repositoryId],
    queryFn: () => getRepository(repositoryId as number),
    enabled: isEdit,
  });

  const title = isEdit ? "Editar repositório" : "Novo repositório";
  const backTo = isEdit ? `/repositories/${repositoryId}` : "/repositories";
  const backLabel = isEdit ? "Voltar para o repositório" : "Voltar para repositórios";

  if (invalidId) {
    return (
      <section className={card}>
        <PageHeader title="Repositório" backTo="/repositories" backLabel="Voltar para repositórios" />
        <div className="p-5">
          <QueryError error={new Error("ID de repositório inválido.")} what="o repositório" />
        </div>
      </section>
    );
  }

  if (isEdit && repositoryQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo={backTo} backLabel={backLabel} />
        <div className="p-5">
          <DetailSkeleton fields={3} />
        </div>
      </section>
    );
  }

  if (isEdit && (repositoryQuery.isError || !repositoryQuery.data)) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo={backTo} backLabel={backLabel} />
        <div className="p-5">
          <QueryError
            error={repositoryQuery.error}
            what="o repositório"
            onRetry={() => repositoryQuery.refetch()}
            retrying={repositoryQuery.isFetching}
          />
        </div>
      </section>
    );
  }

  // O formulário só nasce quando os dados chegaram: nada de re-hidratar por efeito depois.
  const initial = isEdit && repositoryQuery.data ? repositoryToForm(repositoryQuery.data) : emptyForm;

  return (
    <RepositoryForm
      key={isEdit ? `edit-${repositoryId}` : "new"}
      initial={initial}
      repositoryId={isEdit ? (repositoryId as number) : null}
      title={title}
      backTo={backTo}
      backLabel={backLabel}
    />
  );
}

type RepositoryFormProps = {
  initial: RepositoryFormState;
  repositoryId: number | null;
  title: string;
  backTo: string;
  backLabel: string;
};

function RepositoryForm({ initial, repositoryId, title, backTo, backLabel }: RepositoryFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = repositoryId !== null;

  const [form, setForm] = useState<RepositoryFormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const createMutation = useMutation({
    mutationFn: (payload: CreateRepositoryPayload) => createRepository(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      toast.success("Repositório criado.");
      navigate(`/repositories/${data.id}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível criar o repositório.", error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRepositoryPayload) => updateRepository(repositoryId as number, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      queryClient.invalidateQueries({ queryKey: ["repository-detail", data.id] });
      toast.success("Repositório atualizado.");
      navigate(`/repositories/${data.id}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar o repositório.", error));
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function setField<K extends keyof RepositoryFormState>(field: K, value: RepositoryFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    const name = form.name.trim();
    if (!name) next.name = "Informe o nome do repositório.";
    else if (name.length > NAME_MAX) next.name = `Máximo de ${NAME_MAX} caracteres.`;
    if (form.description.trim().length > DESCRIPTION_MAX) next.description = `Máximo de ${DESCRIPTION_MAX} caracteres.`;
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
      return;
    }

    createMutation.mutate(payload);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  return (
    <section className={card}>
      <PageHeader
        title={title}
        description={isEdit ? "Altere o nome, a descrição ou o status do repositório." : "Um repositório agrupa os bots e suas versões."}
        backTo={backTo}
        backLabel={backLabel}
      />

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="p-5">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Dados do repositório</h2>
            </div>

            <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
              <Field label="Nome" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={input}
                  type="text"
                  maxLength={NAME_MAX}
                  placeholder="Ex.: rpa-financeiro"
                  autoFocus={!isEdit}
                />
              </Field>

              <div className="flex items-end pb-1">
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.active}
                    onChange={(e) => setField("active", e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Repositório ativo
                </label>
              </div>

              <div className="md:col-span-2">
                <Field
                  label="Descrição"
                  error={errors.description}
                  hintText={`Opcional. ${form.description.length}/${DESCRIPTION_MAX} caracteres.`}
                >
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    className={cn(textarea, "min-h-[140px]")}
                    placeholder="Para que serve este repositório, quem mantém, observações."
                    maxLength={DESCRIPTION_MAX}
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={() => navigate(backTo)} className={btn.secondary} disabled={isSubmitting}>
            Cancelar
          </button>

          <button type="submit" disabled={isSubmitting} className={btn.primary}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, error, hintText, children }: { label: string; error?: string; hintText?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <p className={fieldError}>{error}</p> : hintText ? <p className={hint}>{hintText}</p> : null}
    </label>
  );
}
