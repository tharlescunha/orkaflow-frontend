import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Save, X } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableMultiSelect } from "@/components/common/searchable-multi-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { btn, card, cardBody, cardHeader, cardTitle, chip, fieldError, hint, input, label as labelClass, link, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listAutomations } from "@/services/api/automations";
import {
  createExclusiveGroup,
  getExclusiveGroup,
  updateExclusiveGroup,
  type ExclusiveGroupPayload,
  type ExclusiveGroupRead,
} from "@/services/api/exclusive-groups";
import { toast } from "@/store/toast-store";

type FormState = {
  name: string;
  label: string;
  description: string;
  active: boolean;
  automation_ids: number[];
};

type FormErrors = { name?: string };

const initialFormState: FormState = {
  name: "",
  label: "",
  description: "",
  active: true,
  automation_ids: [],
};

function groupToForm(group: ExclusiveGroupRead): FormState {
  return {
    name: group.name ?? "",
    label: group.label ?? "",
    description: group.description ?? "",
    active: Boolean(group.active),
    automation_ids: [...(group.automation_ids ?? [])],
  };
}

export function ExclusiveGroupFormPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = Number(params.groupId);
  const isEditMode = Number.isFinite(groupId) && groupId > 0;

  const groupQuery = useQuery({
    queryKey: ["exclusive-group-edit", groupId],
    queryFn: () => getExclusiveGroup(groupId),
    enabled: isEditMode,
  });

  const title = isEditMode ? "Editar grupo exclusivo" : "Novo grupo exclusivo";

  if (isEditMode && groupQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo="/exclusive-groups" backLabel="Voltar para grupos" />
        <div className="p-5">
          <DetailSkeleton fields={5} />
        </div>
      </section>
    );
  }

  if (isEditMode && (groupQuery.isError || !groupQuery.data)) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo="/exclusive-groups" backLabel="Voltar para grupos" />
        <div className="p-5">
          <QueryError
            error={groupQuery.error}
            what="o grupo exclusivo"
            onRetry={() => groupQuery.refetch()}
            retrying={groupQuery.isFetching}
          />
        </div>
      </section>
    );
  }

  // O formulário só nasce quando os dados chegaram: nada de re-hidratar por efeito depois.
  const initial = isEditMode && groupQuery.data ? groupToForm(groupQuery.data) : initialFormState;

  return (
    <ExclusiveGroupForm
      key={isEditMode ? `edit-${groupId}` : "new"}
      initial={initial}
      group={isEditMode ? (groupQuery.data ?? null) : null}
      title={title}
    />
  );
}

type FormProps = {
  initial: FormState;
  group: ExclusiveGroupRead | null;
  title: string;
};

function ExclusiveGroupForm({ initial, group, title }: FormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = group !== null;

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const automationsQuery = useQuery({
    queryKey: ["exclusive-group-form-automations"],
    queryFn: () => listAutomations(),
  });

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ["exclusive-groups"] });
    await queryClient.invalidateQueries({ queryKey: ["automation-exclusive-groups-form"] });
    await queryClient.invalidateQueries({ queryKey: ["automations"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: ExclusiveGroupPayload) => createExclusiveGroup(payload),
    onSuccess: async () => {
      toast.success("Grupo exclusivo cadastrado.");
      await invalidateLists();
      navigate("/exclusive-groups");
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cadastrar o grupo.", error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: ExclusiveGroupPayload) => updateExclusiveGroup((group as ExclusiveGroupRead).id, payload),
    onSuccess: async () => {
      toast.success("Grupo exclusivo atualizado.");
      await invalidateLists();
      await queryClient.invalidateQueries({ queryKey: ["exclusive-group-edit", (group as ExclusiveGroupRead).id] });
      navigate("/exclusive-groups");
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar o grupo.", error));
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name") setErrors((prev) => ({ ...prev, name: undefined }));
  }

  function removeAutomation(automationId: number) {
    handleChange(
      "automation_ids",
      form.automation_ids.filter((id) => id !== automationId)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = "Informe um nome para o grupo.";
    setErrors(nextErrors);
    if (nextErrors.name) return;

    const payload: ExclusiveGroupPayload = {
      name: form.name.trim(),
      label: form.label.trim() || null,
      description: form.description.trim() || null,
      active: form.active,
      automation_ids: [...form.automation_ids].sort((a, b) => a - b),
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  const automations = automationsQuery.data ?? [];
  const automationOptions = automations.map((automation) => ({
    value: automation.id,
    label: automation.label || automation.name,
    description: automation.active ? automation.repository_name || undefined : "inativa",
  }));
  const selectedAutomations = automations.filter((automation) => form.automation_ids.includes(automation.id));
  const checkboxClass = "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500";

  return (
    <section className={card}>
      <PageHeader
        title={title}
        description="As automações deste grupo nunca rodam ao mesmo tempo. Quem chega enquanto outra roda espera na fila com o motivo."
        backTo="/exclusive-groups"
        backLabel="Voltar para grupos"
      />

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="space-y-5 p-5">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Grupo</h2>
            </div>

            <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
              <Field label="Nome" error={errors.name} hintText="Identificador do grupo (único).">
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={input}
                  maxLength={120}
                  placeholder="Ex.: SAP_SUPRIMENTOS"
                  autoFocus={!isEditMode}
                />
              </Field>

              <Field label="Rótulo" hintText="Opcional. Nome amigável mostrado nas telas.">
                <input
                  value={form.label}
                  onChange={(e) => handleChange("label", e.target.value)}
                  className={input}
                  maxLength={150}
                  placeholder="Ex.: SAP Suprimentos"
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Descrição" hintText="Opcional. Por que essas automações não podem rodar juntas.">
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    className={cn(textarea, "min-h-[80px]")}
                    placeholder="Ex.: Todas usam o usuário de serviço RPA_SUPRI no SAP; duas sessões ao mesmo tempo derrubam o login."
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.active}
                    onChange={(e) => handleChange("active", e.target.checked)}
                    type="checkbox"
                    className={checkboxClass}
                  />
                  Grupo ativo
                </label>
                <p className={hint}>
                  Desativar não derruba nada: a task que estiver rodando termina normalmente e, a partir daí, o grupo deixa de segurar as outras.
                </p>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Automações do grupo</h2>
              <span className="text-xs text-slate-500">
                {form.automation_ids.length === 0 ? "Nenhuma" : `${form.automation_ids.length} selecionada(s)`}
              </span>
            </div>

            <div className={cn(cardBody, "space-y-3")}>
              {automationsQuery.isError ? (
                <QueryError
                  error={automationsQuery.error}
                  what="as automações"
                  onRetry={() => automationsQuery.refetch()}
                  retrying={automationsQuery.isFetching}
                />
              ) : (
                <>
                  <SearchableMultiSelect
                    label={automationsQuery.isLoading ? "Carregando..." : "Selecione as automações"}
                    options={automationOptions}
                    selectedValues={form.automation_ids}
                    onChange={(next) => handleChange("automation_ids", next)}
                    disabled={automationsQuery.isLoading}
                    emptyText="Nenhuma automação cadastrada."
                    searchPlaceholder="Buscar automação..."
                  />
                  {selectedAutomations.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedAutomations.map((automation) => (
                        <span key={automation.id} className={cn(chip, "max-w-full pr-1")}>
                          <span className="max-w-[260px] truncate" title={automation.name}>
                            {automation.label || automation.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAutomation(automation.id)}
                            aria-label={`Remover ${automation.label || automation.name}`}
                            className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Um grupo sem automações não segura ninguém.</p>
                  )}
                  <p className={hint}>Também dá para colocar uma automação no grupo pela tela da própria automação (bloco Concorrência).</p>
                </>
              )}
            </div>
          </section>

          {isEditMode ? (
            <section className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Em uso agora</h2>
              </div>
              <div className={cardBody}>
                {group.current_lock ? (
                  <p className="text-sm text-slate-700">
                    <Link className={link} to={`/tasks/${group.current_lock.task_id}`}>
                      Task #{group.current_lock.task_id}
                    </Link>{" "}
                    de {group.current_lock.automation_name || `automação #${group.current_lock.automation_id}`}
                    {group.current_lock.runner_name ? ` em ${group.current_lock.runner_name}` : ""}, desde{" "}
                    {formatDateTime(group.current_lock.acquired_at)}. As outras automações do grupo esperam ela terminar.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">Livre: nenhuma automação do grupo está rodando.</p>
                )}
              </div>
            </section>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={() => navigate("/exclusive-groups")} className={btn.secondary} disabled={isPending}>
            Cancelar
          </button>

          <button type="submit" disabled={isPending} className={btn.primary}>
            <Save className="h-4 w-4" />
            {isPending ? "Salvando..." : isEditMode ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  error,
  hintText,
  children,
}: {
  label: string;
  error?: string;
  hintText?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <p className={fieldError}>{error}</p> : hintText ? <p className={hint}>{hintText}</p> : null}
    </label>
  );
}
