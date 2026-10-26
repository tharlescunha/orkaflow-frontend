import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Server } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getRunner, updateRunnerConfig, type RunnerRead, type UpdateRunnerConfigPayload } from "@/services/api/runners";
import { toast } from "@/store/toast-store";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label, textarea, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

const MAX_CONCURRENCY_LIMIT = 5;

type RunnerConfigFormState = {
  max_concurrency: string;
  polling_interval: string;
  auto_update_bots: boolean;
  install_all_bots_on_register: boolean;
  maintenance_mode: boolean;
  allowed_parallel_bots: string;
};

type FormErrors = Partial<Record<keyof RunnerConfigFormState, string>>;

function buildInitialForm(runner: RunnerRead): RunnerConfigFormState {
  const config = runner.config;
  return {
    max_concurrency: String(config?.max_concurrency ?? 1),
    polling_interval: String(config?.polling_interval ?? 15),
    auto_update_bots: Boolean(config?.auto_update_bots ?? true),
    install_all_bots_on_register: Boolean(config?.install_all_bots_on_register),
    maintenance_mode: Boolean(config?.maintenance_mode),
    allowed_parallel_bots: config?.allowed_parallel_bots ? JSON.stringify(config.allowed_parallel_bots, null, 2) : "",
  };
}

export function RunnerConfigEditPage() {
  const params = useParams<{ runnerId: string }>();
  const runnerId = Number(params.runnerId);
  const isValidRunnerId = Number.isFinite(runnerId) && runnerId > 0;

  const runnerQuery = useQuery({
    queryKey: ["runner-config-edit", runnerId],
    queryFn: () => getRunner(runnerId),
    enabled: isValidRunnerId,
  });

  if (!isValidRunnerId) {
    return (
      <section className={card}>
        <PageHeader title="Editar configuração" backTo="/runner-configs" backLabel="Voltar para runners" />
        <div className={cardBody}>
          <EmptyState icon={Server} title="Runner inválido" description="O endereço não aponta para um runner existente." />
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title={runnerQuery.data ? `Editar ${runnerQuery.data.name}` : "Editar configuração"}
          description="Só a configuração operacional pode ser alterada; os dados da máquina vêm do próprio worker."
          backTo={`/runner-configs/${runnerId}`}
          backLabel="Voltar para detalhes"
          meta={
            runnerQuery.data ? (
              <span className={cn(badge, runnerQuery.data.enabled ? tone.success : tone.neutral)}>
                {runnerQuery.data.enabled ? "Ativo" : "Inativo"}
              </span>
            ) : null
          }
        />

        {runnerQuery.isLoading ? (
          <div className={cardBody}>
            <DetailSkeleton fields={6} />
          </div>
        ) : runnerQuery.isError || !runnerQuery.data ? (
          <div className={cardBody}>
            <QueryError
              error={runnerQuery.error}
              what="os dados do runner"
              onRetry={() => runnerQuery.refetch()}
              retrying={runnerQuery.isFetching}
            />
          </div>
        ) : (
          // O formulário só nasce com os dados em mãos: nada de re-hidratar por efeito depois.
          <RunnerConfigForm key={runnerQuery.data.id} runner={runnerQuery.data} />
        )}
      </section>
    </div>
  );
}

function RunnerConfigForm({ runner }: { runner: RunnerRead }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RunnerConfigFormState>(() => buildInitialForm(runner));
  const [errors, setErrors] = useState<FormErrors>({});

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRunnerConfigPayload) => updateRunnerConfig(runner.id, payload),
    onSuccess: () => {
      toast.success("Configuração salva.");
      queryClient.invalidateQueries({ queryKey: ["runner-config-edit", runner.id] });
      queryClient.invalidateQueries({ queryKey: ["runner", runner.id] });
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      queryClient.invalidateQueries({ queryKey: ["runners-page"] });
      navigate(`/runner-configs/${runner.id}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível salvar a configuração.", error));
    },
  });

  function handleChangeField<K extends keyof RunnerConfigFormState>(field: K, value: RunnerConfigFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validate(): { payload: UpdateRunnerConfigPayload | null; errors: FormErrors } {
    const nextErrors: FormErrors = {};

    let parsedAllowedParallelBots: Record<string, unknown> | unknown[] | null = null;
    if (form.allowed_parallel_bots.trim()) {
      try {
        parsedAllowedParallelBots = JSON.parse(form.allowed_parallel_bots);
      } catch {
        nextErrors.allowed_parallel_bots = "Precisa ser um JSON válido.";
      }
    }

    const maxConcurrency = Number(form.max_concurrency);
    if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1 || maxConcurrency > MAX_CONCURRENCY_LIMIT) {
      nextErrors.max_concurrency = `Informe um número inteiro entre 1 e ${MAX_CONCURRENCY_LIMIT}.`;
    }

    const pollingInterval = Number(form.polling_interval);
    if (!Number.isInteger(pollingInterval) || pollingInterval < 5) {
      nextErrors.polling_interval = "Informe um número inteiro de pelo menos 5 segundos.";
    }

    if (Object.keys(nextErrors).length > 0) {
      return { payload: null, errors: nextErrors };
    }

    return {
      errors: {},
      payload: {
        max_concurrency: maxConcurrency,
        polling_interval: pollingInterval,
        auto_update_bots: form.auto_update_bots,
        install_all_bots_on_register: form.install_all_bots_on_register,
        maintenance_mode: form.maintenance_mode,
        allowed_parallel_bots: parsedAllowedParallelBots,
      },
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validate();
    setErrors(result.errors);
    if (!result.payload) return;
    updateMutation.mutate(result.payload);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="space-y-6 px-5 py-5">
        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Runner</h2>
          </div>
          <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
            <ReadOnlyField label="Nome" value={runner.name} />
            <ReadOnlyField label="Label" value={runner.label || EMPTY} />
            <ReadOnlyField label="Host" value={runner.host_name || EMPTY} />
            <ReadOnlyField label="Status" value={runner.status || EMPTY} />
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Configuração</h2>
          </div>

          <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
            <div>
              <label htmlFor="max_concurrency" className={label}>
                Bots em background simultâneos
              </label>
              <input
                id="max_concurrency"
                value={form.max_concurrency}
                onChange={(e) => handleChangeField("max_concurrency", e.target.value)}
                className={input}
                type="number"
                min={1}
                max={MAX_CONCURRENCY_LIMIT}
                step={1}
                required
                aria-invalid={Boolean(errors.max_concurrency)}
              />
              {errors.max_concurrency ? (
                <p className={fieldError}>{errors.max_concurrency}</p>
              ) : (
                <p className={hint}>De 1 a {MAX_CONCURRENCY_LIMIT}. Além desses, o runner executa sempre 1 bot em foreground por vez.</p>
              )}
            </div>

            <div>
              <label htmlFor="polling_interval" className={label}>
                Intervalo de polling (segundos)
              </label>
              <input
                id="polling_interval"
                value={form.polling_interval}
                onChange={(e) => handleChangeField("polling_interval", e.target.value)}
                className={input}
                type="number"
                min={5}
                step={1}
                required
                aria-invalid={Boolean(errors.polling_interval)}
              />
              {errors.polling_interval ? (
                <p className={fieldError}>{errors.polling_interval}</p>
              ) : (
                <p className={hint}>De quanto em quanto tempo o worker pergunta se há task nova.</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="allowed_parallel_bots" className={label}>
                Bots permitidos em paralelo (JSON)
              </label>
              <textarea
                id="allowed_parallel_bots"
                value={form.allowed_parallel_bots}
                onChange={(e) => handleChangeField("allowed_parallel_bots", e.target.value)}
                className={cn(textarea, "min-h-[160px] font-mono")}
                placeholder='Ex.: {"sap": 1, "web": 2}'
                aria-invalid={Boolean(errors.allowed_parallel_bots)}
              />
              {errors.allowed_parallel_bots ? (
                <p className={fieldError}>{errors.allowed_parallel_bots}</p>
              ) : (
                <p className={hint}>Deixe em branco para não limitar por bot.</p>
              )}
            </div>

            <div className="grid gap-3 md:col-span-2">
              <CheckboxField
                checked={form.auto_update_bots}
                onChange={(value) => handleChangeField("auto_update_bots", value)}
                label="Atualizar bots automaticamente"
                description="O worker baixa a versão nova do bot antes de executar."
              />
              <CheckboxField
                checked={form.install_all_bots_on_register}
                onChange={(value) => handleChangeField("install_all_bots_on_register", value)}
                label="Instalar todos os bots ao registrar"
                description="Ao configurar a máquina, já baixa todos os bots vinculados."
              />
              <CheckboxField
                checked={form.maintenance_mode}
                onChange={(value) => handleChangeField("maintenance_mode", value)}
                label="Modo manutenção"
                description="O runner não recebe tasks novas enquanto estiver ligado."
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
        <button type="button" onClick={() => navigate(`/runner-configs/${runner.id}`)} className={btn.secondary}>
          Cancelar
        </button>

        <button type="submit" disabled={updateMutation.isPending} className={btn.primary} title="Ctrl+S">
          <Save className="h-4 w-4" />
          {updateMutation.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function CheckboxField({
  checked,
  onChange,
  label: text,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50">
      <input
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>
        <span className="block font-medium text-slate-900">{text}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}

function ReadOnlyField({ label: text, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className={label}>{text}</span>
      <div className="flex min-h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">{value}</div>
    </div>
  );
}
