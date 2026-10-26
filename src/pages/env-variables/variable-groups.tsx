import { ChevronRight, FileUp, Lock, Plus, Variable } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/query-error";
import { TableSkeleton } from "@/components/common/skeleton";
import { btn, focusRing } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { matchGroup, type VariableGroup } from "./group-utils";
import { ScopeBadge } from "./scope-badge";

export function VariableGroups({
  groups,
  search,
  loading,
  error,
  onRetry,
  retrying,
  hasActiveFilters,
  onClearFilters,
  onNew,
  onImport,
  onOpen,
}: {
  groups: VariableGroup[];
  search: string;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onNew: () => void;
  onImport: () => void;
  onOpen: (group: VariableGroup) => void;
}) {
  if (loading) return <TableSkeleton rows={5} columns={4} />;

  if (error) {
    return (
      <div className="p-5">
        <QueryError error={error} what="as variáveis" onRetry={onRetry} retrying={retrying} />
      </div>
    );
  }

  const rows = groups.map((group) => ({ group, ...matchGroup(group, search) })).filter((r) => r.visible);

  if (rows.length === 0) {
    return hasActiveFilters ? (
      <EmptyState
        icon={Variable}
        title="Nenhum alvo com esses filtros"
        description="Nenhuma automação, bot ou máquina bate com a busca ou o escopo escolhido."
        action={
          <button type="button" onClick={onClearFilters} className={btn.secondary}>
            Limpar filtros
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={Variable}
        title="Nenhuma variável cadastrada ainda"
        description="Cadastre uma por uma ou importe um arquivo .env inteiro para uma automação, bot ou máquina."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onImport} className={btn.secondary}>
              <FileUp className="h-4 w-4" />
              Importar .env
            </button>
            <button type="button" onClick={onNew} className={btn.primary}>
              <Plus className="h-4 w-4" />
              Nova variável
            </button>
          </div>
        }
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map(({ group, byVariable }) => {
        const secrets = group.variables.filter((v) => v.is_secret).length;
        return (
          <li key={group.key}>
            <button
              type="button"
              onClick={() => onOpen(group)}
              className={cn(
                "flex w-full items-center gap-4 px-5 py-3 text-left transition hover:bg-blue-50/40",
                focusRing,
                "focus-visible:ring-inset focus-visible:ring-offset-0"
              )}
            >
              <span className="w-28 shrink-0">
                <ScopeBadge type={group.scopeType} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900" title={group.label}>
                  {group.label}
                </span>
                {byVariable.length > 0 && (
                  <span className="block truncate font-mono text-xs text-slate-500">
                    contém: {byVariable.slice(0, 4).join(", ")}
                    {byVariable.length > 4 ? ` e mais ${byVariable.length - 4}` : ""}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-slate-600">
                {group.variables.length} variáve{group.variables.length === 1 ? "l" : "is"}
                {secrets > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500">
                    <Lock className="h-3 w-3" />
                    {secrets} secreta{secrets === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
