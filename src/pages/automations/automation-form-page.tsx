import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { KeyRound, Save, X } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableMultiSelect } from "@/components/common/searchable-multi-select";
import { SearchableSelect } from "@/components/common/searchable-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, chip, fieldError, hint, input, label as labelClass, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  createAutomation,
  createAutomationExclusiveGroup,
  getAutomation,
  listAutomations,
  listAutomationExclusiveGroups,
  updateAutomation,
  type AutomationRead,
  type CreateAutomationPayload,
  type UpdateAutomationPayload,
} from "@/services/api/automations";
import { listAllBots } from "@/services/api/bots";
import { getCredential, listCredentials } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";

type CredentialItemLike = {
  id: number;
  key?: string;
  key_name?: string;
  value_type?: string;
  masked_preview?: string | null;
  active?: boolean;
};

function getCredentialItemKey(item: CredentialItemLike): string {
  if (typeof item.key === "string" && item.key.trim()) return item.key.trim();
  if (typeof item.key_name === "string" && item.key_name.trim()) return item.key_name.trim();
  return "";
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type AutomationFormState = {
  name: string;
  label: string;
  description: string;
  repository_id: string;
  bot_id: string;
  default_priority: string;
  active: boolean;
  exclusive_group_ids: string[];
  new_exclusive_group_name: string;
  success_trigger_automation_ids: string[];
  default_parameters_json: string;
  default_runtime_parameters_json: string;
};

type FieldErrors = Partial<
  Record<
    "name" | "repository_id" | "bot_id" | "default_priority" | "default_parameters_json" | "default_runtime_parameters_json",
    string
  >
>;

const EMPTY_FORM: AutomationFormState = {
  name: "",
  label: "",
  description: "",
  repository_id: "",
  bot_id: "",
  default_priority: "5",
  active: true,
  exclusive_group_ids: [],
  new_exclusive_group_name: "",
  success_trigger_automation_ids: [],
  default_parameters_json: "",
  default_runtime_parameters_json: "",
};

function formFromAutomation(data: AutomationRead): AutomationFormState {
  return {
    name: data.name ?? "",
    label: data.label ?? "",
    description: data.description ?? "",
    repository_id: String(data.repository_id ?? ""),
    bot_id: String(data.bot_id ?? ""),
    default_priority: String(data.default_priority ?? 5),
    active: Boolean(data.active),
    exclusive_group_ids: (data.exclusive_group_ids ?? []).map(String),
    new_exclusive_group_name: "",
    success_trigger_automation_ids: (data.success_trigger_automation_ids ?? []).map(String),
    default_parameters_json: data.default_parameters_json
      ? JSON.stringify(data.default_parameters_json, null, 2)
      : "",
    default_runtime_parameters_json: data.default_runtime_parameters_json
      ? JSON.stringify(data.default_runtime_parameters_json, null, 2)
      : "",
  };
}

// Tela: decide entre criar e editar. Na edição, o formulário só é montado quando a automação chega
// (assim o refetch não sobrescreve o que a pessoa digitou).
export function AutomationFormPage() {
  const params = useParams<{ automationId: string }>();
  const automationId = params.automationId ? Number(params.automationId) : null;
  const isEditMode = Number.isFinite(automationId) && automationId !== null;

  const automationQuery = useQuery({
    queryKey: ["automation-form", automationId],
    queryFn: () => getAutomation(automationId as number),
    enabled: !!isEditMode,
  });

  const backTo = isEditMode ? `/automations/${automationId}` : "/automations";
  const backLabel = isEditMode ? "Voltar para detalhes" : "Voltar para automações";

  if (!isEditMode) {
    return (
      <div className="space-y-5">
        <section className={card}>
          <PageHeader
            backTo={backTo}
            backLabel={backLabel}
            title="Nova automação"
            description="Escolha o bot e o repositório, defina prioridade, concorrência e parâmetros padrão."
          />
          <AutomationForm initial={EMPTY_FORM} automationId={null} backTo={backTo} />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo={backTo}
          backLabel={backLabel}
          title={automationQuery.data ? `Editar ${automationQuery.data.name}` : "Editar automação"}
          description="Altere os dados e salve. Tasks já na fila não são afetadas."
        />
        {automationQuery.isError ? (
          <div className={cardBody}>
            <QueryError
              error={automationQuery.error}
              what="a automação"
              onRetry={() => automationQuery.refetch()}
              retrying={automationQuery.isFetching}
            />
          </div>
        ) : !automationQuery.data ? (
          <div className={cardBody}>
            <DetailSkeleton fields={8} />
          </div>
        ) : (
          <AutomationForm
            key={automationQuery.data.id}
            initial={formFromAutomation(automationQuery.data)}
            automationId={automationQuery.data.id}
            backTo={backTo}
          />
        )}
      </section>
    </div>
  );
}

function AutomationForm({
  initial,
  automationId,
  backTo,
}: {
  initial: AutomationFormState;
  automationId: number | null;
  backTo: string;
}) {
  const navigate = useNavigate();
  const isEditMode = automationId !== null;

  const [isPreparingSubmit, setIsPreparingSubmit] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<AutomationFormState>(initial);

  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null);
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-automation-form"],
    queryFn: () => listRepositories({ limit: 100 }),
  });

  const botsQuery = useQuery({
    queryKey: ["bots-automation-form"],
    queryFn: () => listAllBots(),
  });

  const exclusiveGroupsQuery = useQuery({
    queryKey: ["automation-exclusive-groups-form"],
    queryFn: () => listAutomationExclusiveGroups({ active: true }),
  });

  const triggerAutomationsQuery = useQuery({
    queryKey: ["automation-success-trigger-options"],
    queryFn: () => listAutomations({ active: true }),
  });

  const credentialRepositoriesQuery = useQuery({
    queryKey: ["automation-form-credential-repositories"],
    queryFn: () => listRepositories({ active: true }),
    enabled: credentialsModalOpen,
  });

  const credentialsQuery = useQuery({
    queryKey: ["automation-form-credential-list", selectedRepositoryId],
    queryFn: () => listCredentials({ repository_id: selectedRepositoryId ?? undefined, active: true }),
    enabled: credentialsModalOpen && Number.isFinite(selectedRepositoryId) && (selectedRepositoryId ?? 0) > 0,
  });

  const credentialDetailQuery = useQuery({
    queryKey: ["automation-form-credential-detail", selectedCredentialId],
    queryFn: () => getCredential(selectedCredentialId as number),
    enabled: credentialsModalOpen && Number.isFinite(selectedCredentialId) && (selectedCredentialId ?? 0) > 0,
  });

  const selectedRepositoryName =
    credentialRepositoriesQuery.data?.find((r) => r.id === selectedRepositoryId)?.name ?? null;

  const availableCredentialItems = (credentialDetailQuery.data?.items ?? [])
    .map((item: CredentialItemLike) => ({ ...item, resolvedKey: getCredentialItemKey(item) }))
    .filter((item) => item.resolvedKey);

  const availableBots = useMemo(() => {
    const bots = botsQuery.data?.items ?? [];

    if (!form.repository_id) return bots;

    return bots.filter((bot) => bot.repository_id === Number(form.repository_id));
  }, [botsQuery.data, form.repository_id]);

  // Listas mostram só itens ativos; o item já selecionado (ex.: edição de automação
  // com bot/repositório inativo) continua visível, marcado como "Inativo".
  const repositoryOptions = useMemo(
    () =>
      (repositoriesQuery.data ?? [])
        .filter((repository) => repository.active || String(repository.id) === form.repository_id)
        .map((repository) => ({
          value: String(repository.id),
          label: repository.name,
          description: repository.active ? null : "Inativo",
        })),
    [repositoriesQuery.data, form.repository_id]
  );

  const botOptions = useMemo(
    () =>
      availableBots
        .filter((bot) => bot.active || String(bot.id) === form.bot_id)
        .map((bot) => ({
          value: String(bot.id),
          label: bot.name,
          description: bot.active ? null : "Inativo",
        })),
    [availableBots, form.bot_id]
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateAutomationPayload) => createAutomation(payload),
    onSuccess: (data) => {
      toast.success(`Automação "${data.name}" criada.`);
      navigate(`/automations/${data.id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível criar a automação."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateAutomationPayload) =>
      updateAutomation(automationId as number, payload),
    onSuccess: () => {
      toast.success("Automação atualizada.");
      navigate(`/automations/${automationId}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível atualizar a automação."));
    },
  });

  function setFieldError(field: keyof FieldErrors, message?: string) {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }

  function handleChangeField<K extends keyof AutomationFormState>(
    field: K,
    value: AutomationFormState[K]
  ) {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: value,
      };

      if (field === "repository_id") {
        next.bot_id = "";
      }

      return next;
    });

    if (field in errors) {
      setFieldError(field as keyof FieldErrors, undefined);
    }
  }

  function toggleExclusiveGroup(groupId: number) {
    const value = String(groupId);
    setForm((prev) => {
      const exists = prev.exclusive_group_ids.includes(value);
      return {
        ...prev,
        exclusive_group_ids: exists
          ? prev.exclusive_group_ids.filter((item) => item !== value)
          : [...prev.exclusive_group_ids, value],
      };
    });
  }

  function toggleSuccessTriggerAutomation(targetId: number) {
    const value = String(targetId);
    setForm((prev) => {
      const exists = prev.success_trigger_automation_ids.includes(value);
      return {
        ...prev,
        success_trigger_automation_ids: exists
          ? prev.success_trigger_automation_ids.filter((item) => item !== value)
          : [...prev.success_trigger_automation_ids, value],
      };
    });
  }

  async function resolveExclusiveGroupIds() {
    const selectedIds = form.exclusive_group_ids.map(Number);
    const newGroupName = form.new_exclusive_group_name.trim();

    if (!newGroupName) {
      return selectedIds;
    }

    const existingGroup = (exclusiveGroupsQuery.data ?? []).find(
      (group) => group.name.trim().toLowerCase() === newGroupName.toLowerCase()
    );
    if (existingGroup) {
      return Array.from(new Set([...selectedIds, existingGroup.id]));
    }

    const createdGroup = await createAutomationExclusiveGroup({
      name: newGroupName,
      capacity: 1,
      active: true,
    });
    return Array.from(new Set([...selectedIds, createdGroup.id]));
  }

  function openCredentialsModal() {
    setSelectedRepositoryId(null);
    setSelectedCredentialId(null);
    setSelectedKeys([]);
    setCredentialsModalOpen(true);
  }

  function closeCredentialsModal() {
    setCredentialsModalOpen(false);
    setSelectedRepositoryId(null);
    setSelectedCredentialId(null);
    setSelectedKeys([]);
  }

  function toggleSelectedKey(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function handleGenerateCredentialJson() {
    const credential = credentialDetailQuery.data;

    if (!selectedRepositoryId) {
      toast.error("Selecione um repositório.");
      return;
    }
    if (!selectedCredentialId || !credential) {
      toast.error("Selecione uma credencial.");
      return;
    }
    if (!selectedKeys.length) {
      toast.error("Selecione pelo menos uma chave.");
      return;
    }

    const itens: Record<string, string> = {};
    selectedKeys.forEach((key) => {
      itens[key] = `{{credential:${credential.id}:${key}}}`;
    });

    const dadosAcesso: Record<string, unknown> = {
      repository_id: credential.repository_id,
      repository_name: credential.repository_name ?? null,
      credential_id: credential.id,
      credential_label: credential.label,
      itens,
    };

    let nextJson: Record<string, unknown> = { dados_acesso: dadosAcesso };

    if (form.default_parameters_json.trim()) {
      try {
        const parsed = JSON.parse(form.default_parameters_json);
        if (isObjectRecord(parsed)) {
          nextJson = { ...parsed, dados_acesso: dadosAcesso };
        }
      } catch {
        nextJson = { dados_acesso: dadosAcesso };
      }
    }

    handleChangeField("default_parameters_json", JSON.stringify(nextJson, null, 2));
    closeCredentialsModal();
  }

  function parseJsonField(
    raw: string,
    field: "default_parameters_json" | "default_runtime_parameters_json"
  ): Record<string, unknown> | null | false {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
        setFieldError(field, 'Deve ser um objeto JSON. Ex.: { "chave": "valor" }');
        return false;
      }
      setFieldError(field, undefined);
      return parsed as Record<string, unknown>;
    } catch {
      setFieldError(field, "JSON inválido. Verifique a sintaxe.");
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nextErrors: FieldErrors = {};
    if (!form.name.trim()) nextErrors.name = "Informe o nome.";
    if (!form.repository_id) nextErrors.repository_id = "Selecione o repositório.";
    if (!form.bot_id) nextErrors.bot_id = "Selecione o bot.";
    const priority = Number(form.default_priority);
    if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
      nextErrors.default_priority = "Use um número inteiro de 1 a 10.";
    }

    const parsedParametersJson = parseJsonField(form.default_parameters_json, "default_parameters_json");
    const parsedRuntimeJson = parseJsonField(form.default_runtime_parameters_json, "default_runtime_parameters_json");

    if (Object.keys(nextErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...nextErrors }));
      return;
    }

    if (parsedParametersJson === false || parsedRuntimeJson === false) {
      return;
    }

    let exclusiveGroupIds: number[];
    setIsPreparingSubmit(true);
    try {
      exclusiveGroupIds = await resolveExclusiveGroupIds();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível preparar o grupo exclusivo."));
      setIsPreparingSubmit(false);
      return;
    }
    setIsPreparingSubmit(false);

    const payload = {
      name: form.name.trim(),
      label: form.label.trim() || null,
      description: form.description.trim() || null,
      repository_id: Number(form.repository_id),
      bot_id: Number(form.bot_id),
      default_priority: Number(form.default_priority),
      active: form.active,
      exclusive_group_ids: exclusiveGroupIds,
      success_trigger_automation_ids: form.success_trigger_automation_ids.map(Number),
      default_parameters_json: parsedParametersJson,
      default_runtime_parameters_json: parsedRuntimeJson,
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
      return;
    }

    createMutation.mutate(payload);
  }

  const isSubmitting =
    isPreparingSubmit || createMutation.isPending || updateMutation.isPending;
  const triggerAutomationOptions = (triggerAutomationsQuery.data ?? []).filter(
    (automation) => !isEditMode || automation.id !== automationId
  );
  const triggerSelectOptions = triggerAutomationOptions.map((automation) => ({
    value: String(automation.id),
    label: automation.label ? `${automation.name} - ${automation.label}` : automation.name,
    description: automation.repository_name || automation.bot_name || null,
  }));
  const exclusiveGroups = exclusiveGroupsQuery.data ?? [];
  const exclusiveGroupOptions = exclusiveGroups.map((group) => ({
    value: String(group.id),
    label: group.label || group.name,
    description: group.label && group.label !== group.name ? group.name : null,
  }));
  const selectedExclusiveGroups = exclusiveGroups.filter((group) =>
    form.exclusive_group_ids.includes(String(group.id))
  );
  const selectedTriggerAutomations = triggerAutomationOptions.filter((automation) =>
    form.success_trigger_automation_ids.includes(String(automation.id))
  );

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-6 px-5 py-5 md:px-6">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Dados da automação</h2>
            </div>

            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <FormField label="Nome" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => handleChangeField("name", e.target.value)}
                  className={input}
                  required
                  maxLength={120}
                  aria-invalid={!!errors.name}
                />
              </FormField>

              <FormField label="Label" hintText="Nome amigável, opcional.">
                <input
                  value={form.label}
                  onChange={(e) => handleChangeField("label", e.target.value)}
                  className={input}
                  maxLength={150}
                />
              </FormField>

              <FormField label="Repositório" error={errors.repository_id} asDiv>
                <SearchableSelect
                  value={form.repository_id}
                  onChange={(value) => handleChangeField("repository_id", value)}
                  options={repositoryOptions}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar repositório..."
                  emptyText="Nenhum repositório encontrado."
                  loading={repositoriesQuery.isLoading}
                  required
                />
              </FormField>

              <FormField label="Bot" error={errors.bot_id} asDiv>
                <SearchableSelect
                  value={form.bot_id}
                  onChange={(value) => handleChangeField("bot_id", value)}
                  options={botOptions}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar bot..."
                  emptyText={
                    form.repository_id
                      ? "Nenhum bot ativo neste repositório."
                      : "Nenhum bot encontrado."
                  }
                  loading={botsQuery.isLoading}
                  required
                />
              </FormField>

              <FormField label="Prioridade padrão" error={errors.default_priority} hintText="1 roda primeiro, 10 por último.">
                <input
                  value={form.default_priority}
                  onChange={(e) => handleChangeField("default_priority", e.target.value)}
                  className={input}
                  type="number"
                  min={1}
                  max={10}
                  required
                  aria-invalid={!!errors.default_priority}
                />
              </FormField>

              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.active}
                    onChange={(e) => handleChangeField("active", e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Automação ativa
                </label>
              </div>

              <div className="md:col-span-2">
                <FormField label="Descrição">
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChangeField("description", e.target.value)}
                    className={textarea}
                    maxLength={1000}
                  />
                </FormField>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Concorrência</h2>
            </div>

            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <FormField label="Grupos exclusivos" asDiv hintText="Automações do mesmo grupo não rodam ao mesmo tempo.">
                <SearchableMultiSelect
                  label={exclusiveGroupsQuery.isLoading ? "Carregando..." : "Selecione os grupos"}
                  options={exclusiveGroupOptions}
                  selectedValues={form.exclusive_group_ids}
                  onChange={(next) => handleChangeField("exclusive_group_ids", next)}
                  disabled={exclusiveGroupsQuery.isLoading}
                  emptyText="Nenhum grupo cadastrado."
                  searchPlaceholder="Buscar grupo..."
                />
                <SelectedChips
                  items={selectedExclusiveGroups.map((group) => ({
                    id: group.id,
                    label: group.label || group.name,
                  }))}
                  onRemove={toggleExclusiveGroup}
                />
              </FormField>

              <FormField label="Novo grupo exclusivo" hintText="Cria o grupo ao salvar e já vincula esta automação.">
                <input
                  value={form.new_exclusive_group_name}
                  onChange={(e) =>
                    handleChangeField("new_exclusive_group_name", e.target.value)
                  }
                  className={input}
                  maxLength={120}
                  placeholder="Ex.: SAP_ZCONF_LOGIN_PADRAO"
                />
              </FormField>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Parâmetros do robô</h2>
            </div>
            <div className={cardBody}>
              <p className="mb-4 text-sm text-slate-500">
                Parâmetros padrão usados quando esta automação for disparada por gatilho de sucesso
                e não houver parâmetros herdados.
              </p>
              <FormField label="Parâmetros de execução (runtime_parameters_json)" error={errors.default_runtime_parameters_json}>
                <textarea
                  value={form.default_runtime_parameters_json}
                  onChange={(e) =>
                    handleChangeField("default_runtime_parameters_json", e.target.value)
                  }
                  className={cn(textarea, "font-mono", errors.default_runtime_parameters_json && "border-red-400")}
                  placeholder={'Ex.: { "filial": "001", "safra": "2026" }'}
                  spellCheck={false}
                  aria-invalid={!!errors.default_runtime_parameters_json}
                />
              </FormField>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Credenciais JSON</h2>
              <button type="button" onClick={openCredentialsModal} className={btn.secondary}>
                <KeyRound className="h-4 w-4" />
                Usar credenciais
              </button>
            </div>
            <div className={cn(cardBody, "space-y-3")}>
              <p className="text-sm text-slate-500">
                Credenciais padrão (dados_acesso) usadas quando esta automação for disparada por
                gatilho de sucesso e não houver credenciais herdadas.
              </p>
              <FormField label="Parameters JSON (default_parameters_json)" error={errors.default_parameters_json}>
                <textarea
                  value={form.default_parameters_json}
                  onChange={(e) =>
                    handleChangeField("default_parameters_json", e.target.value)
                  }
                  className={cn(textarea, "min-h-[160px] font-mono", errors.default_parameters_json && "border-red-400")}
                  placeholder={'Ex.: { "dados_acesso": { "credential_id": 1, "itens": { "email": null } } }'}
                  spellCheck={false}
                  aria-invalid={!!errors.default_parameters_json}
                />
              </FormField>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Gatilho de sucesso</h2>
            </div>

            <div className="grid gap-5 px-5 py-5">
              <FormField label="Ao finalizar com sucesso, disparar" asDiv>
                <SearchableMultiSelect
                  label={
                    triggerAutomationsQuery.isLoading
                      ? "Carregando..."
                      : "Selecione as automações"
                  }
                  options={triggerSelectOptions}
                  selectedValues={form.success_trigger_automation_ids}
                  onChange={(next) =>
                    handleChangeField("success_trigger_automation_ids", next)
                  }
                  disabled={triggerAutomationsQuery.isLoading}
                  emptyText="Nenhuma automação ativa disponível."
                  searchPlaceholder="Buscar automação..."
                />
                <SelectedChips
                  items={selectedTriggerAutomations.map((automation) => ({
                    id: automation.id,
                    label: automation.label
                      ? `${automation.name} - ${automation.label}`
                      : automation.name,
                  }))}
                  onRemove={toggleSuccessTriggerAutomation}
                />
              </FormField>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 md:px-6">
          <button type="button" onClick={() => navigate(backTo)} className={btn.secondary} disabled={isSubmitting}>
            Cancelar
          </button>

          <button type="submit" disabled={isSubmitting} className={btn.primary}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      {credentialsModalOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-6"
          onClick={closeCredentialsModal}
          role="dialog"
          aria-modal="true"
          aria-label="Usar credenciais no Parameters JSON"
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Usar credenciais no Parameters JSON
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Selecione um repositório, uma credencial e as chaves que deseja injetar no JSON.
                </p>
              </div>
              <button type="button" onClick={closeCredentialsModal} className={btn.icon} aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-144px)] space-y-6 overflow-y-auto px-6 py-6">
              <section className={card}>
                <div className={cardHeader}>
                  <h3 className={cardTitle}>Seleção da credencial</h3>
                </div>
                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Repositório" asDiv>
                    <SearchableSelect
                      value={selectedRepositoryId ?? ""}
                      onChange={(value) => {
                        setSelectedRepositoryId(value ? Number(value) : null);
                        setSelectedCredentialId(null);
                        setSelectedKeys([]);
                      }}
                      options={(credentialRepositoriesQuery.data ?? []).map((repo) => ({
                        value: repo.id,
                        label: repo.name,
                      }))}
                      placeholder="Selecione"
                      searchPlaceholder="Buscar repositório..."
                      emptyText="Nenhum repositório encontrado."
                      loading={credentialRepositoriesQuery.isLoading}
                      disabled={credentialRepositoriesQuery.isLoading}
                    />
                  </FormField>
                  <FormField label="Credencial" asDiv>
                    <SearchableSelect
                      value={selectedCredentialId ?? ""}
                      onChange={(value) => {
                        setSelectedCredentialId(value ? Number(value) : null);
                        setSelectedKeys([]);
                      }}
                      options={(credentialsQuery.data ?? []).map((cred) => ({
                        value: cred.id,
                        label: cred.label,
                      }))}
                      placeholder={selectedRepositoryId ? "Selecione" : "Selecione um repositório"}
                      searchPlaceholder="Buscar credencial..."
                      emptyText="Nenhuma credencial encontrada."
                      loading={!!selectedRepositoryId && credentialsQuery.isLoading}
                      disabled={!selectedRepositoryId || credentialsQuery.isLoading}
                    />
                  </FormField>
                </div>
                {selectedRepositoryName ? (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      <span className="font-medium">Repositório selecionado: </span>
                      {selectedRepositoryName}
                    </div>
                  </div>
                ) : null}
              </section>

              {selectedCredentialId && credentialDetailQuery.isLoading ? (
                <div className={cn(card, "px-5 py-5")}>
                  <DetailSkeleton fields={4} />
                </div>
              ) : null}

              {selectedCredentialId && credentialDetailQuery.isError ? (
                <QueryError
                  error={credentialDetailQuery.error}
                  what="os itens da credencial"
                  onRetry={() => credentialDetailQuery.refetch()}
                  retrying={credentialDetailQuery.isFetching}
                />
              ) : null}

              {credentialDetailQuery.data ? (
                <section className={card}>
                  <div className={cardHeader}>
                    <h3 className={cardTitle}>Chaves disponíveis</h3>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <p>
                        <span className="font-medium">Label:</span>{" "}
                        {credentialDetailQuery.data.label}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium">Repositório:</span>{" "}
                        {credentialDetailQuery.data.repository_name ?? selectedRepositoryName ?? "-"}
                      </p>
                    </div>
                    {availableCredentialItems.length ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {availableCredentialItems.map((item) => {
                          const checked = selectedKeys.includes(item.resolvedKey);
                          return (
                            <label
                              key={item.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition",
                                checked ? "border-blue-500 bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectedKey(item.resolvedKey)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900">
                                  {item.resolvedKey}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Tipo: {item.value_type ?? "-"}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState compact title="Sem chaves válidas" description="Essa credencial não possui chaves válidas para seleção." />
                    )}
                  </div>
                </section>
              ) : null}

              <section className={card}>
                <div className={cardHeader}>
                  <h3 className={cardTitle}>Preview do bloco gerado</h3>
                </div>
                <div className={cardBody}>
                  <pre className="min-h-[180px] overflow-x-auto rounded-lg border border-slate-300 bg-slate-950 px-4 py-4 font-mono text-xs text-slate-100">
{JSON.stringify(
  {
    dados_acesso: {
      repository_id: selectedRepositoryId ?? null,
      repository_name: selectedRepositoryName,
      credential_id: selectedCredentialId ?? null,
      credential_label: credentialDetailQuery.data?.label ?? null,
      itens: Object.fromEntries(
        selectedKeys.map((key) => [
          key,
          selectedCredentialId ? `{{credential:${selectedCredentialId}:${key}}}` : null,
        ])
      ),
    },
  },
  null,
  2
)}
                  </pre>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={closeCredentialsModal} className={btn.secondary}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateCredentialJson}
                disabled={!selectedRepositoryId || !selectedCredentialId || !selectedKeys.length}
                className={btn.primary}
              >
                <KeyRound className="h-4 w-4" />
                Gerar JSON
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// asDiv: para campos cujo controle não é um input nativo (SearchableSelect), evita que o clique no
// label abra/feche o painel duas vezes.
function FormField({
  label,
  error,
  hintText,
  asDiv = false,
  children,
}: {
  label: string;
  error?: string;
  hintText?: string;
  asDiv?: boolean;
  children: ReactNode;
}) {
  const Wrapper = asDiv ? "div" : "label";
  return (
    <Wrapper className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <p className={fieldError}>{error}</p> : hintText ? <p className={hint}>{hintText}</p> : null}
    </Wrapper>
  );
}

function SelectedChips({
  items,
  onRemove,
}: {
  items: { id: number; label: string }[];
  onRemove: (id: number) => void;
}) {
  if (!items.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item.id} className={cn(chip, "max-w-full pr-1")}>
          <span className="max-w-[260px] truncate" title={item.label}>
            {item.label}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              onRemove(item.id);
            }}
            aria-label={`Remover ${item.label}`}
            className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
