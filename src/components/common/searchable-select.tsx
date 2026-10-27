import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

import { normalizeSearch } from "@/lib/search";

export type SearchableOption<T extends string | number> = {
  value: T;
  label: string;
  // Texto extra pequeno abaixo do nome (ex.: repositório da automação). Também entra na busca.
  description?: string | null;
  disabled?: boolean;
};

type SearchableSelectProps<T extends string | number> = {
  value: T | "" | null | undefined;
  onChange: (value: T | "") => void;
  options: SearchableOption<T>[];
  placeholder?: string;
  // Quando informado, aparece como primeira opção e limpa a seleção (ex.: "Todos os bots").
  emptyLabel?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  required?: boolean;
  loading?: boolean;
  className?: string;
  id?: string;
};

const PANEL_MAX_HEIGHT = 320;
const MIN_PANEL_HEIGHT = 200;

export function SearchableSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  emptyLabel,
  searchPlaceholder = "Digite para buscar...",
  emptyText = "Nenhum resultado.",
  disabled = false,
  required = false,
  loading = false,
  className = "",
  id,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean; maxHeight: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const hasValue = value !== "" && value !== null && value !== undefined;
  const selected = hasValue ? options.find((o) => o.value === value) : undefined;

  type Row = { value: T | ""; label: string; description?: string | null; disabled?: boolean };

  const rows: Row[] = useMemo(() => {
    const q = normalizeSearch(query);
    const filtered = q
      ? options.filter((o) => normalizeSearch(`${o.label} ${o.description ?? ""}`).includes(q))
      : options;
    const list: Row[] = filtered.map((o) => ({ ...o }));
    if (emptyLabel && !q) list.unshift({ value: "", label: emptyLabel });
    return list;
  }, [options, query, emptyLabel]);

  function place() {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    // Prefere abrir para baixo (encolhe a lista se preciso); só sobe quando embaixo não cabe quase nada.
    const up = below < MIN_PANEL_HEIGHT + 16 && r.top > below;
    const maxHeight = Math.min(PANEL_MAX_HEIGHT, Math.max(MIN_PANEL_HEIGHT, (up ? r.top : below) - 16));
    // Lista mais larga que o campo: nunca passa da borda direita da tela.
    const width = Math.max(r.width, 260);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    setRect({ top: up ? r.top - 4 : r.bottom + 4, left, width: r.width, up, maxHeight });
  }

  function openPanel() {
    if (disabled) return;
    place();
    setQuery("");
    // Lista sem busca: [emptyLabel?] + options. Começa destacando o item já selecionado.
    const offset = emptyLabel ? 1 : 0;
    const index = hasValue ? options.findIndex((o) => o.value === value) : -1;
    setHighlight(index >= 0 ? index + offset : 0);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function choose(row: Row) {
    if (row.disabled) return;
    onChange(row.value);
    close();
  }

  useLayoutEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onMove(event: Event) {
      // Rolar a própria lista não reposiciona; rolar a página acompanha o campo.
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

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>(`[data-index="${highlight}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(rows.length - 1, h + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[highlight];
      if (row) choose(row);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  function onButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (open) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPanel();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Começar a digitar com o campo focado já abre a busca com a letra.
      event.preventDefault();
      openPanel();
      setQuery(event.key);
      setHighlight(0);
    }
  }

  const buttonText = selected?.label ?? (hasValue ? String(value) : emptyLabel ?? placeholder);
  const showPlaceholder = !selected && !hasValue && !emptyLabel;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        onKeyDown={onButtonKeyDown}
        title={selected?.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        <span className={`truncate ${showPlaceholder ? "text-slate-400" : ""}`}>
          {loading ? "Carregando..." : buttonText}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {hasValue && emptyLabel && !disabled ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar seleção"
              onClick={(event) => {
                event.stopPropagation();
                onChange("");
              }}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className={`h-4 w-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {required ? (
        // Mantém a validação nativa do formulário ("preencha este campo").
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={hasValue ? String(value) : ""}
          onChange={() => undefined}
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
        />
      ) : null}

      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              className="fixed z-[10000] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{
                left: rect.left,
                width: Math.max(rect.width, 260),
                maxHeight: rect.maxHeight,
                ...(rect.up ? { bottom: window.innerHeight - rect.top } : { top: rect.top }),
              }}
            >
              <div className="relative border-b border-slate-200 p-2">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setHighlight(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
                {rows.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-slate-500">{emptyText}</div>
                ) : (
                  rows.map((row, index) => {
                    const isSelected = hasValue ? row.value === value : row.value === "";
                    return (
                      <button
                        key={`${String(row.value)}-${index}`}
                        type="button"
                        data-index={index}
                        disabled={row.disabled}
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => choose(row)}
                        title={row.label}
                        className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:text-slate-400 ${
                          index === highlight ? "bg-slate-100" : ""
                        } ${row.value === "" ? "text-slate-500" : "text-slate-800"}`}
                      >
                        <Check
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-slate-900" : "text-transparent"}`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{row.label}</span>
                          {row.description ? (
                            <span className="block truncate text-xs text-slate-500">{row.description}</span>
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
