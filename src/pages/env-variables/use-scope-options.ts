import { useQuery } from "@tanstack/react-query";
import { listAutomations } from "@/services/api/automations";
import { listAllBots } from "@/services/api/bots";
import { listRunners } from "@/services/api/runners";
import type { EnvScopeType } from "@/services/api/env-variables";

export type ScopeOption = { id: number; label: string; active: boolean };

// Ativos primeiro (em ordem alfabética); inativos continuam na lista, marcados
// e no fim, para que variáveis que apontam para eles sigam exibíveis/filtráveis.
function toOptions(
  items: { id: number; label: string; active: boolean }[],
): ScopeOption[] {
  return items
    .map((i) => ({
      ...i,
      label: i.active ? i.label : `${i.label} (inativo)`,
    }))
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) ||
        a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
    );
}

export function useScopeOptions() {
  const bots = useQuery({
    queryKey: ["env-scope-bots"],
    queryFn: async () => (await listAllBots()).items,
  });
  const automations = useQuery({
    queryKey: ["env-scope-automations"],
    queryFn: () => listAutomations(),
  });
  const runners = useQuery({
    queryKey: ["env-scope-runners"],
    queryFn: () => listRunners(),
  });

  const byScope: Record<EnvScopeType, ScopeOption[]> = {
    global: [],
    bot: toOptions(
      (bots.data ?? []).map((b) => ({
        id: b.id,
        label: b.name,
        active: b.active,
      })),
    ),
    automation: toOptions(
      (automations.data ?? []).map((a) => ({
        id: a.id,
        label: a.label || a.name,
        active: a.active,
      })),
    ),
    runner: toOptions(
      (runners.data ?? []).map((r) => ({
        id: r.id,
        label: r.label || r.name,
        active: r.enabled,
      })),
    ),
  };

  const loading: Record<EnvScopeType, boolean> = {
    global: false,
    bot: bots.isLoading,
    automation: automations.isLoading,
    runner: runners.isLoading,
  };

  return { byScope, loading };
}
