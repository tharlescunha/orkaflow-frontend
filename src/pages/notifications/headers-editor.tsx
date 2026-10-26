import { useState } from "react";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { btn, hint, input } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { newHeaderRow, type HeaderRow } from "./header-utils";

type Props = {
  rows: HeaderRow[];
  onChange: (rows: HeaderRow[]) => void;
};

const inputClass = input;

export function HeadersEditor({ rows, onChange }: Props) {
  const [visible, setVisible] = useState<Set<number>>(new Set());

  function update(id: number, patch: Partial<HeaderRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function toggle(id: number) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className={hint}>
          Nenhum cabeçalho. Ex.: Authorization, Content-Type.
        </p>
      )}

      {rows.map((row) => (
        <div key={row.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
          <input
            className={inputClass}
            placeholder="Nome (ex.: Authorization)"
            value={row.key}
            onChange={(e) => update(row.id, { key: e.target.value })}
            autoComplete="off"
          />
          <input
            className={inputClass}
            placeholder="Valor"
            type={visible.has(row.id) ? "text" : "password"}
            value={row.value}
            onChange={(e) => update(row.id, { value: e.target.value })}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => toggle(row.id)}
            title={visible.has(row.id) ? "Ocultar valor" : "Mostrar valor"}
            className={cn(btn.icon, "h-10 w-10")}
          >
            {visible.has(row.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            title="Remover cabeçalho"
            className={cn(btn.icon, "h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, newHeaderRow()])}
        className={cn(btn.secondary, "h-9")}
      >
        <Plus className="h-4 w-4" />
        Adicionar cabeçalho
      </button>
    </div>
  );
}
