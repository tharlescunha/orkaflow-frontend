import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getEffectiveEnvVariables } from "@/services/api/env-variables";
import { ScopeBadge } from "./scope-badge";
import { SCOPE_LABELS } from "./scope-labels";
import { SecretMask } from "./variables-table";
import { useScopeOptions } from "./use-scope-options";

const th =
  "border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";

export function EffectiveTab() {
  const { byScope, loading } = useScopeOptions();
  const [automationId, setAutomationId] = useState<number | "">("");
  const [runnerId, setRunnerId] = useState<number | "">("");

  const query = useQuery({
    queryKey: ["env-variables-effective", automationId, runnerId],
    queryFn: () =>
      getEffectiveEnvVariables({
        automation_id: Number(automationId),
        runner_id: runnerId === "" ? undefined : Number(runnerId),
      }),
    enabled: automationId !== "",
    meta: { toast: true },
  });

  const items = query.data ?? [];

  return (
    <div>
      <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Automação (obrigatório)
            </label>
            <SearchableSelect<number>
              value={automationId}
              onChange={setAutomationId}
              options={byScope.automation.map((o) => ({
                value: o.id,
                label: o.label,
              }))}
              placeholder="Selecione..."
              loading={loading.automation}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Máquina (opcional)
            </label>
            <SearchableSelect<number>
              value={runnerId}
              onChange={setRunnerId}
              options={byScope.runner.map((o) => ({
                value: o.id,
                label: o.label,
              }))}
              placeholder="Nenhuma"
              emptyLabel="Nenhuma"
              loading={loading.runner}
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          É exatamente o que o robô recebe no ambiente quando essa automação
          roda nessa máquina.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-slate-100">
            <tr>
              <th className={th}>Nome</th>
              <th className={th}>Valor</th>
              <th className={th}>Origem</th>
              <th className={th}>Sobrescreveu</th>
            </tr>
          </thead>
          <tbody>
            {automationId === "" ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  Selecione uma automação para ver as variáveis finais.
                </td>
              </tr>
            ) : query.isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  Carregando...
                </td>
              </tr>
            ) : query.isError ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-red-600"
                >
                  Não foi possível calcular as variáveis finais.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  Nenhuma variável ativa se aplica a esta combinação.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.name}
                  className="border-b border-slate-200 hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900">
                    {item.name}
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-sm text-slate-700">
                    {item.is_secret ? (
                      <SecretMask />
                    ) : (
                      <span
                        className="block truncate font-mono"
                        title={item.value ?? ""}
                      >
                        {item.value || (
                          <span className="text-slate-400">(vazio)</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ScopeBadge
                      type={item.scope_type}
                      label={item.scope_label}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {item.overrides.length > 0
                      ? `sobrescreveu: ${item.overrides
                          .map((o) => SCOPE_LABELS[o.scope_type])
                          .join(", ")}`
                      : "---"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
