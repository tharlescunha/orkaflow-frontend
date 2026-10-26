import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Variable } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/query-error";
import { SearchableSelect } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { hint, label as labelClass, table } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getEffectiveEnvVariables } from "@/services/api/env-variables";
import { ScopeBadge } from "./scope-badge";
import { SCOPE_LABELS } from "./scope-labels";
import { SecretMask } from "./variables-table";
import { useScopeOptions } from "./use-scope-options";

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
      <div className="border-b border-slate-200 bg-slate-50/60 px-5 py-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Automação (obrigatório)</label>
            <SearchableSelect<number>
              value={automationId}
              onChange={setAutomationId}
              options={byScope.automation.map((o) => ({ value: o.id, label: o.label }))}
              placeholder="Selecione..."
              loading={loading.automation}
            />
          </div>
          <div>
            <label className={labelClass}>Máquina (opcional)</label>
            <SearchableSelect<number>
              value={runnerId}
              onChange={setRunnerId}
              options={byScope.runner.map((o) => ({ value: o.id, label: o.label }))}
              placeholder="Nenhuma"
              emptyLabel="Nenhuma"
              loading={loading.runner}
            />
          </div>
        </div>
        <p className={cn(hint, "mt-3")}>
          É exatamente o que o robô recebe no ambiente quando essa automação roda nessa máquina. Valores secretos
          ficam mascarados.
        </p>
      </div>

      {automationId === "" ? (
        <EmptyState
          icon={Variable}
          title="Escolha uma automação"
          description="Selecione a automação (e, se quiser, a máquina) para ver as variáveis que o robô recebe."
        />
      ) : query.isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : query.isError ? (
        <div className="p-5">
          <QueryError
            error={query.error}
            what="as variáveis finais"
            onRetry={() => query.refetch()}
            retrying={query.isFetching}
          />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Variable}
          title="Nenhuma variável se aplica"
          description="Nenhuma variável ativa alcança essa combinação de automação e máquina."
        />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Nome</th>
                <th className={table.th}>Valor</th>
                <th className={table.th}>Origem</th>
                <th className={table.th}>Sobrescreveu</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.name} className={table.tr}>
                  <td className={cn(table.tdStrong, "font-mono")}>{item.name}</td>
                  <td className={table.td}>
                    {item.is_secret ? (
                      <SecretMask />
                    ) : (
                      <span className={cn(table.truncate, "max-w-[320px] font-mono")} title={item.value ?? ""}>
                        {item.value || <span className="text-slate-400">(vazio)</span>}
                      </span>
                    )}
                  </td>
                  <td className={table.td}>
                    <ScopeBadge type={item.scope_type} label={item.scope_label} />
                  </td>
                  <td className={table.tdMuted}>
                    {item.overrides.length > 0
                      ? `sobrescreveu: ${item.overrides.map((o) => SCOPE_LABELS[o.scope_type]).join(", ")}`
                      : "---"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
