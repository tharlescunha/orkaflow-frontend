import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, Save, X } from "lucide-react";

import {
  createAutomation,
  createAutomationExclusiveGroup,
  getAutomation,
  listAutomations,
  listAutomationExclusiveGroups,
  updateAutomation,
  type CreateAutomationPayload,
  type UpdateAutomationPayload,
} from "@/services/api/automations";
import { getCredential, listCredentials } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import { listBots } from "@/services/api/bots";

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

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

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

export function AutomationFormPage() {
  const navigate = useNavigate();
  const params = useParams<{ automationId: string }>();

  const automationId = params.automationId ? Number(params.automationId) : null;
  const isEditMode = Number.isFinite(automationId) && automationId !== null;

  const [toast, setToast] = useState<ToastState>(null);
  const [isPreparingSubmit, setIsPreparingSubmit] = useState(false);
  const [jsonErrors, setJsonErrors] = useState<{ default_parameters_json?: string; default_runtime_parameters_json?: string }>({});

  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null);
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const [form, setForm] = useState<AutomationFormState>({
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
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-automation-form"],
    queryFn: () => listRepositories({ limit: 100 }),
  });

  const botsQuery = useQuery({
    queryKey: ["bots-automation-form"],
    queryFn: () => listBots({ limit: 100 }),
  });

  const automationQuery = useQuery({
    queryKey: ["automation-form", automationId],
    queryFn: () => getAutomation(automationId as number),
    enabled: !!isEditMode,
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

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!automationQuery.data) return;

    const data = automationQuery.data;

    setForm({
      name: data.name ?? "",
      label: data.label ?? "",
      description: data.description ?? "",
      repository_id: String(data.repository_id ?? ""),
      bot_id: String(data.bot_id ?? ""),
      default_priority: String(data.default_priority ?? 5),
      active: Boolean(data.active),
      exclusive_group_ids: (data.exclusive_group_ids ?? []).map(String),
      new_exclusive_group_name: "",
      success_trigger_automation_ids: (
        data.success_trigger_automation_ids ?? []
      ).map(String),
      default_parameters_json: data.default_parameters_json
        ? JSON.stringify(data.default_parameters_json, null, 2)
        : "",
      default_runtime_parameters_json: data.default_runtime_parameters_json
        ? JSON.stringify(data.default_runtime_parameters_json, null, 2)
        : "",
    });
  }, [automationQuery.data]);

  const availableBots = useMemo(() => {
    const bots = botsQuery.data?.items ?? [];

    if (!form.repository_id) return bots;

    return bots.filter((bot) => bot.repository_id === Number(form.repository_id));
  }, [botsQuery.data, form.repository_id]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateAutomationPayload) => createAutomation(payload),
    onSuccess: (data) => {
      setToast({
        type: "success",
        message: "Automação criada com sucesso.",
      });

      setTimeout(() => {
        navigate(`/automations/${data.id}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível criar a automação.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateAutomationPayload) =>
      updateAutomation(automationId as number, payload),
    onSuccess: () => {
      setToast({
        type: "success",
        message: "Automação atualizada com sucesso.",
      });

      setTimeout(() => {
        navigate(`/automations/${automationId}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível atualizar a automação.",
      });
    },
  });

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

  function toggleSuccessTriggerAutomation(automationId: number) {
    const value = String(automationId);
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
      setToast({ type: "error", message: "Selecione um repositório." });
      return;
    }
    if (!selectedCredentialId || !credential) {
      setToast({ type: "error", message: "Selecione uma credencial." });
      return;
    }
    if (!selectedKeys.length) {
      setToast({ type: "error", message: "Selecione pelo menos uma chave." });
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
        setJsonErrors((prev) => ({ ...prev, [field]: "Deve ser um objeto JSON. Ex.: { \"chave\": \"valor\" }" }));
        return false;
      }
      setJsonErrors((prev) => ({ ...prev, [field]: undefined }));
      return parsed as Record<string, unknown>;
    } catch {
      setJsonErrors((prev) => ({ ...prev, [field]: "JSON inválido. Verifique a sintaxe." }));
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.repository_id || !form.bot_id) {
      setToast({
        type: "error",
        message: "Selecione o repositório e o bot.",
      });
      return;
    }

    const parsedParametersJson = parseJsonField(form.default_parameters_json, "default_parameters_json");
    const parsedRuntimeJson = parseJsonField(form.default_runtime_parameters_json, "default_runtime_parameters_json");

    if (parsedParametersJson === false || parsedRuntimeJson === false) {
      setToast({ type: "error", message: "Corrija os erros de JSON antes de salvar." });
      return;
    }

    let exclusiveGroupIds: number[];
    setIsPreparingSubmit(true);
    try {
      exclusiveGroupIds = await resolveExclusiveGroupIds();
    } catch {
      setToast({
        type: "error",
        message: "Não foi possível preparar o grupo exclusivo.",
      });
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
  const repositories = repositoriesQuery.data ?? [];
  const triggerAutomationOptions = (triggerAutomationsQuery.data ?? []).filter(
    (automation) => !isEditMode || automation.id !== automationId
  );

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
                  navigate(isEditMode ? `/automations/${automationId}` : "/automations")
                }
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                {isEditMode ? "Voltar para detalhes" : "Voltar para automações"}
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                {isEditMode ? "Editar Automação" : "Nova Automação"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Cadastro e manutenção de automações.
              </p>
            </div>
          </div>
        </div>

        {isEditMode && automationQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            Carregando automação...
          </div>
        ) : isEditMode && (automationQuery.isError || !automationQuery.data) ? (
          <div className="px-6 py-10 text-sm text-red-600">
            Não foi possível carregar os dados da automação.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Dados da automação
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Nome">
                    <input
                      value={form.name}
                      onChange={(e) => handleChangeField("name", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                      maxLength={120}
                    />
                  </FormField>

                  <FormField label="Label">
                    <input
                      value={form.label}
                      onChange={(e) => handleChangeField("label", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      maxLength={150}
                    />
                  </FormField>

                  <FormField label="Repositório">
                    <select
                      value={form.repository_id}
                      onChange={(e) => handleChangeField("repository_id", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    >
                      <option value="">Selecione</option>
                      {repositories.map((repository) => (
                        <option key={repository.id} value={repository.id}>
                          {repository.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Bot">
                    <select
                      value={form.bot_id}
                      onChange={(e) => handleChangeField("bot_id", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    >
                      <option value="">Selecione</option>
                      {availableBots.map((bot) => (
                        <option key={bot.id} value={bot.id}>
                          {bot.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Prioridade padrão">
                    <input
                      value={form.default_priority}
                      onChange={(e) => handleChangeField("default_priority", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="number"
                      min={1}
                      max={10}
                      required
                    />
                  </FormField>

                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.active}
                        onChange={(e) => handleChangeField("active", e.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Automação ativa
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <FormField label="Descrição">
                      <textarea
                        value={form.description}
                        onChange={(e) => handleChangeField("description", e.target.value)}
                        className="min-h-[120px] w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        maxLength={1000}
                      />
                    </FormField>
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Concorrencia
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Grupos exclusivos">
                    <div className="min-h-10 border border-slate-300 bg-white px-3 py-2">
                      {exclusiveGroupsQuery.isLoading ? (
                        <div className="text-sm text-slate-500">Carregando...</div>
                      ) : (exclusiveGroupsQuery.data ?? []).length === 0 ? (
                        <div className="text-sm text-slate-500">
                          Nenhum grupo cadastrado.
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          {(exclusiveGroupsQuery.data ?? []).map((group) => (
                            <label
                              key={group.id}
                              className="flex items-center gap-3 text-sm text-slate-700"
                            >
                              <input
                                checked={form.exclusive_group_ids.includes(String(group.id))}
                                onChange={() => toggleExclusiveGroup(group.id)}
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              <span>{group.label || group.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormField>

                  <FormField label="Novo grupo exclusivo">
                    <input
                      value={form.new_exclusive_group_name}
                      onChange={(e) =>
                        handleChangeField("new_exclusive_group_name", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      maxLength={120}
                      placeholder="Ex.: SAP_ZCONF_LOGIN_PADRAO"
                    />
                  </FormField>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Parâmetros do robô
                  </h2>
                </div>
                <div className="px-5 py-5">
                  <p className="mb-4 text-sm text-slate-500">
                    Parâmetros padrão usados quando esta automação for disparada por gatilho de sucesso
                    e não houver parâmetros herdados.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Parâmetros de execução (runtime_parameters_json)
                      </label>
                      <textarea
                        value={form.default_runtime_parameters_json}
                        onChange={(e) =>
                          handleChangeField("default_runtime_parameters_json", e.target.value)
                        }
                        className={`min-h-[120px] w-full border bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900 ${
                          jsonErrors.default_runtime_parameters_json
                            ? "border-red-400"
                            : "border-slate-300"
                        }`}
                        placeholder={'Ex.: { "filial": "001", "safra": "2026" }'}
                        spellCheck={false}
                      />
                      {jsonErrors.default_runtime_parameters_json ? (
                        <p className="mt-1 text-xs text-red-600">
                          {jsonErrors.default_runtime_parameters_json}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Credenciais JSON
                  </h2>
                </div>
                <div className="space-y-3 px-5 py-5">
                  <p className="text-sm text-slate-500">
                    Credenciais padrão (dados_acesso) usadas quando esta automação for disparada por
                    gatilho de sucesso e não houver credenciais herdadas.
                  </p>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={openCredentialsModal}
                      className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <KeyRound className="h-4 w-4" />
                      Usar credenciais
                    </button>
                  </div>
                  <textarea
                    value={form.default_parameters_json}
                    onChange={(e) =>
                      handleChangeField("default_parameters_json", e.target.value)
                    }
                    className={`min-h-[160px] w-full border bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900 ${
                      jsonErrors.default_parameters_json ? "border-red-400" : "border-slate-300"
                    }`}
                    placeholder={'Ex.: { "dados_acesso": { "credential_id": 1, "itens": { "email": null } } }'}
                    spellCheck={false}
                  />
                  {jsonErrors.default_parameters_json ? (
                    <p className="mt-1 text-xs text-red-600">
                      {jsonErrors.default_parameters_json}
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Gatilho de sucesso
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5">
                  <FormField label="Ao finalizar com sucesso, disparar">
                    <div className="min-h-10 border border-slate-300 bg-white px-3 py-2">
                      {triggerAutomationsQuery.isLoading ? (
                        <div className="text-sm text-slate-500">Carregando...</div>
                      ) : triggerAutomationOptions.length === 0 ? (
                        <div className="text-sm text-slate-500">
                          Nenhuma automacao ativa disponivel.
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2">
                          {triggerAutomationOptions.map((automation) => (
                            <label
                              key={automation.id}
                              className="flex items-center gap-3 text-sm text-slate-700"
                            >
                              <input
                                checked={form.success_trigger_automation_ids.includes(
                                  String(automation.id)
                                )}
                                onChange={() =>
                                  toggleSuccessTriggerAutomation(automation.id)
                                }
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300"
                              />
                              <span>
                                {automation.name}
                                {automation.label ? ` - ${automation.label}` : ""}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormField>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  navigate(isEditMode ? `/automations/${automationId}` : "/automations")
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

      {credentialsModalOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/45 px-4 py-6"
          onClick={closeCredentialsModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Usar credenciais no Parameters JSON
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Selecione um repositório, uma credencial e as chaves que deseja injetar no JSON.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCredentialsModal}
                className="inline-flex h-10 w-10 items-center justify-center border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-144px)] space-y-6 overflow-y-auto px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Seleção da credencial
                  </h3>
                </div>
                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Repositório">
                    <select
                      value={selectedRepositoryId ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedRepositoryId(value ? Number(value) : null);
                        setSelectedCredentialId(null);
                        setSelectedKeys([]);
                      }}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      disabled={credentialRepositoriesQuery.isLoading}
                    >
                      <option value="">Selecione</option>
                      {(credentialRepositoriesQuery.data ?? []).map((repo) => (
                        <option key={repo.id} value={repo.id}>
                          {repo.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Credencial">
                    <select
                      value={selectedCredentialId ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSelectedCredentialId(value ? Number(value) : null);
                        setSelectedKeys([]);
                      }}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      disabled={!selectedRepositoryId || credentialsQuery.isLoading}
                    >
                      <option value="">Selecione</option>
                      {(credentialsQuery.data ?? []).map((cred) => (
                        <option key={cred.id} value={cred.id}>
                          {cred.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                {selectedRepositoryName ? (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      <span className="font-medium">Repositório selecionado: </span>
                      {selectedRepositoryName}
                    </div>
                  </div>
                ) : null}
              </section>

              {selectedCredentialId && credentialDetailQuery.isLoading ? (
                <div className="border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
                  Carregando chaves da credencial...
                </div>
              ) : null}

              {selectedCredentialId && credentialDetailQuery.isError ? (
                <div className="border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-700">
                  Erro ao carregar os itens da credencial.
                </div>
              ) : null}

              {credentialDetailQuery.data ? (
                <section className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Chaves disponíveis
                    </h3>
                  </div>
                  <div className="space-y-4 px-5 py-5">
                    <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
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
                              className={`flex cursor-pointer items-start gap-3 border px-4 py-3 transition ${
                                checked
                                  ? "border-slate-950 bg-slate-50"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSelectedKey(item.resolvedKey)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300"
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
                      <div className="border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        Essa credencial não possui chaves válidas para seleção.
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Preview do bloco gerado
                  </h3>
                </div>
                <div className="px-5 py-5">
                  <pre className="min-h-[180px] overflow-x-auto border border-slate-300 bg-slate-950 px-4 py-4 font-mono text-xs text-slate-100">
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
              <button
                type="button"
                onClick={closeCredentialsModal}
                className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGenerateCredentialJson}
                disabled={!selectedRepositoryId || !selectedCredentialId || !selectedKeys.length}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                Gerar JSON
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
