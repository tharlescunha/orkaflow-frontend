import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

import { normalizeSearch } from "@/lib/search";
import type { SearchableOption } from "./searchable-select";

type SearchableMultiSelectProps<T extends string | number> = {
  label: string;
  options: SearchableOption<T>[];
  selectedValues: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
  emptyText?: string;
  searchPlaceholder?: string;
  className?: string;
};

const PANEL_MAX_HEIGHT = 360;

function buttonText(label: string, count: number, first?: string) {
  if (count === 0) return label;
  if (count === 1 && first) return first;
  return `${label}: ${count} selecionados`;
}

// Filtro de múltipla escolha com busca dentro (ex.: automações e runners na tela de Tasks).
export function SearchableMultiSelect<T extends string | number>({
  label,
  options,
  selectedValues,
  onChange,
  disabled = false,
  emptyText = "Nenhuma opção disponível.",
  searchPlaceholder = "Digite para buscar...",
  className = "",
}: SearchableMultiSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options;
    return options.filter((o) => normalizeSearch(`${o.label} ${o.description ?? ""}`).includes(q));
  }, [options, query]);

  const selectedLabels = options.filter((o) => selectedValues.includes(o.value)).map((o) => o.label);

  function place() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < PANEL_MAX_HEIGHT + 16 && r.top > below;
    // Lista mais larga que o campo: nunca passa da borda direita da tela.
    const width = Math.max(r.width, 300);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setRect({ top: up ? r.top - 4 : r.bottom + 4, left, width: r.width, up });
  }

  function toggleOpen() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    place();
    setQuery("");
    setOpen(true);
  }

  function toggleValue(value: T) {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value]
    );
  }

  function selectFiltered() {
    const next = new Set(selectedValues);
    filtered.forEach((o) => !o.disabled && next.add(o.value));
    onChange([...next]);
  }

  useLayoutEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onMove(event: Event) {
      if (panelRef.current && event.target instanceof Node && panelRef.current.contains(event.target)) return;
      place();
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        title={selectedLabels.join(", ") || undefined}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate text-left">
          {buttonText(label, selectedValues.length, selectedLabels[0])}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[10000] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{
                left: rect.left,
                width: Math.max(rect.width, 300),
                maxHeight: PANEL_MAX_HEIGHT,
                ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
              }}
            >
              <div className="relative border-b border-slate-200 p-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setOpen(false);
                      buttonRef.current?.focus();
                    } else if (event.key === "Enter" && filtered.length === 1) {
                      event.preventDefault();
                      toggleValue(filtered[0].value);
                    }
                  }}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={selectFiltered}
                  disabled={filtered.length === 0}
                  className="font-medium text-slate-600 hover:text-slate-950 disabled:text-slate-300"
                >
                  {query ? "Marcar os encontrados" : "Marcar todos"}
                </button>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  disabled={selectedValues.length === 0}
                  className="font-medium text-slate-600 hover:text-slate-950 disabled:text-slate-300"
                >
                  Limpar ({selectedValues.length})
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-slate-500">
                    {options.length === 0 ? emptyText : "Nenhum resultado."}
                  </div>
                ) : (
                  filtered.map((option) => {
                    const checked = selectedValues.includes(option.value);
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => toggleValue(option.value)}
                        title={option.label}
                        className="flex w-full items-start gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{option.label}</span>
                          {option.description ? (
                            <span className="block truncate text-xs text-slate-500">{option.description}</span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
