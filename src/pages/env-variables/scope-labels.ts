import type { EnvScopeType } from "@/services/api/env-variables";

export const SCOPE_LABELS: Record<EnvScopeType, string> = {
  global: "Global",
  bot: "Bot",
  automation: "Automação",
  runner: "Máquina",
};
