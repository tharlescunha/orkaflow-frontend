import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Save,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getAutomation, listAutomationRunners, listAutomations } from "@/services/api/automations";
import { getCredential, listCredentials } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import { createTask } from "@/services/api/tasks";
import { SearchableSelect } from "@/components/common/searchable-select";
import type { SearchableOption } from "@/components/common/searchable-select";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type RepositoryRead = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

type AutomationRunnerLike = {
  id: number;
  runner_id: number;
  runner_name?: string | null;
  runner_label?: string | null;
  runner_status?: string | null;
  runner_enabled?: boolean | null;
};

type CredentialItemLike = {
  id: number;
  key?: string;
  key_name?: string;
  value_type?: string;
  masked_preview?: string | null;
  active?: boolean;
};

type CredentialRead = {
  id: number;
  label: string;
  repository_id: number;
  repository_name?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

type CredentialWithItemsRead = CredentialRead & {
  items: CredentialItemLike[];
};

type AutomationLike = {
  id: number;
  name: string;
  label?: string | null;
  active?: boolean;
  repository_id?: number | null;
  repository_name?: string | null;
  bot_id?: number | null;
  bot_name?: string | null;
  bot?: {
    id?: number | null;
    name?: string | null;
    repository_id?: number | null;
    repository_name?: string | null;
  } | null;
  default_parameters_json?: Record<string, unknown> | null;
  default_runtime_parameters_json?: Record<string, unknown> | null;
};

type FormState = {
  repository_id: string;
  automation_id: string;
  runner_id: string;
  execute_now: boolean;
  requested_start_at: string;
  priority: string;
  timeout_seconds: string;
  inactivity_timeout_seconds: string;
  use_automation_defaults: boolean;
  runtime_parameters_json: string;
  parameters_json: string;
};

const initialFormState: FormState = {
  repository_id: "",
  automation_id: "",
  runner_id: "",
  execute_now: true,
  requested_start_at: "",
  priority: "5",
  timeout_seconds: "3600",
  inactivity_timeout_seconds: "600",
  use_automation_defaults: true,
  runtime_parameters_json: "",
  parameters_json: "",
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCredentialItemKey(item: CredentialItemLike): string {
  if (typeof item.key === "string" && item.key.trim()) return item.key.trim();
  if (typeof item.key_name === "string" && item.key_name.trim()) {
    return item.key_name.trim();
  }
  return "";
}

function toIsoStringFromLocalDateTime(value: string) {
  if (!value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function resolveAutomationRepositoryId(automation: AutomationLike): number | null {
  if (typeof automation.repository_id === "number") return automation.repository_id;
  if (typeof automation.bot?.repository_id === "number") {
    return automation.bot.repository_id;
  }
  return null;
}

function getRunnerStatusLabel(status?: string | null) {
  if (!status) return "sem status";
  return String(status).toLowerCase();
}

export function TaskCreatePage() {
  const navigate = useNavigate();

  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<FormState>(initialFormState);

  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(
    null
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const selectedAutomationIdNum = Number(form.automation_id) || null;

  const repositoriesQuery = useQuery({
    queryKey: ["task-create-repositories"],
    queryFn: async () => {
      const repositories = await listRepositories({ active: true });
      return repositories as RepositoryRead[];
    },
  });

  const automationsQuery = useQuery({
    queryKey: ["task-create-automations"],
    queryFn: async () => {
      const automations = await listAutomations();
      return automations as AutomationLike[];
    },
  });

  const automationRunnersQuery = useQuery({
    queryKey: ["task-create-automation-runners", selectedAutomationIdNum],
    queryFn: () => listAutomationRunners(selectedAutomationIdNum as number),
    enabled: !!selectedAutomationIdNum,
  });

  const credentialsQuery = useQuery({
    queryKey: ["task-create-credential-list", form.repository_id],
    queryFn: async () => {
      const credentials = await listCredentials({
        repository_id: Number(form.repository_id),
        active: true,
      });
      return credentials as CredentialRead[];
    },
    enabled: credentialsModalOpen && !!form.repository_id,
  });

  const credentialDetailQuery = useQuery({
    queryKey: ["task-create-credential-detail", selectedCredentialId],
    queryFn: async () => {
      const credential = await getCredential(selectedCredentialId as number);
      return credential as CredentialWithItemsRead;
    },
    enabled: credentialsModalOpen && !!selectedCredentialId,
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: (response) => {
      setToast({
        type: "success",
        message: "Task criada com sucesso.",
      });

      setTimeout(() => {
        navigate(`/tasks/${response.task.id}`);
      }, 700);
    },
    onError: (error: unknown) => {
      const axiosDetail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const message = axiosDetail ?? "Não foi possível criar a task.";
      setToast({ type: "error", message });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const automationDetailQuery = useQuery({
    queryKey: ["task-create-automation-detail", selectedAutomationIdNum],
    queryFn: () => getAutomation(selectedAutomationIdNum as number),
    enabled: !!selectedAutomationIdNum,
  });

  const selectedRepositoryId = Number(form.repository_id) || null;

  const filteredAutomations = useMemo(() => {
    // Por padrão só oferece automações ativas (a API devolve todas).
    const automations = (automationsQuery.data ?? []).filter(
      (automation) => automation.active !== false
    );

    if (!selectedRepositoryId) return automations;

    const filtered = automations.filter(
      (automation) =>
        resolveAutomationRepositoryId(automation) === selectedRepositoryId
    );

    return filtered.length ? filtered : automations;
  }, [automationsQuery.data, selectedRepositoryId]);

  const selectedRepositoryName =
    repositoriesQuery.data?.find((repo) => repo.id === selectedRepositoryId)?.name ??
    null;

  const selectedAutomation = (filteredAutomations ?? []).find(
    (item) => item.id === Number(form.automation_id)
  );

  const linkedRunners = (automationRunnersQuery.data ?? []) as AutomationRunnerLike[];

  const selectedRunner = linkedRunners.find(
    (item) => item.runner_id === Number(form.runner_id)
  );

  const availableCredentialItems = (credentialDetailQuery.data?.items ?? [])
    .map((item) => ({
      ...item,
      resolvedKey: getCredentialItemKey(item),
    }))
    .filter((item) => item.resolvedKey);

  const repositoryOptions: SearchableOption<number>[] = (
    repositoriesQuery.data ?? []
  ).map((repository) => ({
    value: repository.id,
    label: repository.name,
    description: repository.description,
  }));

  const automationOptions: SearchableOption<number>[] = filteredAutomations.map(
    (automation) => ({
      value: automation.id,
      label: automation.name,
      description:
        [
          automation.label,
          automation.bot_name ?? automation.bot?.name,
          automation.repository_name ?? automation.bot?.repository_name,
        ]
          .filter(Boolean)
          .join(" · ") || null,
    })
  );

  const runnerOptions: SearchableOption<number>[] = linkedRunners.map((runner) => ({
    value: runner.runner_id,
    label: runner.runner_name ?? `Runner #${runner.runner_id}`,
    description:
      [
        runner.runner_label,
        runner.runner_status,
        runner.runner_enabled === false ? "desabilitado" : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    disabled: runner.runner_enabled === false,
  }));

  const credentialOptions: SearchableOption<number>[] = (
    credentialsQuery.data ?? []
  ).map((credential) => ({
    value: credential.id,
    label: credential.label,
  }));

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function openCredentialsModal() {
    if (!form.repository_id) {
      setToast({
        type: "error",
        message: "Selecione um repositório antes de usar credenciais.",
      });
      return;
    }

    setSelectedCredentialId(null);
    setSelectedKeys([]);
    setCredentialsModalOpen(true);
  }

  function closeCredentialsModal() {
    setCredentialsModalOpen(false);
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

    if (!selectedRepositoryId || !selectedRepositoryName) {
      setToast({
        type: "error",
        message: "Selecione um repositório.",
      });
      return;
    }

    if (!selectedCredentialId || !credential) {
      setToast({
        type: "error",
        message: "Selecione uma credencial.",
      });
      return;
    }

    if (!selectedKeys.length) {
      setToast({
        type: "error",
        message: "Selecione pelo menos uma chave.",
      });
      return;
    }

    const itens: Record<string, string> = {};

    selectedKeys.forEach((key) => {
      itens[key] = `{{credential:${credential.id}:${key}}}`;
    });

    const dadosAcesso = {
      repository_id: selectedRepositoryId,
      repository_name: selectedRepositoryName,
      credential_id: credential.id,
      credential_label: credential.label,
      itens,
    };

    let nextJson: Record<string, unknown> = {
      dados_acesso: dadosAcesso,
    };

    if (form.parameters_json.trim()) {
      try {
        const parsed = JSON.parse(form.parameters_json);

        if (isObjectRecord(parsed)) {
          nextJson = {
            ...parsed,
            dados_acesso: dadosAcesso,
          };
        }
      } catch {
        nextJson = {
          dados_acesso: dadosAcesso,
        };
      }
    }

    handleChange("parameters_json", JSON.stringify(nextJson, null, 2));
    closeCredentialsModal();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.repository_id) {
      setToast({
        type: "error",
        message: "Selecione um repositório.",
      });
      return;
    }

    if (!form.automation_id) {
      setToast({
        type: "error",
        message: "Selecione uma automação.",
      });
      return;
    }

    if (!form.execute_now && !form.requested_start_at) {
      setToast({
        type: "error",
        message: "Informe a data e hora da execução.",
      });
      return;
    }

    const automation = automationDetailQuery.data as AutomationLike | undefined;

    let normalizedJson = "";
    const rawCredentials = form.use_automation_defaults
      ? automation?.default_parameters_json
        ? JSON.stringify(automation.default_parameters_json)
        : ""
      : form.parameters_json.trim();

    if (rawCredentials) {
      try {
        const parsed = JSON.parse(rawCredentials);
        normalizedJson = JSON.stringify(parsed);
      } catch {
        setToast({ type: "error", message: "Credenciais JSON inválidas." });
        return;
      }
    }

    let normalizedRuntimeJson = "";
    const rawRuntime = form.use_automation_defaults
      ? automation?.default_runtime_parameters_json
        ? JSON.stringify(automation.default_runtime_parameters_json)
        : ""
      : form.runtime_parameters_json.trim();

    if (rawRuntime) {
      try {
        const parsed = JSON.parse(rawRuntime);
        if (!isObjectRecord(parsed)) {
          setToast({ type: "error", message: "Parâmetros do robô precisam ser um objeto JSON." });
          return;
        }
        normalizedRuntimeJson = JSON.stringify(parsed);
      } catch {
        setToast({ type: "error", message: "Parâmetros do robô inválidos." });
        return;
      }
    }

    const requestedStartAt = form.execute_now
      ? null
      : toIsoStringFromLocalDateTime(form.requested_start_at);

    if (!form.execute_now && !requestedStartAt) {
      setToast({
        type: "error",
        message: "Data e hora inválidas.",
      });
      return;
    }

    createMutation.mutate({
      automation_id: Number(form.automation_id),
      runner_id: form.runner_id ? Number(form.runner_id) : null,
      priority: Number(form.priority || 5),
      requested_start_at: requestedStartAt,
      timeout_seconds: form.timeout_seconds
        ? Number(form.timeout_seconds)
        : null,
      execution_mode: "manual",
      inactivity_timeout_seconds: form.inactivity_timeout_seconds
        ? Number(form.inactivity_timeout_seconds)
        : null,
      parameters: [
        ...(normalizedRuntimeJson
          ? [
              {
                parameter_name: "runtime_parameters_json",
                parameter_value: normalizedRuntimeJson,
                is_secret: false,
                resolved_from_credential_item_id: null,
              },
            ]
          : []),
        ...(normalizedJson
          ? [
              {
                parameter_name: "parameters_json",
                parameter_value: normalizedJson,
                is_secret: false,
                resolved_from_credential_item_id: null,
              },
            ]
          : []),
      ],
    });
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
        <div className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Nova task</h1>
            <p className="mt-1 text-sm text-slate-500">
              Crie uma execução manual de uma automação, para agora ou agendada.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/tasks")}
            className="inline-flex h-10 items-center gap-2 self-start border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:self-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para tasks
          </button>
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="min-w-0 space-y-5">
          <FormSection
            step={1}
            title="O que executar"
            description="Escolha o repositório e a automação. O runner é opcional."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Repositório"
                htmlFor="task-repository"
                hint="Filtra as automações e as credenciais disponíveis."
                required
              >
                <SearchableSelect<number>
                  id="task-repository"
                  value={form.repository_id ? Number(form.repository_id) : ""}
                  onChange={(value) => {
                    handleChange("repository_id", value === "" ? "" : String(value));
                    handleChange("automation_id", "");
                  }}
                  options={repositoryOptions}
                  placeholder="Selecione o repositório"
                  searchPlaceholder="Buscar repositório..."
                  emptyText="Nenhum repositório ativo encontrado."
                  disabled={repositoriesQuery.isLoading}
                  loading={repositoriesQuery.isLoading}
                  required
                />
              </FormField>

              <FormField
                label="Automação"
                htmlFor="task-automation"
                hint="Somente automações ativas são listadas."
                required
              >
                <SearchableSelect<number>
                  id="task-automation"
                  value={form.automation_id ? Number(form.automation_id) : ""}
                  onChange={(value) => {
                    handleChange("automation_id", value === "" ? "" : String(value));
                    handleChange("runner_id", "");
                  }}
                  options={automationOptions}
                  placeholder="Selecione a automação"
                  searchPlaceholder="Buscar automação, bot ou repositório..."
                  emptyText="Nenhuma automação ativa encontrada."
                  disabled={automationsQuery.isLoading}
                  loading={automationsQuery.isLoading}
                  required
                />
              </FormField>

              <FormField
                label="Runner específico"
                htmlFor="task-runner"
                hint="Opcional. Runners desabilitados aparecem, mas não podem ser escolhidos."
                className="md:col-span-2"
              >
                <SearchableSelect<number>
                  id="task-runner"
                  value={form.runner_id ? Number(form.runner_id) : ""}
                  onChange={(value) =>
                    handleChange("runner_id", value === "" ? "" : String(value))
                  }
                  options={runnerOptions}
                  placeholder="Selecione uma automação primeiro"
                  emptyLabel={form.automation_id ? "Qualquer runner disponível" : undefined}
                  searchPlaceholder="Buscar runner..."
                  emptyText="Nenhum runner vinculado a esta automação."
                  disabled={!form.automation_id || automationRunnersQuery.isLoading}
                  loading={!!form.automation_id && automationRunnersQuery.isLoading}
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            step={2}
            title="Quando e como executar"
            description="Agendamento, prioridade na fila e limites de tempo."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Quando executar
                </span>

                <div className="grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleChange("execute_now", true)}
                    className={`h-10 border px-3 text-sm font-medium transition ${
                      form.execute_now
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Executar agora
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange("execute_now", false)}
                    className={`-ml-px h-10 border px-3 text-sm font-medium transition ${
                      !form.execute_now
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Agendar
                  </button>
                </div>
              </div>

              {!form.execute_now ? (
                <FormField
                  label="Data e hora"
                  htmlFor="task-requested-start"
                  hint="Horário local em que a task fica pronta para execução."
                  required
                >
                  <input
                    id="task-requested-start"
                    value={form.requested_start_at}
                    onChange={(e) =>
                      handleChange("requested_start_at", e.target.value)
                    }
                    className={inputClassName}
                    type="datetime-local"
                    required={!form.execute_now}
                  />
                </FormField>
              ) : (
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Data e hora
                  </span>
                  <div className="flex h-10 w-full items-center border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">
                    Entra na fila assim que for criada
                  </div>
                </div>
              )}

              <FormField
                label="Prioridade"
                htmlFor="task-priority"
                hint="De 1 a 10."
                required
              >
                <input
                  id="task-priority"
                  value={form.priority}
                  onChange={(e) => handleChange("priority", e.target.value)}
                  className={inputClassName}
                  type="number"
                  min={1}
                  max={10}
                  required
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  label="Timeout (s)"
                  htmlFor="task-timeout"
                  hint="Tempo máximo total."
                >
                  <input
                    id="task-timeout"
                    value={form.timeout_seconds}
                    onChange={(e) => handleChange("timeout_seconds", e.target.value)}
                    className={inputClassName}
                    type="number"
                    min={1}
                  />
                </FormField>

                <FormField
                  label="Inatividade (s)"
                  htmlFor="task-inactivity-timeout"
                  hint="Sem atividade por esse tempo."
                >
                  <input
                    id="task-inactivity-timeout"
                    value={form.inactivity_timeout_seconds}
                    onChange={(e) =>
                      handleChange("inactivity_timeout_seconds", e.target.value)
                    }
                    className={inputClassName}
                    type="number"
                    min={1}
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          <FormSection
            step={3}
            title="Dados da execução"
            description={
              form.use_automation_defaults
                ? "Usando os parâmetros e credenciais padrão cadastrados na automação."
                : "Informe manualmente os JSONs enviados ao robô."
            }
            actions={
              <label className="flex cursor-pointer items-center gap-2 border border-slate-300 bg-white px-3 py-2">
                <input
                  type="checkbox"
                  checked={form.use_automation_defaults}
                  onChange={(e) => {
                    handleChange("use_automation_defaults", e.target.checked);
                    if (!e.target.checked) {
                      handleChange("runtime_parameters_json", "");
                      handleChange("parameters_json", "");
                    }
                  }}
                  className="h-4 w-4 border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">
                  Usar dados da automação
                </span>
              </label>
            }
          >
            {form.use_automation_defaults ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="min-w-0">
                  <p className="mb-1.5 text-sm font-medium text-slate-700">
                    Parâmetros do robô
                  </p>
                  <pre className="min-h-[120px] overflow-x-auto border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs text-slate-700">
                    {!form.automation_id
                      ? "Selecione uma automação para ver os parâmetros padrão."
                      : automationDetailQuery.data?.default_runtime_parameters_json
                        ? JSON.stringify(
                            (automationDetailQuery.data as AutomationLike).default_runtime_parameters_json,
                            null,
                            2
                          )
                        : "Nenhum parâmetro padrão cadastrado na automação."}
                  </pre>
                </div>

                <div className="min-w-0">
                  <p className="mb-1.5 text-sm font-medium text-slate-700">
                    Credenciais JSON
                  </p>
                  <pre className="min-h-[120px] overflow-x-auto border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs text-slate-700">
                    {!form.automation_id
                      ? "Selecione uma automação para ver as credenciais padrão."
                      : automationDetailQuery.data?.default_parameters_json
                        ? JSON.stringify(
                            (automationDetailQuery.data as AutomationLike).default_parameters_json,
                            null,
                            2
                          )
                        : "Nenhuma credencial padrão cadastrada na automação."}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <FormField
                  label="Parâmetros do robô"
                  htmlFor="task-runtime-json"
                  hint="Objeto JSON lido pelo robô em tempo de execução."
                >
                  <textarea
                    id="task-runtime-json"
                    value={form.runtime_parameters_json}
                    onChange={(e) => handleChange("runtime_parameters_json", e.target.value)}
                    className="min-h-[120px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder='Ex.: { "filial": "001", "safra": "2026" }'
                  />
                </FormField>

                <div>
                  <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <label
                        htmlFor="task-parameters-json"
                        className="block text-sm font-medium text-slate-700"
                      >
                        Credenciais JSON
                      </label>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Use o botão para inserir referências às credenciais do repositório.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCredentialsModal}
                      className="inline-flex h-9 items-center gap-1.5 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      <KeyRound className="h-4 w-4" />
                      Usar credenciais
                    </button>
                  </div>
                  <textarea
                    id="task-parameters-json"
                    value={form.parameters_json}
                    onChange={(e) => handleChange("parameters_json", e.target.value)}
                    className="min-h-[180px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder='Ex.: { "cliente": "XPTO" }'
                  />
                </div>
              </div>
            )}
          </FormSection>
        </div>

        <aside className="xl:sticky xl:top-4">
          <section className="border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Resumo</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Confira antes de criar a task.
              </p>
            </div>

            <dl className="divide-y divide-slate-100 px-5">
              <SummaryRow label="Repositório" value={selectedRepositoryName} />
              <SummaryRow
                label="Automação"
                value={
                  selectedAutomation
                    ? `${selectedAutomation.name}${
                        selectedAutomation.label ? ` · ${selectedAutomation.label}` : ""
                      }`
                    : null
                }
              />
              <SummaryRow
                label="Runner"
                value={
                  selectedRunner
                    ? `${selectedRunner.runner_name ?? `#${selectedRunner.runner_id}`}${
                        selectedRunner.runner_label ? ` · ${selectedRunner.runner_label}` : ""
                      }${selectedRunner.runner_status ? ` · ${getRunnerStatusLabel(selectedRunner.runner_status)}` : ""}`
                    : "Qualquer runner disponível"
                }
              />
              <SummaryRow
                label="Execução"
                value={
                  form.execute_now
                    ? "Imediata"
                    : form.requested_start_at
                      ? `Agendada · ${form.requested_start_at.replace("T", " ")}`
                      : "Agendada · informe data e hora"
                }
              />
              <SummaryRow label="Prioridade" value={form.priority || "5"} />
              <SummaryRow
                label="Dados"
                value={
                  form.use_automation_defaults
                    ? "Padrão da automação"
                    : "Informados manualmente"
                }
              />
            </dl>

            {!form.runner_id ? (
              <div className="mx-5 mb-4 mt-1 flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  Sem runner específico, a task segue o fluxo normal de despacho e
                  será pega pelo runner elegível.
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={() => navigate("/tasks")}
                className="h-10 flex-1 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {createMutation.isPending ? "Criando..." : "Criar task"}
              </button>
            </div>
          </section>
        </aside>
      </form>

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
                  Selecione uma credencial do repositório e as chaves que deseja
                  injetar no JSON.
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

            <div className="max-h-[calc(90vh-144px)] space-y-5 overflow-y-auto px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Seleção da credencial
                  </h3>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                  <FormField label="Repositório" htmlFor="credential-repository">
                    <input
                      id="credential-repository"
                      value={selectedRepositoryName ?? ""}
                      readOnly
                      title={selectedRepositoryName ?? undefined}
                      className="h-10 w-full truncate border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none"
                    />
                  </FormField>

                  <FormField label="Credencial" htmlFor="credential-select">
                    <SearchableSelect<number>
                      id="credential-select"
                      value={selectedCredentialId ?? ""}
                      onChange={(value) => {
                        setSelectedCredentialId(value === "" ? null : value);
                        setSelectedKeys([]);
                      }}
                      options={credentialOptions}
                      placeholder="Selecione a credencial"
                      searchPlaceholder="Buscar credencial..."
                      emptyText="Nenhuma credencial ativa neste repositório."
                      disabled={!form.repository_id || credentialsQuery.isLoading}
                      loading={credentialsQuery.isLoading}
                    />
                  </FormField>
                </div>
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
                        {selectedRepositoryName ?? "-"}
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
      repository_name: selectedRepositoryName ?? null,
      credential_id: selectedCredentialId ?? null,
      credential_label: credentialDetailQuery.data?.label ?? null,
      itens: Object.fromEntries(
        selectedKeys.map((key) => [
          key,
          selectedCredentialId
            ? `{{credential:${selectedCredentialId}:${key}}}`
            : null,
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
                disabled={!selectedCredentialId || !selectedKeys.length}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
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

const inputClassName =
  "h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900";

function FormSection({
  step,
  title,
  description,
  actions,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-slate-950 text-xs font-semibold text-white">
            {step}
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        {actions}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  required = false,
  className = "",
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`min-w-0 truncate text-right text-sm ${
          value ? "text-slate-900" : "text-slate-400"
        }`}
        title={value ?? undefined}
      >
        {value || "Não selecionado"}
      </dd>
    </div>
  );
}
