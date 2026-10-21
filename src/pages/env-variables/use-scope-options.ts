import { useQuery } from "@tanstack/react-query";
import { listAutomations } from "@/services/api/automations";
import { listBots } from "@/services/api/bots";
import { listRunners } from "@/services/api/runners";
import type { EnvScopeType } from "@/services/api/env-variables";

export type ScopeOption = { id: number; label: string };

export function useScopeOptions() {
  const bots = useQuery({
    queryKey: ["env-scope-bots"],
    queryFn: async () => (await listBots({ limit: 500 })).items,
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
    bot: (bots.data ?? []).map((b) => ({ id: b.id, label: b.name })),
    automation: (automations.data ?? []).map((a) => ({
      id: a.id,
      label: a.label || a.name,
    })),
    runner: (runners.data ?? []).map((r) => ({
      id: r.id,
      label: r.label || r.name,
    })),
  };

  return { byScope };
}
