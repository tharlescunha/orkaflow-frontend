import { Lock, Pencil, Plus, Trash2, Variable } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/query-error";
import { TableSkeleton } from "@/components/common/skeleton";
import { formatDateTimeShort } from "@/lib/format";
import { badge, btn, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { EnvVariableRead } from "@/services/api/env-variables";
import { ScopeBadge } from "./scope-badge";

// Valor secreto: nunca aparece, nem no title.
export function SecretMask() {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500" aria-label="Valor secreto">
      <Lock className="h-3.5 w-3.5" />
      <span>••••••••</span>
    </span>
  );
}

type Props = {
  items: EnvVariableRead[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  retrying?: boolean;
  // Há texto de busca ativo (muda o estado vazio).
  searching?: boolean;
  onClearSearch?: () => void;
  onNew: () => void;
  onEdit: (item: EnvVariableRead) => void;
  onDelete: (item: EnvVariableRead) => void;
  // Dentro de um alvo (bot, automação ou máquina) a coluna Escopo repetiria o mesmo valor.
  hideScope?: boolean;
};

export function VariablesTable({
  items,
  loading,
  error,
  onRetry,
  retrying,
  searching = false,
  onClearSearch,
  onNew,
  onEdit,
  onDelete,
  hideScope = false,
}: Props) {
  if (loading) return <TableSkeleton rows={5} columns={hideScope ? 5 : 6} />;

  if (error) {
    return (
      <div className="p-5">
        <QueryError error={error} what="as variáveis" onRetry={onRetry} retrying={retrying} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Variable}
        title={searching ? "Nenhuma variável com essa busca" : "Nenhuma variável neste alvo"}
        description={
          searching ? "Tente outro nome ou limpe a busca." : "Cadastre a primeira variável para este alvo."
        }
        action={
          searching && onClearSearch ? (
            <button type="button" onClick={onClearSearch} className={btn.secondary}>
              Limpar busca
            </button>
          ) : (
            <button type="button" onClick={onNew} className={btn.primary}>
              <Plus className="h-4 w-4" />
              Nova variável
            </button>
          )
        }
      />
    );
  }

  return (
    <div className={table.wrap}>
      <table className={table.table}>
        <thead className={table.thead}>
          <tr>
            <th className={table.th}>Nome</th>
            <th className={table.th}>Valor</th>
            {!hideScope && <th className={table.th}>Escopo</th>}
            <th className={table.th}>Descrição</th>
            <th className={table.th}>Status</th>
            <th className={table.th}>Atualizada em</th>
            <th className={table.thRight}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={table.trClickable} onClick={() => onEdit(item)}>
              <td className={cn(table.tdStrong, "font-mono")}>{item.name}</td>
              <td className={table.td}>
                {item.is_secret ? (
                  <SecretMask />
                ) : (
                  <span className={cn(table.truncate, "font-mono")} title={item.value ?? ""}>
                    {item.value || <span className="text-slate-400">(vazio)</span>}
                  </span>
                )}
              </td>
              {!hideScope && (
                <td className={table.td}>
                  <ScopeBadge type={item.scope_type} label={item.scope_label} />
                </td>
              )}
              <td className={table.tdMuted}>
                <span className={cn(table.truncate, "max-w-[240px]")} title={item.description ?? ""}>
                  {item.description || "---"}
                </span>
              </td>
              <td className={table.td}>
                <span className={cn(badge, item.active ? tone.success : tone.neutral)}>
                  {item.active ? "Ativa" : "Inativa"}
                </span>
              </td>
              <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTimeShort(item.updated_at)}</td>
              <td className={table.tdRight}>
                <ActionsMenu
                  label={`Ações de ${item.name}`}
                  items={[
                    { label: "Editar", icon: Pencil, onSelect: () => onEdit(item) },
                    {
                      label: "Excluir",
                      icon: Trash2,
                      tone: "danger",
                      separatorBefore: true,
                      onSelect: () => onDelete(item),
                    },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
