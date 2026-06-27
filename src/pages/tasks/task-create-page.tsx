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
    const automations = automationsQuery.data ?? [];

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
    <div className="space-y-4">
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
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Nova Task</h1>
              <p className="mt-1 text-sm text-slate-500">
                Criação manual de task para execução imediata ou agendada.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6 py-5">
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Dados principais
                </h2>
              </div>

              <div className="grid gap-4 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
                <FormField label="Repositório">
                  <select
                    value={form.repository_id}
                    onChange={(e) => {
                      handleChange("repository_id", e.target.value);
                      handleChange("automation_id", "");
                    }}
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    disabled={repositoriesQuery.isLoading}
                    required
                  >
                    <option value="">Selecione</option>
                    {(repositoriesQuery.data ?? []).map((repository) => (
                      <option key={repository.id} value={repository.id}>
                        {repository.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Automação">
                  <select
                    value={form.automation_id}
                    onChange={(e) => {
                      handleChange("automation_id", e.target.value);
                      handleChange("runner_id", "");
                    }}
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    disabled={automationsQuery.isLoading}
                    required
                  >
                    <option value="">Selecione</option>
                    {filteredAutomations.map((automation) => (
                      <option key={automation.id} value={automation.id}>
                        {automation.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Runner específico">
                  <select
                    value={form.runner_id}
                    onChange={(e) => handleChange("runner_id", e.target.value)}
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400"
                    disabled={!form.automation_id || automationRunnersQuery.isLoading}
                  >
                    <option value="">
                      {!form.automation_id
                        ? "Selecione uma automação primeiro"
                        : "Qualquer runner disponível"}
                    </option>
                    {linkedRunners.map((runner) => (
                      <option key={runner.runner_id} value={runner.runner_id}>
                        {runner.runner_name ?? `Runner #${runner.runner_id}`}
                        {runner.runner_label ? ` · ${runner.runner_label}` : ""}
                        {runner.runner_status ? ` · ${runner.runner_status}` : ""}
                        {runner.runner_enabled === false ? " · desabilitado" : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Prioridade">
                  <input
                    value={form.priority}
                    onChange={(e) => handleChange("priority", e.target.value)}
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    type="number"
                    min={1}
                    max={10}
                    required
                  />
                </FormField>
              </div>

              <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="xl:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Quando executar
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleChange("execute_now", true)}
                      className={`h-9 border px-3 text-sm font-medium transition ${
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
                      className={`h-9 border px-3 text-sm font-medium transition ${
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
                  <FormField label="Data e hora">
                    <input
                      value={form.requested_start_at}
                      onChange={(e) =>
                        handleChange("requested_start_at", e.target.value)
                      }
                      className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="datetime-local"
                      required={!form.execute_now}
                    />
                  </FormField>
                ) : (
                  <div className="flex items-end">
                    <div className="flex h-9 w-full items-center border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-400">
                      Execução imediata
                    </div>
                  </div>
                )}

                <FormField label="Timeout (segundos)">
                  <input
                    value={form.timeout_seconds}
                    onChange={(e) => handleChange("timeout_seconds", e.target.value)}
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    type="number"
                    min={1}
                  />
                </FormField>

                <FormField label="Timeout inatividade">
                  <input
                    value={form.inactivity_timeout_seconds}
                    onChange={(e) =>
                      handleChange("inactivity_timeout_seconds", e.target.value)
                    }
                    className="h-9 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    type="number"
                    min={1}
                  />
                </FormField>
              </div>

              <div className="grid gap-4 border-t border-slate-200 px-4 py-4">
                <div>
                  <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      Se não selecionar runner, a task ficará disponível para o
                      fluxo normal de despacho e será pega pelo runner elegível.
                    </div>
                  </div>
                </div>
              </div>

              {(selectedRepositoryName || selectedAutomation || selectedRunner) && (
                <div className="grid gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 md:grid-cols-3">
                  <MiniInfo
                    label="Repositório"
                    value={selectedRepositoryName || "-"}
                  />

                  <MiniInfo
                    label="Automação"
                    value={
                      selectedAutomation
                        ? `${selectedAutomation.name}${
                            selectedAutomation.label
                              ? ` · ${selectedAutomation.label}`
                              : ""
                          }`
                        : "-"
                    }
                  />

                  <MiniInfo
                    label="Runner"
                    value={
                      selectedRunner
                        ? `${selectedRunner.runner_name ?? `#${selectedRunner.runner_id}`}${
                            selectedRunner.runner_label ? ` · ${selectedRunner.runner_label}` : ""
                          }${selectedRunner.runner_status ? ` · ${getRunnerStatusLabel(selectedRunner.runner_status)}` : ""}`
                        : "Qualquer runner disponível"
                    }
                  />
                </div>
              )}
            </section>

            <section className="border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Dados da execução
                </h2>

                <label className="flex cursor-pointer items-center gap-2">
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
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Usar dados da automação
                  </span>
                </label>
              </div>

              {form.use_automation_defaults ? (
                <div className="space-y-4 px-4 py-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Parâmetros do robô
                    </p>
                    <pre className="min-h-[80px] border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs text-slate-700">
                      {automationDetailQuery.data?.default_runtime_parameters_json
                        ? JSON.stringify(
                            (automationDetailQuery.data as AutomationLike).default_runtime_parameters_json,
                            null,
                            2
                          )
                        : "Nenhum parâmetro padrão cadastrado na automação."}
                    </pre>
                  </div>

                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Credenciais JSON
                    </p>
                    <pre className="min-h-[80px] border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-xs text-slate-700">
                      {automationDetailQuery.data?.default_parameters_json
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
                <div className="space-y-4 px-4 py-4">
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Parâmetros do robô
                    </p>
                    <textarea
                      value={form.runtime_parameters_json}
                      onChange={(e) => handleChange("runtime_parameters_json", e.target.value)}
                      className="min-h-[120px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder='Ex.: { "filial": "001", "safra": "2026" }'
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Credenciais JSON
                      </p>
                      <button
                        type="button"
                        onClick={openCredentialsModal}
                        className="inline-flex h-7 items-center gap-1.5 border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        <KeyRound className="h-3 w-3" />
                        Usar credenciais
                      </button>
                    </div>
                    <textarea
                      value={form.parameters_json}
                      onChange={(e) => handleChange("parameters_json", e.target.value)}
                      className="min-h-[180px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder='Ex.: { "cliente": "XPTO" }'
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="h-9 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex h-9 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Criando..." : "Criar task"}
            </button>
          </div>
        </form>
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
                  <FormField label="Repositório">
                    <input
                      value={selectedRepositoryName ?? ""}
                      readOnly
                      className="h-10 w-full border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none"
                    />
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
                      disabled={!form.repository_id || credentialsQuery.isLoading}
                    >
                      <option value="">Selecione</option>
                      {(credentialsQuery.data ?? []).map((credential) => (
                        <option key={credential.id} value={credential.id}>
                          {credential.label}
                        </option>
                      ))}
                    </select>
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

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function MiniInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm text-slate-900" title={value}>
        {value}
      </p>
    </div>
  );
}
