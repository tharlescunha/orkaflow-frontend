import { useEffect, useState } from "react";
import { withApiDetail } from "@/lib/api-error";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "@/store/toast-store";

import {
  getRunner,
  updateRunnerConfig,
  type UpdateRunnerConfigPayload,
} from "@/services/api/runners";

const MAX_CONCURRENCY_LIMIT = 5;

type RunnerConfigFormState = {
  max_concurrency: string;
  polling_interval: string;
  auto_update_bots: boolean;
  install_all_bots_on_register: boolean;
  maintenance_mode: boolean;
  allowed_parallel_bots: string;
};

export function RunnerConfigEditPage() {
  const navigate = useNavigate();
  const params = useParams<{ runnerId: string }>();

  const runnerId = Number(params.runnerId);

  const [form, setForm] = useState<RunnerConfigFormState>({
    max_concurrency: "1",
    polling_interval: "15",
    auto_update_bots: true,
    install_all_bots_on_register: false,
    maintenance_mode: false,
    allowed_parallel_bots: "",
  });

  const runnerQuery = useQuery({
    queryKey: ["runner-config-edit", runnerId],
    queryFn: () => getRunner(runnerId),
    enabled: Number.isFinite(runnerId) && runnerId > 0,
  });

  useEffect(() => {
    const data = runnerQuery.data;
    if (!data?.config) return;

    setForm({
      max_concurrency: String(data.config.max_concurrency ?? 1),
      polling_interval: String(data.config.polling_interval ?? 15),
      auto_update_bots: Boolean(data.config.auto_update_bots),
      install_all_bots_on_register: Boolean(data.config.install_all_bots_on_register),
      maintenance_mode: Boolean(data.config.maintenance_mode),
      allowed_parallel_bots: data.config.allowed_parallel_bots
        ? JSON.stringify(data.config.allowed_parallel_bots, null, 2)
        : "",
    });
  }, [runnerQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateRunnerConfigPayload) =>
      updateRunnerConfig(runnerId, payload),
    onSuccess: () => {
      toast.success("Configuração atualizada com sucesso.");

      setTimeout(() => {
        navigate(`/runner-configs/${runnerId}`);
      }, 800);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar a configuração.", error));
    },
  });

  function handleChangeField<K extends keyof RunnerConfigFormState>(
    field: K,
    value: RunnerConfigFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let parsedAllowedParallelBots: Record<string, unknown> | unknown[] | null = null;

    if (form.allowed_parallel_bots.trim()) {
      try {
        parsedAllowedParallelBots = JSON.parse(form.allowed_parallel_bots);
      } catch {
        toast.error("allowed_parallel_bots precisa ser um JSON válido.");
        return;
      }
    }

    const maxConcurrency = Number(form.max_concurrency);
    if (
      !Number.isInteger(maxConcurrency) ||
      maxConcurrency < 1 ||
      maxConcurrency > MAX_CONCURRENCY_LIMIT
    ) {
      toast.error(
        `Bots em background simultâneos deve ser um número inteiro entre 1 e ${MAX_CONCURRENCY_LIMIT}.`
      );
      return;
    }

    const payload: UpdateRunnerConfigPayload = {
      max_concurrency: maxConcurrency,
      polling_interval: Number(form.polling_interval),
      auto_update_bots: form.auto_update_bots,
      install_all_bots_on_register: form.install_all_bots_on_register,
      maintenance_mode: form.maintenance_mode,
      allowed_parallel_bots: parsedAllowedParallelBots,
    };

    updateMutation.mutate(payload);
  }

  if (!Number.isFinite(runnerId) || runnerId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de runner inválido.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate(`/runner-configs/${runnerId}`)}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para detalhes
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Editar Runner Config
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Apenas os campos de configuração operacional podem ser alterados.
              </p>
            </div>
          </div>
        </div>

        {runnerQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-500">Carregando runner...</div>
        ) : runnerQuery.isError || !runnerQuery.data ? (
          <div className="px-6 py-10 text-sm text-red-600">
            Não foi possível carregar os dados do runner.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Runner
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <ReadOnlyField label="Nome" value={runnerQuery.data.name} />
                  <ReadOnlyField label="Label" value={runnerQuery.data.label || "---"} />
                  <ReadOnlyField label="Status" value={runnerQuery.data.status} />
                  <ReadOnlyField label="Ativo" value={runnerQuery.data.enabled ? "Sim" : "Não"} />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Configuração
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Bots em background simultâneos (máx. 5; foreground sempre 1)">
                    <input
                      value={form.max_concurrency}
                      onChange={(e) => handleChangeField("max_concurrency", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="number"
                      min={1}
                      max={MAX_CONCURRENCY_LIMIT}
                      step={1}
                      required
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Valor de 1 a 5 (campo max_concurrency). Além dos bots em background,
                      o runner executa sempre 1 bot em foreground por vez.
                    </p>
                  </FormField>

                  <FormField label="Polling interval (segundos)">
                    <input
                      value={form.polling_interval}
                      onChange={(e) => handleChangeField("polling_interval", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="number"
                      min={5}
                      required
                    />
                  </FormField>

                  <div className="md:col-span-2">
                    <FormField label="Allowed parallel bots (JSON)">
                      <textarea
                        value={form.allowed_parallel_bots}
                        onChange={(e) =>
                          handleChangeField("allowed_parallel_bots", e.target.value)
                        }
                        className="min-h-[180px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                        placeholder='Ex.: {"sap": 1, "web": 2}'
                      />
                    </FormField>
                  </div>

                  <div className="md:col-span-2 grid gap-4">
                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.auto_update_bots}
                        onChange={(e) => handleChangeField("auto_update_bots", e.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Atualizar bots automaticamente
                    </label>

                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.install_all_bots_on_register}
                        onChange={(e) =>
                          handleChangeField("install_all_bots_on_register", e.target.checked)
                        }
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Instalar todos os bots ao registrar
                    </label>

                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.maintenance_mode}
                        onChange={(e) =>
                          handleChangeField("maintenance_mode", e.target.checked)
                        }
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Modo manutenção
                    </label>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => navigate(`/runner-configs/${runnerId}`)}
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
                {updateMutation.isPending ? "Salvando..." : "Salvar"}
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
    <label className="block text-slate-900">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex min-h-10 items-center border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
        {value}
      </div>
    </div>
  );
}
