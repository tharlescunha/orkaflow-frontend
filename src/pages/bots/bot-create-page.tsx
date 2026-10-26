import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Monitor, Save, Server } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { badge, btn, card, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, select, textarea, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { createBot } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";
import type { BotCreatePayload as CreateBotPayload } from "@/types/bot";

type ExecutionMode = "background" | "foreground";

type CreateBotFormState = {
  initial_version: string;
  name: string;
  description: string;
  technology: string;
  repository_id: string;
  source_type: string;
  execution_mode: ExecutionMode;
  source_url: string;
  entrypoint: string;
  requirements_file: string;
  timeout_default: string;
  active: boolean;
  auto_update: boolean;
};

type FieldErrors = Partial<Record<keyof CreateBotFormState, string>>;

const initialFormState: CreateBotFormState = {
  initial_version: "1.0.0",
  name: "",
  description: "",
  technology: "python",
  repository_id: "",
  source_type: "git",
  execution_mode: "background",
  source_url: "",
  entrypoint: "main.py",
  requirements_file: "requirements.txt",
  timeout_default: "600",
  active: true,
  auto_update: false,
};

function getExecutionModeContent(mode: ExecutionMode) {
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
      panelClassName: "border-emerald-200 bg-emerald-50/50",
      alertClassName: "border-red-200 bg-red-50 text-red-800",
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
    panelClassName: "border-amber-200 bg-amber-50/50",
    alertClassName: "border-amber-200 bg-amber-50 text-amber-800",
  };
}

export function BotCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateBotFormState>(initialFormState);
  const [errors, setErrors] = useState<FieldErrors>({});

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories(true),
  });

  const executionModeContent = useMemo(
    () => getExecutionModeContent(form.execution_mode),
    [form.execution_mode]
  );

  const createMutation = useMutation({
    mutationFn: (payload: CreateBotPayload) => createBot(payload),
    onSuccess: (data) => {
      toast.success(`Bot "${data.name}" cadastrado.`);
      navigate("/bots");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível cadastrar o bot."));
    },
  });

  function handleChangeField<K extends keyof CreateBotFormState>(
    field: K,
    value: CreateBotFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = "Informe o nome.";
    if (!form.initial_version.trim()) next.initial_version = "Informe a versão inicial (ex.: 1.0.0).";
    if (!form.repository_id) next.repository_id = "Selecione o repositório.";
    if (!form.technology.trim()) next.technology = "Informe a tecnologia.";
    if (!form.source_type.trim()) next.source_type = "Informe o tipo de origem.";
    if (!form.source_url.trim()) next.source_url = "Informe a URL de origem.";
    if (!form.entrypoint.trim()) next.entrypoint = "Informe o entrypoint.";
    if (!form.requirements_file.trim()) next.requirements_file = "Informe o arquivo de requirements.";
    const timeout = Number(form.timeout_default);
    if (!Number.isInteger(timeout) || timeout < 1) next.timeout_default = "Use um número inteiro maior que zero.";
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload: CreateBotPayload = {
      initial_version: form.initial_version.trim(),
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

    createMutation.mutate(payload);
  }

  const repositories = repositoriesQuery.data ?? [];
  const ExecutionModeIcon = executionModeContent.icon;
  const isSubmitting = createMutation.isPending;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/bots"
          backLabel="Voltar para bots"
          title="Novo bot"
          description="Informe onde está o código, como ele roda e o tempo limite padrão."
        />

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-6 px-5 py-5 md:px-6">
            <section className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Dados principais</h2>
              </div>

              <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                <FormField label="Nome" error={errors.name}>
                  <input
                    value={form.name}
                    onChange={(e) => handleChangeField("name", e.target.value)}
                    className={input}
                    placeholder="Nome do bot"
                    aria-invalid={!!errors.name}
                  />
                </FormField>

                <FormField label="Versão inicial" error={errors.initial_version} hintText="Primeira versão registrada para o bot.">
                  <input
                    value={form.initial_version}
                    onChange={(e) => handleChangeField("initial_version", e.target.value)}
                    className={cn(input, "font-mono")}
                    placeholder="1.0.0"
                    aria-invalid={!!errors.initial_version}
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Descrição">
                    <textarea
                      value={form.description}
                      onChange={(e) => handleChangeField("description", e.target.value)}
                      className={cn(textarea, "min-h-[110px]")}
                      placeholder="Descrição do bot"
                      maxLength={500}
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <section className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Configuração</h2>
              </div>

              <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                <FormField label="Repositório" error={errors.repository_id} asDiv>
                  <SearchableSelect<number>
                    value={form.repository_id ? Number(form.repository_id) : ""}
                    onChange={(value) => handleChangeField("repository_id", value === "" ? "" : String(value))}
                    options={repositories.map((repository) => ({
                      value: repository.id,
                      label: repository.name,
                    }))}
                    placeholder="Selecione"
                    searchPlaceholder="Buscar repositório..."
                    required
                    disabled={repositoriesQuery.isLoading}
                    loading={repositoriesQuery.isLoading}
                  />
                </FormField>

                <FormField label="Tecnologia" error={errors.technology}>
                  <input
                    value={form.technology}
                    onChange={(e) => handleChangeField("technology", e.target.value)}
                    className={input}
                    placeholder="python"
                    aria-invalid={!!errors.technology}
                  />
                </FormField>

                <FormField label="Tipo de origem" error={errors.source_type}>
                  <input
                    value={form.source_type}
                    onChange={(e) => handleChangeField("source_type", e.target.value)}
                    className={input}
                    placeholder="git"
                    aria-invalid={!!errors.source_type}
                  />
                </FormField>

                <FormField label="Tipo de execução">
                  <select
                    value={form.execution_mode}
                    onChange={(e) => handleChangeField("execution_mode", e.target.value as ExecutionMode)}
                    className={select}
                  >
                    <option value="background">Background</option>
                    <option value="foreground">Foreground</option>
                  </select>
                </FormField>

                <div className="md:col-span-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Escolha corretamente o tipo de execução</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      Essa configuração define como o worker vai executar o bot. Selecionar o modo errado pode fazer a
                      automação falhar, mesmo com código correto.
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ExecutionModeOptionCard
                      title="Background"
                      description="Para bots que executam sem depender de tela, interface gráfica ou interação visual."
                      active={form.execution_mode === "background"}
                      badgeClassName={tone.success}
                      onClick={() => handleChangeField("execution_mode", "background")}
                    />

                    <ExecutionModeOptionCard
                      title="Foreground"
                      description="Para bots que precisam abrir sistema, clicar, digitar, focar janela ou interagir com a área de trabalho."
                      active={form.execution_mode === "foreground"}
                      badgeClassName={tone.warning}
                      onClick={() => handleChangeField("execution_mode", "foreground")}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className={cn("flex gap-3 rounded-lg border px-4 py-4 text-sm text-slate-700", executionModeContent.panelClassName)}>
                    <ExecutionModeIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">{executionModeContent.title}</p>
                      <p className="mt-1 leading-6 text-slate-700">{executionModeContent.description}</p>
                      <p className="mt-3 leading-6 text-slate-700">{executionModeContent.importance}</p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className={cn("flex gap-3 rounded-lg border px-4 py-3", executionModeContent.alertClassName)}>
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="text-sm leading-6">
                      <span className="font-semibold">Atenção: </span>
                      {executionModeContent.warning}
                    </div>
                  </div>
                </div>

                <FormField label="Entrypoint" error={errors.entrypoint}>
                  <input
                    value={form.entrypoint}
                    onChange={(e) => handleChangeField("entrypoint", e.target.value)}
                    className={cn(input, "font-mono")}
                    placeholder="main.py"
                    aria-invalid={!!errors.entrypoint}
                  />
                </FormField>

                <FormField label="Requirements file" error={errors.requirements_file}>
                  <input
                    value={form.requirements_file}
                    onChange={(e) => handleChangeField("requirements_file", e.target.value)}
                    className={cn(input, "font-mono")}
                    placeholder="requirements.txt"
                    aria-invalid={!!errors.requirements_file}
                  />
                </FormField>

                <FormField label="Timeout padrão (segundos)" error={errors.timeout_default} hintText="Tempo máximo de uma execução antes de ser encerrada.">
                  <input
                    value={form.timeout_default}
                    onChange={(e) => handleChangeField("timeout_default", e.target.value)}
                    className={input}
                    type="number"
                    min={1}
                    aria-invalid={!!errors.timeout_default}
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="URL de origem" error={errors.source_url}>
                    <input
                      value={form.source_url}
                      onChange={(e) => handleChangeField("source_url", e.target.value)}
                      className={cn(input, "font-mono")}
                      placeholder="https://..."
                      aria-invalid={!!errors.source_url}
                    />
                  </FormField>
                </div>

                <div className="flex flex-col gap-4 md:col-span-2">
                  <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                    <input
                      checked={form.active}
                      onChange={(e) => handleChangeField("active", e.target.checked)}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Bot ativo
                  </label>

                  <div>
                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.auto_update}
                        onChange={(e) => handleChangeField("auto_update", e.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      Atualização automática
                    </label>
                    <p className={cn(hint, "ml-7")}>
                      Quando ativado, o worker faz git pull antes de cada execução e cria uma nova versão automaticamente se detectar código novo.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 md:px-6">
            <button type="button" onClick={() => navigate("/bots")} className={btn.secondary} disabled={isSubmitting}>
              Cancelar
            </button>

            <button type="submit" disabled={isSubmitting} className={btn.primary}>
              <Save className="h-4 w-4" />
              {isSubmitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

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
      aria-pressed={active}
      className={cn(
        "w-full rounded-lg border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        active ? "border-blue-500 bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{description}</p>
        </div>

        <span className={cn(badge, "shrink-0", active ? badgeClassName : tone.neutral)}>
          {active ? "Selecionado" : "Opção"}
        </span>
      </div>
    </button>
  );
}
