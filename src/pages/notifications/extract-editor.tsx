import { Plus, Trash2 } from "lucide-react";

import { btn, hint, input } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { newExtractRow, type ExtractRow } from "./step-utils";

type Props = { rows: ExtractRow[]; onChange: (rows: ExtractRow[]) => void };

const inputClass = cn(input, "font-mono");

export function ExtractEditor({ rows, onChange }: Props) {
  const update = (id: number, patch: Partial<ExtractRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            className={inputClass}
            placeholder="Variável (ex.: token)"
            value={row.variable}
            onChange={(e) => update(row.id, { variable: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
          <input
            className={inputClass}
            placeholder="Caminho (vazio = resposta inteira)"
            value={row.path}
            onChange={(e) => update(row.id, { path: e.target.value })}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            title="Remover linha"
            className={cn(btn.icon, "h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, newExtractRow()])}
        className={cn(btn.secondary, "h-9")}
      >
        <Plus className="h-4 w-4" />
        Adicionar variável
      </button>
      <p className={hint}>
        Caminho vazio = resposta inteira. Use ponto para campos e números para itens de lista (ex.:
        token, data.token, 0).
      </p>
    </div>
  );
}
