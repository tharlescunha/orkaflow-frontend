import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ClipboardList, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { NAV_GROUPS, type NavItem } from "@/lib/navigation";
import { normalizeSearch } from "@/lib/search";
import { cn } from "@/lib/utils";

type Entry = { key: string; label: string; hint: string; to: string; icon: NavItem["icon"]; search: string };

const ALL_ENTRIES: Entry[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    key: item.to,
    label: item.label,
    hint: group.title,
    to: item.to,
    icon: item.icon,
    search: normalizeSearch(`${item.label} ${group.title} ${item.keywords ?? ""}`),
  }))
);

const DEFAULT_PATHS = ["/tasks", "/automations/health", "/errors", "/automations", "/runners"];

// Busca global (Ctrl+K): vai para qualquer tela pelo nome, ou direto para uma task pelo id ("43133" ou "#43133").
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  // O corpo só existe enquanto aberto: a busca e o cursor zeram sozinhos a cada abertura.
  return createPortal(<PaletteBody onClose={onClose} />, document.body);
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = useMemo<Entry[]>(() => {
    const term = normalizeSearch(query.trim().replace(/^#/, ""));
    const taskId = /^\d+$/.test(term) ? term : null;
    const pages = term ? ALL_ENTRIES.filter((e) => e.search.includes(term)) : ALL_ENTRIES.filter((e) => DEFAULT_PATHS.includes(e.to));
    const task: Entry[] = taskId
      ? [{ key: `task-${taskId}`, label: `Abrir task #${taskId}`, hint: "Detalhe da execução", to: `/tasks/${taskId}`, icon: ClipboardList, search: "" }]
      : [];
    return [...task, ...pages].slice(0, 9);
  }, [query]);

  const selected = Math.min(cursor, Math.max(results.length - 1, 0));

  function go(entry: Entry) {
    navigate(entry.to);
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(results.length - 1, 0)));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (event.key === "Enter" && results[selected]) go(results[selected]);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="fixed inset-0 z-[9500]" role="dialog" aria-modal="true" aria-label="Buscar no painel">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 top-[12vh] mx-auto w-full max-w-xl px-4">
        <div className="page-enter overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 border-b border-slate-100 px-4">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              placeholder="Tela, assunto ou número da task..."
              className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-500">Esc</kbd>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto p-2">
            {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nada encontrado.</li>}
            {results.map((entry, index) => {
              const Icon = entry.icon;
              const active = index === selected;
              return (
                <li key={entry.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                      active ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.label}</span>
                      <span className="block truncate text-xs text-slate-500">{entry.hint}</span>
                    </span>
                    {active && <ArrowRight className="h-4 w-4 shrink-0 text-blue-500" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
