import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, GitCommitHorizontal, Loader2, RefreshCcw, Save, Tag } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { ExecutionModePicker, type ExecutionMode } from "@/components/common/execution-mode-picker";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { btn, card, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { createBot, inspectBotSource } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";
import type { BotCreatePayload as CreateBotPayload, BotSourceInspection } from "@/types/bot";

// Tecnologia e tipo de origem não aparecem na tela: hoje é sempre Python vindo do Git.
const DEFAULT_TECHNOLOGY = "python";
const DEFAULT_SOURCE_TYPE = "git";

type CreateBotFormState = {
  source_url: string;
  initial_version: string;
  name: string;
  description: string;
  repository_id: string;
  execution_mode: ExecutionMode;
  entrypoint: string;
  requirements_file: string;
  timeout_default: string;
  active: boolean;
  auto_update: boolean;
};

type FieldErrors = Partial<Record<keyof CreateBotFormState, string>>;

const initialFormState: CreateBotFormState = {
  source_url: "",
  initial_version: "1.0.0",
  name: "",
  description: "",
  repository_id: "",
  execution_mode: "background",
  entrypoint: "main.py",
  requirements_file: "requirements.txt",
  timeout_default: "600",
  active: true,
  auto_update: false,
};

/**
 * Novo bot: primeiro o link do Git. "Sincronizar" confere se o link funciona (o mesmo clone que o
 * worker vai fazer) e preenche nome, descrição (README) e versão (última tag). Só então o resto
 * do formulário é liberado. Se o link mudar depois, precisa sincronizar de novo antes de salvar.
 */
export function BotCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateBotFormState>(initialFormState);
  const [errors, setErrors] = useState<FieldErrors>({});
  // Resultado da última sincronização e a URL que ela validou.
  const [inspection, setInspection] = useState<BotSourceInspection | null>(null);
  const [inspectedUrl, setInspectedUrl] = useState("");
  const [inspectError, setInspectError] = useState<string | null>(null);

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories(true),
  });

  const inspectMutation = useMutation({
    mutationFn: (url: string) => inspectBotSource(url),
    onSuccess: (info, url) => {
      setInspection(info);
      setInspectedUrl(url);
      setInspectError(null);
      setForm((prev) => ({
        ...prev,
        // Preenche o que veio do Git sem apagar o que a pessoa já digitou por cima.
        name: prev.name.trim() ? prev.name : info.name,
        description: prev.description.trim() ? prev.description : (info.description ?? ""),
        initial_version: info.latest_tag ? info.suggested_version : prev.initial_version,
      }));
      setErrors((prev) => ({ ...prev, source_url: undefined, name: undefined, initial_version: undefined }));
    },
    onError: (error) => {
      setInspection(null);
      setInspectedUrl("");
      setInspectError(getApiErrorMessage(error, "Não foi possível ler o repositório."));
    },
  });

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

  const trimmedUrl = form.source_url.trim();
  const synced = inspection !== null && inspectedUrl === trimmedUrl;
  const isInspecting = inspectMutation.isPending;
  const isSubmitting = createMutation.isPending;
  // Campos do bot ficam "apagados" até o link ser validado.
  const locked = !synced;

  function handleChangeField<K extends keyof CreateBotFormState>(field: K, value: CreateBotFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleInspect() {
    if (!trimmedUrl) {
      setErrors((prev) => ({ ...prev, source_url: "Informe o link do repositório." }));
      return;
    }
    setInspectError(null);
    inspectMutation.mutate(trimmedUrl);
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!trimmedUrl) next.source_url = "Informe o link do repositório.";
    else if (!synced) next.source_url = "Sincronize o link antes de salvar.";
    if (!form.name.trim()) next.name = "Informe o nome.";
    if (!form.initial_version.trim()) next.initial_version = "Informe a versão inicial (ex.: 1.0.0).";
    if (!form.repository_id) next.repository_id = "Selecione o repositório.";
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

    createMutation.mutate({
      initial_version: form.initial_version.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      technology: DEFAULT_TECHNOLOGY,
      repository_id: Number(form.repository_id),
      source_type: DEFAULT_SOURCE_TYPE,
      execution_mode: form.execution_mode,
      source_url: trimmedUrl,
      entrypoint: form.entrypoint.trim(),
      requirements_file: form.requirements_file.trim() || null,
      timeout_default: Number(form.timeout_default),
      active: form.active,
      auto_update: form.auto_update,
    });
  }

  const repositories = repositoriesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/bots"
          backLabel="Voltar para bots"
          title="Novo bot"
          description="Cole o link do Git e sincronize: o painel confere o acesso e preenche nome, descrição e versão. Depois ajuste o resto."
        />

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-6 px-5 py-5 md:px-6">
            {/* 1. Link do Git */}
            <section className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>1. Onde está o código</h2>
                {synced && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Link validado
                  </span>
                )}
              </div>

              <div className="space-y-4 px-5 py-5">
                <FormField
                  label="Link do repositório Git"
                  error={errors.source_url}
                  hintText="O mesmo clone que a máquina vai fazer. Se tiver token, ele fica dentro do link e nunca aparece na tela."
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={form.source_url}
                      onChange={(e) => handleChangeField("source_url", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleInspect();
                        }
                      }}
                      className={cn(input, "font-mono")}
                      placeholder="https://github.com/empresa/bot-exemplo.git"
                      aria-invalid={!!errors.source_url}
                      autoFocus
                      disabled={isInspecting}
                    />
                    <button
                      type="button"
                      onClick={handleInspect}
                      disabled={isInspecting || !trimmedUrl}
                      className={cn(synced ? btn.secondary : btn.primary, "shrink-0 sm:w-44")}
                    >
                      {isInspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      {isInspecting ? "Lendo o Git..." : synced ? "Sincronizar de novo" : "Sincronizar"}
                    </button>
                  </div>
                </FormField>

                {inspectError && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {inspectError}
                  </div>
                )}

                {inspection && !synced && !isInspecting && (
                  <p className="text-xs text-amber-700">O link mudou depois da última sincronização. Sincronize de novo antes de salvar.</p>
                )}

                {synced && inspection && (
                  <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-slate-700 sm:grid-cols-3">
                    <div className="flex items-start gap-2">
                      <GitCommitHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Último commit · {inspection.branch}</p>
                        <p className="truncate" title={inspection.head.message}>
                          <span className="font-mono text-xs text-slate-500">{inspection.head.short}</span> {inspection.head.message}
                        </p>
                        <p className="text-xs text-slate-500">
                          {inspection.head.author} · {formatDateTime(inspection.head.committed_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Tag className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Última tag</p>
                        <p className="font-mono">{inspection.latest_tag ?? "nenhuma"}</p>
                        {!inspection.latest_tag && <p className="text-xs text-slate-500">A versão inicial fica 1.0.0.</p>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Repositório</p>
                      <p className="truncate font-mono text-xs" title={inspection.repository}>
                        {inspection.repository}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 2. Dados do bot (liberados depois da sincronização) */}
            <fieldset disabled={locked || isSubmitting} className={cn("space-y-6 transition-opacity", locked && "opacity-50")}>
              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>2. Dados principais</h2>
                  {locked && <span className="text-xs text-slate-500">Sincronize o link para liberar</span>}
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Nome" error={errors.name} hintText="Veio do nome do repositório; pode trocar.">
                    <input
                      value={form.name}
                      onChange={(e) => handleChangeField("name", e.target.value)}
                      className={input}
                      placeholder="Nome do bot"
                      aria-invalid={!!errors.name}
                    />
                  </FormField>

                  <FormField
                    label="Versão inicial"
                    error={errors.initial_version}
                    hintText={inspection?.latest_tag ? `Veio da tag ${inspection.latest_tag} do Git.` : "Primeira versão registrada para o bot."}
                  >
                    <input
                      value={form.initial_version}
                      onChange={(e) => handleChangeField("initial_version", e.target.value)}
                      className={cn(input, "font-mono")}
                      placeholder="1.0.0"
                      aria-invalid={!!errors.initial_version}
                    />
                  </FormField>

                  <div className="md:col-span-2">
                    <FormField label="Descrição" hintText="Veio do README do repositório; pode trocar.">
                      <textarea
                        value={form.description}
                        onChange={(e) => handleChangeField("description", e.target.value)}
                        className={cn(textarea, "min-h-[90px]")}
                        placeholder="O que o robô faz"
                        maxLength={500}
                      />
                    </FormField>
                  </div>
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>3. Configuração</h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <div className="md:col-span-2">
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
                        disabled={locked || repositoriesQuery.isLoading}
                        loading={repositoriesQuery.isLoading}
                      />
                    </FormField>
                  </div>

                  <div className="md:col-span-2">
                    <FormField label="Tipo de execução" hintText="Define como o worker roda o robô. O modo errado faz a automação falhar mesmo com código certo.">
                      <ExecutionModePicker value={form.execution_mode} onChange={(mode) => handleChangeField("execution_mode", mode)} />
                    </FormField>
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
            </fieldset>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 md:px-6">
            {locked && <span className="mr-auto text-xs text-slate-500">Para salvar, sincronize o link do repositório.</span>}
            <button type="button" onClick={() => navigate("/bots")} className={btn.secondary} disabled={isSubmitting}>
              Cancelar
            </button>

            <button type="submit" disabled={isSubmitting || locked} className={btn.primary}>
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
