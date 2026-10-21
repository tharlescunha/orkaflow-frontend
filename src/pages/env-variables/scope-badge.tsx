import type { EnvScopeType } from "@/services/api/env-variables";
import { SCOPE_LABELS } from "./scope-labels";

const STYLES: Record<EnvScopeType, string> = {
  global: "border-slate-300 bg-slate-100 text-slate-700",
  bot: "border-blue-200 bg-blue-50 text-blue-700",
  automation: "border-violet-200 bg-violet-50 text-violet-700",
  runner: "border-amber-200 bg-amber-50 text-amber-700",
};

export function ScopeBadge({
  type,
  label,
}: {
  type: EnvScopeType;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 border px-2 py-0.5 text-xs font-medium ${STYLES[type]}`}
    >
      <span className="shrink-0">{SCOPE_LABELS[type]}</span>
      {type !== "global" && label ? (
        <span className="truncate font-normal" title={label}>
          · {label}
        </span>
      ) : null}
    </span>
  );
}
