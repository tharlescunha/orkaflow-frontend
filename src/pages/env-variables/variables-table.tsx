import { Lock, Pencil, Trash2 } from "lucide-react";
import type { EnvVariableRead } from "@/services/api/env-variables";
import { ScopeBadge } from "./scope-badge";

const th =
  "border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600";

function formatDate(value?: string | null) {
  if (!value) return "---";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SecretMask() {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <Lock className="h-3.5 w-3.5" />
      <span>••••••••</span>
    </span>
  );
}

type Props = {
  items: EnvVariableRead[];
  loading: boolean;
  error: boolean;
  onEdit: (item: EnvVariableRead) => void;
  onDelete: (item: EnvVariableRead) => void;
  // Dentro de um alvo (bot, automação ou máquina) a coluna Escopo repetiria o mesmo valor.
  hideScope?: boolean;
};

export function VariablesTable({
  items,
  loading,
  error,
  onEdit,
  onDelete,
  hideScope = false,
}: Props) {
  const columns = hideScope ? 6 : 7;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[960px]">
        <thead className="bg-slate-100">
          <tr>
            <th className={th}>Nome</th>
            <th className={th}>Valor</th>
            {!hideScope && <th className={th}>Escopo</th>}
            <th className={th}>Descrição</th>
            <th className={th}>Ativa</th>
            <th className={th}>Atualizada em</th>
            <th className={`${th} text-right`}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns}
                className="px-4 py-12 text-center text-sm text-slate-500"
              >
                Carregando variáveis...
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td
                colSpan={columns}
                className="px-4 py-12 text-center text-sm text-red-600"
              >
                Não foi possível carregar as variáveis.
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td
                colSpan={columns}
                className="px-4 py-12 text-center text-sm text-slate-500"
              >
                Nenhuma variável encontrada. Clique em "Nova variável" para
                cadastrar a primeira.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-200 hover:bg-slate-50/70"
              >
                <td className="px-4 py-3 font-mono text-sm font-medium text-slate-900">
                  {item.name}
                </td>
                <td className="max-w-[260px] px-4 py-3 text-sm text-slate-700">
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
                {!hideScope && (
                  <td className="max-w-[220px] px-4 py-3">
                    <ScopeBadge type={item.scope_type} label={item.scope_label} />
                  </td>
                )}
                <td className="max-w-[240px] px-4 py-3 text-sm text-slate-600">
                  <span
                    className="block truncate"
                    title={item.description ?? ""}
                  >
                    {item.description || "---"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex border px-2 py-0.5 text-xs font-medium ${
                      item.active
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-slate-100 text-slate-600"
                    }`}
                  >
                    {item.active ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                  {formatDate(item.updated_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      title="Editar"
                      aria-label={`Editar ${item.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      title="Excluir"
                      aria-label={`Excluir ${item.name}`}
                      className="inline-flex h-9 w-9 items-center justify-center border border-red-200 bg-white text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
