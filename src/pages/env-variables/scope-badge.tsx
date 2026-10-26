import { badge, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { EnvScopeType } from "@/services/api/env-variables";
import { SCOPE_LABELS } from "./scope-labels";

// Cada escopo com a sua cor: bot azul, automação violeta, máquina âmbar, global neutro.
const STYLES: Record<EnvScopeType, string> = {
  global: tone.neutral,
  bot: tone.info,
  automation: "border-violet-200 bg-violet-50 text-violet-700",
  runner: tone.warning,
};

export function ScopeBadge({ type, label }: { type: EnvScopeType; label?: string }) {
  return (
    <span className={cn(badge, "max-w-full", STYLES[type])}>
      <span className="shrink-0">{SCOPE_LABELS[type]}</span>
      {type !== "global" && label ? (
        <span className="truncate font-normal" title={label}>
          · {label}
        </span>
      ) : null}
    </span>
  );
}
