import { Plus, Trash2 } from "lucide-react";
import { newExtractRow, type ExtractRow } from "./step-utils";

type Props = { rows: ExtractRow[]; onChange: (rows: ExtractRow[]) => void };

const inputClass =
  "h-10 w-full border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900";

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
            className="inline-flex h-10 w-10 items-center justify-center border border-slate-300 bg-white text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, newExtractRow()])}
        className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4" />
        Adicionar variável
      </button>
      <p className="text-xs text-slate-500">
        Caminho vazio = resposta inteira. Use ponto para campos e números para itens de lista (ex.:
        token, data.token, 0).
      </p>
    </div>
  );
}
