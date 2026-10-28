import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { GitTokenHint } from "./git-token-hint";
import { QueryError } from "@/components/common/query-error";
import { ExecutionModePicker, type ExecutionMode } from "@/components/common/execution-mode-picker";
import { SearchableSelect } from "@/components/common/searchable-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getBot, updateBot } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";
import type { BotRead, BotUpdatePayload as UpdateBotPayload } from "@/types/bot";


type EditFormState = {
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
  reads_task_file_arg: boolean;
};

type FieldErrors = Partial<Record<keyof EditFormState, string>>;

function formFromBot(bot: BotRead): EditFormState {
  return {
    name: bot.name ?? "",
    description: bot.description ?? "",
    technology: bot.technology ?? "",
    repository_id: String(bot.repository_id ?? ""),
    source_type: bot.source_type ?? "",
    execution_mode: bot.execution_mode === "foreground" ? "foreground" : "background",
    source_url: bot.source_url ?? "",
    entrypoint: bot.entrypoint ?? "",
    requirements_file: bot.requirements_file ?? "",
    timeout_default: String(bot.timeout_default ?? 3600),
    active: Boolean(bot.active),
    auto_update: Boolean(bot.auto_update),
    reads_task_file_arg: bot.reads_task_file_arg ?? true,
  };
}


// Tela: carrega o bot e só monta o formulário quando os dados chegam
// (assim o refetch não sobrescreve o que a pessoa digitou).
export function BotEditPage() {
  const params = useParams();
  const botId = Number(params.botId);

  const botQuery = useQuery({
    queryKey: ["bot-edit", botId],
    queryFn: () => getBot(botId),
    enabled: Number.isFinite(botId),
  });

  const backTo = botId ? `/bots/${botId}` : "/bots";

  if (!Number.isFinite(botId) || botId <= 0) {
    return (
      <div className="space-y-5">
        <section className={card}>
          <PageHeader title="Editar bot" backTo="/bots" backLabel="Voltar para bots" />
          <div className={cardBody}>
            <EmptyState title="ID de bot inválido" description="Confira o endereço e tente de novo." />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo={backTo}
          backLabel="Voltar para o bot"
          title={botQuery.data ? `Editar ${botQuery.data.name}` : "Editar bot"}
          description="Altere o cadastro e a configuração técnica. Tasks já na fila não são afetadas."
        />

        {botQuery.isError ? (
          <div className={cardBody}>
            <QueryError error={botQuery.error} what="o bot" onRetry={() => botQuery.refetch()} retrying={botQuery.isFetching} />
          </div>
        ) : !botQuery.data ? (
          <div className={cardBody}>
            <DetailSkeleton fields={8} />
          </div>
        ) : (
          <BotEditForm key={botQuery.data.id} botId={botId} initial={formFromBot(botQuery.data)} backTo={backTo} />
        )}
      </section>
    </div>
  );
}

function BotEditForm({ botId, initial, backTo }: { botId: number; initial: EditFormState; backTo: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<EditFormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories(true),
  });


  const updateMutation = useMutation({
    mutationFn: (payload: UpdateBotPayload) => updateBot(botId, payload),
    onSuccess: async () => {
      toast.success("Bot atualizado.");

      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await queryClient.invalidateQueries({ queryKey: ["bot-edit", botId] });
      await queryClient.invalidateQueries({ queryKey: ["bot-detail", botId] });

      navigate(`/bots/${botId}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível atualizar o bot."));
    },
  });

  function handleChange<K extends keyof EditFormState>(field: K, value: EditFormState[K]) {
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
    if (!form.repository_id) next.repository_id = "Selecione o repositório.";
    if (!form.technology.trim()) next.technology = "Informe a tecnologia.";
    if (!form.source_type.trim()) next.source_type = "Informe o tipo de origem.";
    if (!form.entrypoint.trim()) next.entrypoint = "Informe o entrypoint.";
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

    const payload: UpdateBotPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      technology: form.technology.trim(),
      repository_id: Number(form.repository_id),
      source_type: form.source_type.trim(),
      execution_mode: form.execution_mode,
      entrypoint: form.entrypoint.trim(),
      requirements_file: form.requirements_file.trim() || null,
      timeout_default: Number(form.timeout_default),
      active: form.active,
      auto_update: form.auto_update,
      reads_task_file_arg: form.reads_task_file_arg,
    };

    // O link vem do servidor com o token escondido (***). Só é enviado se a pessoa trocou por um novo;
    // mandar o mascarado de volta apagaria o token.
    if (form.source_url.trim() !== initial.source_url.trim()) {
      payload.source_url = form.source_url.trim() || null;
    }

    updateMutation.mutate(payload);
  }

  const repositories = repositoriesQuery.data ?? [];
  const isSubmitting = updateMutation.isPending;

  return (
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
                onChange={(e) => handleChange("name", e.target.value)}
                className={input}
                aria-invalid={!!errors.name}
              />
            </FormField>

            <FormField label="Repositório" error={errors.repository_id} asDiv>
              <SearchableSelect<number>
                value={form.repository_id ? Number(form.repository_id) : ""}
                onChange={(value) => handleChange("repository_id", value === "" ? "" : String(value))}
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

            <div className="md:col-span-2">
              <FormField label="Descrição">
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className={textarea}
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
            <FormField label="Tecnologia" error={errors.technology}>
              <input
                value={form.technology}
                onChange={(e) => handleChange("technology", e.target.value)}
                className={input}
                aria-invalid={!!errors.technology}
              />
            </FormField>

            <FormField label="Tipo de origem" error={errors.source_type}>
              <input
                value={form.source_type}
                onChange={(e) => handleChange("source_type", e.target.value)}
                className={input}
                aria-invalid={!!errors.source_type}
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Tipo de execução" hintText="Define como o worker roda o robô. O modo errado faz a automação falhar mesmo com código certo.">
                <ExecutionModePicker value={form.execution_mode} onChange={(mode) => handleChange("execution_mode", mode)} />
              </FormField>
            </div>

            <FormField label="Entrypoint" error={errors.entrypoint}>
              <input
                value={form.entrypoint}
                onChange={(e) => handleChange("entrypoint", e.target.value)}
                className={cn(input, "font-mono")}
                aria-invalid={!!errors.entrypoint}
              />
            </FormField>

            <FormField label="Requirements file">
              <input
                value={form.requirements_file}
                onChange={(e) => handleChange("requirements_file", e.target.value)}
                className={cn(input, "font-mono")}
              />
            </FormField>

            <FormField
              label="URL de origem"
              hintText={
                form.source_url.includes("***@")
                  ? "O token está escondido (***) e continua salvo. Para trocar, apague e cole o link completo com o token novo."
                  : "Pode ser o link limpo (o token vem do ambiente de Git em Configurações) ou com o token dentro; ele nunca aparece na tela."
              }
            >
              <input
                value={form.source_url}
                onChange={(e) => handleChange("source_url", e.target.value)}
                className={cn(input, "font-mono")}
              />
              <GitTokenHint url={form.source_url} />
            </FormField>

            <FormField label="Timeout padrão (segundos)" error={errors.timeout_default} hintText="Tempo máximo de uma execução antes de ser encerrada.">
              <input
                value={form.timeout_default}
                onChange={(e) => handleChange("timeout_default", e.target.value)}
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
                  onChange={(e) => handleChange("active", e.target.checked)}
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Bot ativo
              </label>

              <div>
                <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.auto_update}
                    onChange={(e) => handleChange("auto_update", e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Atualização automática
                </label>
                <p className={cn(hint, "ml-7")}>
                  Quando ativado, o worker faz git pull antes de cada execução e cria uma nova versão automaticamente se detectar código novo.
                </p>
              </div>

              <div>
                <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.reads_task_file_arg}
                    onChange={(e) => handleChange("reads_task_file_arg", e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Robô lê o arquivo da task por argumento (robô antigo)
                </label>
                <p className={cn(hint, "ml-7")}>
                  Marque só se o robô lê o caminho do JSON em sys.argv[1]. Robô com a biblioteca maestro não precisa: o worker chama só python main.py.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 md:px-6">
        <button type="button" onClick={() => navigate(backTo)} className={btn.secondary} disabled={isSubmitting}>
          Cancelar
        </button>

        <button type="submit" disabled={isSubmitting} className={btn.primary}>
          <Save className="h-4 w-4" />
          {isSubmitting ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
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

