import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Monitor,
  Save,
  Server,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { getBot, updateBot } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import type { UpdateBotPayload } from "@/types/bot";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type EditFormState = {
  name: string;
  description: string;
  technology: string;
  repository_id: string;
  source_type: string;
  execution_mode: "background" | "foreground";
  source_url: string;
  entrypoint: string;
  requirements_file: string;
  timeout_default: string;
  active: boolean;
  auto_update: boolean;
};

const initialFormState: EditFormState = {
  name: "",
  description: "",
  technology: "",
  repository_id: "",
  source_type: "",
  execution_mode: "background",
  source_url: "",
  entrypoint: "",
  requirements_file: "",
  timeout_default: "600",
  active: true,
  auto_update: false,
};

function getExecutionModeContent(mode: "background" | "foreground") {
  if (mode === "background") {
    return {
      title: "Execução em background",
      description:
        "O bot executa em segundo plano, sem depender de interação visual com a tela do usuário. É indicado para rotinas de API, processamento interno, integrações, leitura e escrita de arquivos, banco de dados e execuções silenciosas no worker.",
      importance:
        "Selecione background apenas para bots que realmente não precisam abrir sistema, clicar, digitar, focar janela ou interagir com desktop.",
      warning:
        "Se o bot precisa de tela, janela ativa, sessão logada ou interação visual, ele não vai funcionar corretamente em background.",
      icon: Server,
      badgeClassName:
        "border border-emerald-200 bg-emerald-50 text-emerald-700",
      panelClassName: "border border-emerald-200 bg-emerald-50/50",
      alertClassName: "border border-red-200 bg-red-50 text-red-800",
    };
  }

  return {
    title: "Execução em foreground",
    description:
      "O bot executa com interação na área de trabalho da máquina. É indicado para automações RPA que precisam abrir aplicações locais, usar clique, digitação, foco de janela, leitura visual, sessão do usuário e operação em tela.",
    importance:
      "Selecione foreground para bots que dependem de interface gráfica ou qualquer interação visual com o sistema operacional ou com aplicativos instalados na máquina.",
    warning:
      "Esse modo deve ser usado quando o bot precisa acessar tela. Escolher foreground corretamente evita falhas de execução em bots que dependem da interface do usuário.",
    icon: Monitor,
    badgeClassName: "border border-amber-200 bg-amber-50 text-amber-700",
    panelClassName: "border border-amber-200 bg-amber-50/50",
    alertClassName: "border border-amber-200 bg-amber-50 text-amber-800",
  };
}

export function BotEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const botId = Number(params.botId);

  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<EditFormState>(initialFormState);

  const botQuery = useQuery({
    queryKey: ["bot-edit", botId],
    queryFn: () => getBot(botId),
    enabled: Number.isFinite(botId),
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories(true),
  });

  const executionModeContent = useMemo(
    () => getExecutionModeContent(form.execution_mode),
    [form.execution_mode]
  );

  useEffect(() => {
    if (!botQuery.data) return;

    setForm({
      name: botQuery.data.name ?? "",
      description: botQuery.data.description ?? "",
      technology: botQuery.data.technology ?? "",
      repository_id: String(botQuery.data.repository_id ?? ""),
      source_type: botQuery.data.source_type ?? "",
      execution_mode:
        botQuery.data.execution_mode === "foreground"
          ? "foreground"
          : "background",
      source_url: botQuery.data.source_url ?? "",
      entrypoint: botQuery.data.entrypoint ?? "",
      requirements_file: botQuery.data.requirements_file ?? "",
      timeout_default: String(botQuery.data.timeout_default ?? 3600),
      active: Boolean(botQuery.data.active),
      auto_update: Boolean(botQuery.data.auto_update),
    });
  }, [botQuery.data]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateBotPayload) => updateBot(botId, payload),
    onSuccess: async () => {
      setToast({
        type: "success",
        message: "Bot atualizado com sucesso.",
      });

      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.invalidateQueries({ queryKey: ["bot-edit", botId] });
      await queryClient.invalidateQueries({ queryKey: ["bot-detail", botId] });

      setTimeout(() => {
        navigate(`/bots/${botId}`);
      }, 900);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível atualizar o bot.",
      });
    },
  });

  function handleChange<K extends keyof EditFormState>(
    field: K,
    value: EditFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: UpdateBotPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      technology: form.technology.trim(),
      repository_id: Number(form.repository_id),
      source_type: form.source_type.trim(),
      execution_mode: form.execution_mode,
      source_url: form.source_url.trim() || null,
      entrypoint: form.entrypoint.trim(),
      requirements_file: form.requirements_file.trim() || null,
      timeout_default: Number(form.timeout_default),
      active: form.active,
      auto_update: form.auto_update,
    };

    updateMutation.mutate(payload);
  }

  const repositories = repositoriesQuery.data ?? [];
  const ExecutionModeIcon = executionModeContent.icon;

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
                onClick={() => navigate(botId ? `/bots/${botId}` : "/bots")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Editar Bot
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Atualização cadastral e técnica do bot.
              </p>
            </div>
          </div>
        </div>

        {botQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            Carregando bot...
          </div>
        ) : botQuery.isError ? (
          <div className="px-6 py-10 text-sm text-red-600">
            Erro ao carregar bot.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Dados principais
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Nome">
                    <input
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    />
                  </FormField>

                  <FormField label="Repositório">
                    <select
                      value={form.repository_id}
                      onChange={(e) =>
                        handleChange("repository_id", e.target.value)
                      }
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
                    <FormField label="Descrição">
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          handleChange("description", e.target.value)
                        }
                        className="min-h-[120px] w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        maxLength={500}
                      />
                    </FormField>
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Configuração
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Tecnologia">
                    <input
                      value={form.technology}
                      onChange={(e) =>
                        handleChange("technology", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    />
                  </FormField>

                  <FormField label="Tipo de origem">
                    <input
                      value={form.source_type}
                      onChange={(e) =>
                        handleChange("source_type", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    />
                  </FormField>

                  <FormField label="Tipo de execução">
                    <select
                      value={form.execution_mode}
                      onChange={(e) =>
                        handleChange(
                          "execution_mode",
                          e.target.value as "background" | "foreground"
                        )
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    >
                      <option value="background">Background</option>
                      <option value="foreground">Foreground</option>
                    </select>
                  </FormField>

                  <div className="md:col-span-2">
                    <div className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Escolha corretamente o tipo de execução
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        Essa configuração define como o worker vai executar o
                        bot. Selecionar o modo errado pode fazer a automação
                        falhar, mesmo com código correto.
                      </p>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      <ExecutionModeOptionCard
                        title="Background"
                        description="Para bots que executam sem depender de tela, interface gráfica ou interação visual."
                        active={form.execution_mode === "background"}
                        badgeClassName="border border-emerald-200 bg-emerald-50 text-emerald-700"
                        onClick={() =>
                          handleChange("execution_mode", "background")
                        }
                      />

                      <ExecutionModeOptionCard
                        title="Foreground"
                        description="Para bots que precisam abrir sistema, clicar, digitar, focar janela ou interagir com a área de trabalho."
                        active={form.execution_mode === "foreground"}
                        badgeClassName="border border-amber-200 bg-amber-50 text-amber-700"
                        onClick={() =>
                          handleChange("execution_mode", "foreground")
                        }
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div
                      className={`flex gap-3 px-4 py-4 text-sm text-slate-700 ${executionModeContent.panelClassName}`}
                    >
                      <ExecutionModeIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold text-slate-900">
                          {executionModeContent.title}
                        </p>
                        <p className="mt-1 leading-6 text-slate-700">
                          {executionModeContent.description}
                        </p>
                        <p className="mt-3 leading-6 text-slate-700">
                          {executionModeContent.importance}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div
                      className={`flex gap-3 border px-4 py-3 ${executionModeContent.alertClassName}`}
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="text-sm leading-6">
                        <span className="font-semibold">Atenção: </span>
                        {executionModeContent.warning}
                      </div>
                    </div>
                  </div>

                  <FormField label="Entrypoint">
                    <input
                      value={form.entrypoint}
                      onChange={(e) =>
                        handleChange("entrypoint", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                    />
                  </FormField>

                  <FormField label="Requirements file">
                    <input
                      value={form.requirements_file}
                      onChange={(e) =>
                        handleChange("requirements_file", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    />
                  </FormField>

                  <FormField label="URL de origem">
                    <input
                      value={form.source_url}
                      onChange={(e) =>
                        handleChange("source_url", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    />
                  </FormField>

                  <FormField label="Timeout padrão (segundos)">
                    <input
                      value={form.timeout_default}
                      onChange={(e) =>
                        handleChange("timeout_default", e.target.value)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="number"
                      min={1}
                      required
                    />
                  </FormField>

                  <div className="md:col-span-2 flex flex-col gap-4">
                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.active}
                        onChange={(e) =>
                          handleChange("active", e.target.checked)
                        }
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Bot ativo
                    </label>

                    <div>
                      <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                        <input
                          checked={form.auto_update}
                          onChange={(e) =>
                            handleChange("auto_update", e.target.checked)
                          }
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Atualização automática
                      </label>
                      <p className="mt-1 ml-7 text-xs text-slate-500">
                        Quando ativado, o worker faz git pull antes de cada execução e cria uma nova versão automaticamente se detectar código novo.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => navigate(botId ? `/bots/${botId}` : "/bots")}
                className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
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
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function ExecutionModeOptionCard({
  title,
  description,
  active,
  badgeClassName,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  badgeClassName: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full border px-4 py-4 text-left transition ${
        active
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {description}
          </p>
        </div>

        <span
          className={`inline-flex shrink-0 items-center rounded-sm px-2.5 py-1 text-xs font-semibold ${badgeClassName}`}
        >
          {active ? "Selecionado" : "Opção"}
        </span>
      </div>
    </button>
  );
}
