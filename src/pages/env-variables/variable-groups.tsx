import { ChevronRight, Lock } from "lucide-react";
import { matchGroup, type VariableGroup } from "./group-utils";
import { ScopeBadge } from "./scope-badge";

export function VariableGroups({
  groups,
  search,
  loading,
  error,
  onOpen,
}: {
  groups: VariableGroup[];
  search: string;
  loading: boolean;
  error: boolean;
  onOpen: (group: VariableGroup) => void;
}) {
  if (loading) return <p className="px-6 py-12 text-center text-sm text-slate-500">Carregando variáveis...</p>;
  if (error) return <p className="px-6 py-12 text-center text-sm text-red-600">Não foi possível carregar as variáveis.</p>;

  const rows = groups.map((group) => ({ group, ...matchGroup(group, search) })).filter((r) => r.visible);

  if (rows.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-slate-500">
        {search
          ? "Nenhum bot, automação ou máquina encontrado com essa busca."
          : 'Nenhuma variável cadastrada ainda. Use "Nova variável" ou "Importar .env".'}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-200">
      {rows.map(({ group, byVariable }) => {
        const secrets = group.variables.filter((v) => v.is_secret).length;
        return (
          <li key={group.key}>
            <button
              type="button"
              onClick={() => onOpen(group)}
              className="flex w-full items-center gap-4 px-6 py-3 text-left transition hover:bg-slate-50"
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
