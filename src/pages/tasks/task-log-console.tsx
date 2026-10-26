import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, Copy, Loader2, Search } from "lucide-react";

import { copyText } from "@/lib/clipboard";
import { normalizeSearch } from "@/lib/search";
import { consoleText, type ConsoleLevel, type ConsoleLine } from "./task-log-utils";

type Filter = "all" | "problems" | "errors";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "problems", label: "Avisos e erros" },
  { key: "errors", label: "Só erros" },
];

const LEVEL_TEXT: Record<ConsoleLevel, string> = {
  debug: "text-slate-500",
  info: "text-slate-200",
  success: "text-emerald-300",
  warning: "text-amber-300",
  error: "text-red-400",
};

const LEVEL_LABEL: Record<ConsoleLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  success: "OK",
  warning: "AVISO",
  error: "ERRO",
};

const SOURCE_LABEL: Record<string, string> = {
  worker: "robô",
  system: "sistema",
  panel: "painel",
  backend: "sistema",
  scheduler: "agenda",
  dispatcher: "fila",
  resultado: "resultado",
};

const chip = (active: boolean) =>
  `h-8 border px-3 text-xs font-medium transition ${
    active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const time = date.toLocaleTimeString("pt-BR");
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

type TaskLogConsoleProps = {
  lines: ConsoleLine[];
  loading: boolean;
  error: boolean;
  live: boolean;
  total: number;
  loaded: number;
};

export function TaskLogConsole({ lines, loading, error, live, total, loaded }: TaskLogConsoleProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(
    () => ({
      warning: lines.filter((l) => l.level === "warning").length,
      error: lines.filter((l) => l.level === "error").length,
    }),
    [lines]
  );

  const visible = useMemo(() => {
    const term = normalizeSearch(search);
    return lines.filter((line) => {
      if (filter === "errors" && line.level !== "error") return false;
      if (filter === "problems" && line.level !== "error" && line.level !== "warning") return false;
      return !term || normalizeSearch(line.message).includes(term);
    });
  }, [lines, filter, search]);

  // Segue o fim do log enquanto a task roda (se a pessoa não rolou para cima).
  useEffect(() => {
    const box = boxRef.current;
    if (box && following) box.scrollTop = box.scrollHeight;
  }, [visible, following]);

  function handleScroll() {
    const box = boxRef.current;
    if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    if (atBottom !== following) setFollowing(atBottom);
  }

  return (
    <div className="border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h2 className="mr-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Log da execução</h2>
        {live && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            ao vivo
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={chip(filter === f.key)}>
              {f.label}
              {f.key === "problems" && counts.warning + counts.error > 0 ? ` (${counts.warning + counts.error})` : ""}
              {f.key === "errors" && counts.error > 0 ? ` (${counts.error})` : ""}
            </button>
          ))}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no log"
              className="h-8 w-44 border border-slate-300 bg-white pl-8 pr-2 text-xs text-slate-900 outline-none focus:border-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={() => copyText(consoleText(visible))}
            disabled={!visible.length}
            className="inline-flex h-8 items-center gap-1.5 border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </button>
        </div>
      </div>

      {total > loaded && (
        <div className="border-b border-slate-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-800">
          Mostrando as últimas {loaded} de {total} linhas.
        </div>
      )}

      <div className="relative">
        <div
          ref={boxRef}
          onScroll={handleScroll}
          className="max-h-[560px] min-h-[160px] overflow-y-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-5"
        >
          {loading ? (
            <p className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando log...
            </p>
          ) : error ? (
            <p className="text-red-400">Não foi possível carregar o log.</p>
          ) : visible.length === 0 ? (
            <p className="text-slate-400">
              {lines.length ? "Nenhuma linha com esse filtro." : "Nenhuma linha de log ainda."}
            </p>
          ) : (
            visible.map((line) => (
              <div
                key={line.id}
                className={`flex gap-3 hover:bg-white/5 ${line.source === "resultado" ? "mt-2 border-t border-white/10 pt-2" : ""}`}
              >
                <span className="w-[4.5rem] shrink-0 text-slate-500">{formatTime(line.created_at)}</span>
                <span className={`w-11 shrink-0 font-semibold ${LEVEL_TEXT[line.level]}`}>{LEVEL_LABEL[line.level]}</span>
                <span className="hidden w-16 shrink-0 text-slate-500 sm:inline">{SOURCE_LABEL[line.source] ?? line.source}</span>
                <span className={`min-w-0 whitespace-pre-wrap break-words ${LEVEL_TEXT[line.level]}`}>{line.message}</span>
              </div>
            ))
          )}
        </div>

        {!following && visible.length > 0 && (
          <button
            type="button"
            onClick={() => setFollowing(true)}
            className="absolute bottom-3 right-5 inline-flex h-8 items-center gap-2 bg-white px-3 text-xs font-medium text-slate-900 shadow-lg hover:bg-slate-100"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Ir para o fim
          </button>
        )}
      </div>
    </div>
  );
}
