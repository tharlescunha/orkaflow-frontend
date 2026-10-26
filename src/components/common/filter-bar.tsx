import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

import { btn, inputWithIcon } from "@/lib/ui";
import { cn } from "@/lib/utils";

// Barra de filtros padrão: busca com lupa, selects na mesma linha e "Limpar" quando há filtro ativo.
export function FilterBar({
  children,
  onClear,
  hasActiveFilters,
  className,
}: {
  children: ReactNode;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3", className)}>
      {children}
      {hasActiveFilters && onClear && (
        <button type="button" onClick={onClear} className={cn(btn.ghost, "h-9 px-3 text-xs")}>
          <X className="h-3.5 w-3.5" />
          Limpar filtros
        </button>
      )}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className={inputWithIcon}
      />
    </div>
  );
}

export type ActiveFilterChip = { key: string; label: string; onRemove: () => void };

// Chips dos filtros aplicados ("Status: Executando ×"), abaixo da barra.
export function ActiveFilterChips({ chips }: { chips: ActiveFilterChip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-5 py-2">
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 py-1 pl-3 pr-1.5 text-xs font-medium text-blue-800">
          {chip.label}
          <button type="button" onClick={chip.onRemove} className="rounded-full p-0.5 hover:bg-blue-100" aria-label={`Remover filtro ${chip.label}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

// Rodapé de listas paginadas.
export function Pagination({
  page,
  totalPages,
  total,
  onChange,
  label = "resultados",
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
  label?: string;
}) {
  const safeTotalPages = Math.max(1, totalPages);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        <span className="font-medium text-slate-900">{total}</span> {label}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className={cn(btn.secondary, "h-9 px-3")}>
          Anterior
        </button>
        <span className="px-1 tabular-nums">
          Página {Math.min(page, safeTotalPages)} de {safeTotalPages}
        </span>
        <button type="button" onClick={() => onChange(page + 1)} disabled={page >= safeTotalPages} className={cn(btn.secondary, "h-9 px-3")}>
          Próxima
        </button>
      </div>
    </div>
  );
}
