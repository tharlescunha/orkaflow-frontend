import type { EnvScopeType, EnvVariableRead } from "@/services/api/env-variables";
import { normalizeSearch } from "@/lib/search";

export type VariableGroup = {
  key: string;
  scopeType: EnvScopeType;
  scopeId: number;
  label: string;
  variables: EnvVariableRead[];
};

// Automação primeiro (o mais comum), depois bot, máquina e global.
const SCOPE_ORDER: Record<EnvScopeType, number> = { automation: 0, bot: 1, runner: 2, global: 3 };

export function groupVariables(items: EnvVariableRead[]): VariableGroup[] {
  const groups = new Map<string, VariableGroup>();
  for (const item of items) {
    const key = `${item.scope_type}:${item.scope_id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        scopeType: item.scope_type,
        scopeId: item.scope_id,
        label: item.scope_type === "global" ? "Global" : item.scope_label,
        variables: [],
      };
      groups.set(key, group);
    }
    group.variables.push(item);
  }
  return [...groups.values()].sort(
    (a, b) =>
      SCOPE_ORDER[a.scopeType] - SCOPE_ORDER[b.scopeType] ||
      a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }),
  );
}

// Grupo aparece se o nome do alvo bate com a busca ou se alguma variável dele bate.
export function matchGroup(group: VariableGroup, search: string): { visible: boolean; byVariable: string[] } {
  const q = normalizeSearch(search);
  if (!q) return { visible: true, byVariable: [] };
  const byVariable = group.variables.map((v) => v.name).filter((name) => normalizeSearch(name).includes(q));
  return { visible: normalizeSearch(group.label).includes(q) || byVariable.length > 0, byVariable };
}
