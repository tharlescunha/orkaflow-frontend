import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, Eraser, Pause, Play } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatTimeSmart } from "@/lib/format";
import { parseApiDate } from "@/lib/health";
import { btn, card, input, select } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listRunners } from "@/services/api/runners";
import { listRunnerLogs, type RunnerLogLine, type RunnerLogSource } from "@/services/api/runner-logs";

const POLL_MS = 2500;
const INITIAL_LINES = 300;
const MAX_LINES_ON_SCREEN = 3000;

type SourceFilter = RunnerLogSource | "all";
type LevelFilter = "" | "ERROR" | "WARNING";

const SOURCE_LABELS: Record<SourceFilter, string> = {
  all: "Tudo",
  worker: "Só worker",
  bot: "Só robôs",
};

// Botão segmentado (chip) do filtro de origem.
const segment = (active: boolean) =>
  cn(
    "h-9 rounded-lg border px-3 text-sm font-medium transition",
    active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  );

function levelClass(level: string) {
  switch (level) {
    case "ERROR":
    case "CRITICAL":
      return "text-red-400";
    case "WARNING":
      return "text-amber-300";
    default:
      return "text-slate-200";
  }
}

function formatTime(value: string) {
  const date = parseApiDate(value);
  if (!date) return "--:--:--";
  return formatTimeSmart(date);
}

export function RunnerLogsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRunner = Number(searchParams.get("runner_id")) || "";

  const [runnerId, setRunnerId] = useState<number | "">(initialRunner);
  const [source, setSource] = useState<SourceFilter>("all");
  const [level, setLevel] = useState<LevelFilter>("");
  const [taskInput, setTaskInput] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [taskId, setTaskId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState("");

  const [lines, setLines] = useState<RunnerLogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const lastIdRef = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const runnersQuery = useQuery({
    queryKey: ["runners", "log-options"],
    queryFn: () => listRunners({ limit: 500 }),
  });
  // Ativas primeiro; inativas continuam selecionáveis (log histórico), marcadas e no fim.
  const runnerOptions = useMemo(
    () =>
      [...(runnersQuery.data ?? [])]
        .sort((a, b) => Number(b.enabled) - Number(a.enabled))
        .map((runner) => ({
          value: runner.id,
          label: (runner.label ? `${runner.name} (${runner.label})` : runner.name) + (runner.enabled ? "" : " (inativo)"),
          description: runner.host_name,
        })),
    [runnersQuery.data]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      const parsed = Number(taskInput.trim());
      setTaskId(taskInput.trim() && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput, taskInput]);

  const filters = useMemo(
    () => ({
      runner_id: runnerId === "" ? undefined : runnerId,
      source: source === "all" ? undefined : source,
      level: level || undefined,
      task_id: taskId,
      search: search || undefined,
    }),
    [runnerId, source, level, taskId, search]
  );
  const filtersKey = JSON.stringify(filters);
  const hasExtraFilter = Boolean(filters.source || filters.level || filters.task_id || filters.search);

  // Filtro novo = começa do zero (as últimas linhas que batem com ele).
  useEffect(() => {
    lastIdRef.current = null;
    setLines([]);
    setError(null);
    setLoadedOnce(false);
    setAutoScroll(true);
  }, [filtersKey]);

  useEffect(() => {
    const runner = filters.runner_id;
    if (!runner || paused) return;

    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      try {
        const first = lastIdRef.current === null;
        const page = await listRunnerLogs({
          ...filters,
          runner_id: runner as number,
          after_id: first ? undefined : (lastIdRef.current as number),
          limit: first ? INITIAL_LINES : 1000,
        });
        if (cancelled) return;

        if (page.last_id != null) lastIdRef.current = page.last_id;
        else if (first) lastIdRef.current = 0;
        setRetentionDays(page.retention_days);
        setLoadedOnce(true);
        setError(null);
        if (page.items.length) {
          setLines((prev) => [...prev, ...page.items].slice(-MAX_LINES_ON_SCREEN));
        }
      } catch (err) {
        if (!cancelled) {
          setError(getApiErrorMessage(err, "Não foi possível buscar o log da máquina."));
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(tick, POLL_MS);
      }
    }

    tick();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // filtersKey cobre `filters`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, paused]);

  useLayoutEffect(() => {
    if (!autoScroll || !boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, autoScroll]);

  function handleScroll() {
    const box = boxRef.current;
    if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    setAutoScroll(atBottom);
  }

  function goToEnd() {
    setAutoScroll(true);
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }

  function handleRunnerChange(next: number | "") {
    setRunnerId(next);
    const params = new URLSearchParams(searchParams);
    if (next) params.set("runner_id", String(next));
    else params.delete("runner_id");
    setSearchParams(params, { replace: true });
  }

  function clearExtraFilters() {
    setSource("all");
    setLevel("");
    setTaskInput("");
    setSearchInput("");
  }

  const status = !runnerId
    ? null
    : paused
      ? { text: "Pausado", dot: "bg-slate-400" }
      : error
        ? { text: "Sem conexão", dot: "bg-red-500" }
        : { text: "Ao vivo", dot: "bg-emerald-500 animate-pulse" };

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Logs das máquinas"
          description={
            <>
              O worker.log de cada máquina em tempo real: o que o worker faz e a saída dos robôs.
              {retentionDays ? ` O painel guarda os últimos ${retentionDays} dias.` : ""}
            </>
          }
          actions={
            <>
              {status && (
                <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  {status.text}
                </span>
              )}
              <button type="button" disabled={!runnerId} onClick={() => setPaused((p) => !p)} className={btn.secondary}>
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? "Retomar" : "Pausar"}
              </button>
              <button type="button" disabled={!lines.length} onClick={() => setLines([])} className={btn.ghost}>
                <Eraser className="h-4 w-4" />
                Limpar tela
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasExtraFilter} onClear={clearExtraFilters}>
          <SearchableSelect<number>
            value={runnerId}
            onChange={handleRunnerChange}
            options={runnerOptions}
            placeholder="Selecione a máquina"
            searchPlaceholder="Buscar máquina..."
            loading={runnersQuery.isLoading}
            className="w-full sm:w-72"
          />

          <input
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value.replace(/\D/g, ""))}
            placeholder="Task (id)"
            inputMode="numeric"
            aria-label="Filtrar por task"
            className={cn(input, "w-32")}
          />

          <select value={level} onChange={(e) => setLevel(e.target.value as LevelFilter)} className={cn(select, "w-44")} aria-label="Nível do log">
            <option value="">Todos os níveis</option>
            <option value="ERROR">Só erros</option>
            <option value="WARNING">Só avisos</option>
          </select>

          <SearchInput value={searchInput} onChange={setSearchInput} placeholder="Buscar no texto" className="sm:w-64" />

          <div className="flex flex-wrap gap-2" role="group" aria-label="Origem do log">
            {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map((key) => (
              <button key={key} type="button" className={segment(source === key)} onClick={() => setSource(key)} aria-pressed={source === key}>
                {SOURCE_LABELS[key]}
              </button>
            ))}
          </div>
        </FilterBar>

        <div className="relative overflow-hidden rounded-b-xl">
          {error && <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">{error} Tentando de novo...</div>}

          <div
            ref={boxRef}
            onScroll={handleScroll}
            className="h-[calc(100vh-360px)] min-h-[360px] overflow-y-auto bg-slate-950 px-4 py-3 font-mono text-xs leading-5"
          >
            {!runnerId ? (
              <p className="text-slate-400">Escolha uma máquina para ver o log dela.</p>
            ) : !loadedOnce && !error ? (
              <p className="text-slate-400">Carregando...</p>
            ) : lines.length === 0 ? (
              <p className="text-slate-400">
                Nenhuma linha {hasExtraFilter ? "com esse filtro " : ""}ainda. Se a máquina estiver ligada com o worker atualizado, as linhas aparecem
                aqui em poucos segundos.
              </p>
            ) : (
              lines.map((line) => (
                <div key={line.id} className="flex gap-3 hover:bg-white/5">
                  <span className="shrink-0 text-slate-500">{formatTime(line.logged_at)}</span>
                  <span className={`w-14 shrink-0 ${levelClass(line.level)}`}>{line.level}</span>
                  <span className="w-20 shrink-0">
                    {line.source === "bot" && line.task_id ? (
                      <Link to={`/tasks/${line.task_id}`} className="text-sky-300 hover:underline" title="Abrir a task">
                        task {line.task_id}
                      </Link>
                    ) : (
                      <span className="text-slate-500">worker</span>
                    )}
                  </span>
                  <span className={`min-w-0 whitespace-pre-wrap break-words ${levelClass(line.level)}`}>{line.message}</span>
                </div>
              ))
            )}
          </div>

          {!autoScroll && lines.length > 0 && (
            <button type="button" onClick={goToEnd} className={cn(btn.secondary, "absolute bottom-4 right-6 h-9 shadow-lg")}>
              <ArrowDownToLine className="h-4 w-4" />
              Ir para o fim
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
