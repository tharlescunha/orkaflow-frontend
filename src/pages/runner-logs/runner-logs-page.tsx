import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, Eraser, Pause, Play, Search } from "lucide-react";

import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { parseApiDate } from "@/lib/health";
import { listRunners } from "@/services/api/runners";
import {
  listRunnerLogs,
  type RunnerLogLine,
  type RunnerLogSource,
} from "@/services/api/runner-logs";

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

const chip = (active: boolean) =>
  `h-9 border px-3 text-sm font-medium transition ${
    active
      ? "border-slate-950 bg-slate-950 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

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
  const time = date.toLocaleTimeString("pt-BR");
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
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
          label:
            (runner.label ? `${runner.name} (${runner.label})` : runner.name) +
            (runner.enabled ? "" : " (inativo)"),
          description: runner.host_name,
        })),
    [runnersQuery.data],
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
    [runnerId, source, level, taskId, search],
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

  const status = !runnerId
    ? null
    : paused
      ? { text: "Pausado", dot: "bg-slate-400" }
      : error
        ? { text: "Sem conexão", dot: "bg-red-500" }
        : { text: "Ao vivo", dot: "bg-emerald-500 animate-pulse" };

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Logs das máquinas</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                O worker.log de cada máquina em tempo real: o que o worker faz e a saída dos
                robôs.
                {retentionDays ? ` O painel guarda os últimos ${retentionDays} dias.` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {status && (
                <span className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} />
                  {status.text}
                </span>
              )}
              <button
                type="button"
                disabled={!runnerId}
                onClick={() => setPaused((p) => !p)}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {paused ? "Retomar" : "Pausar"}
              </button>
              <button
                type="button"
                disabled={!lines.length}
                onClick={() => setLines([])}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eraser className="h-4 w-4" />
                Limpar tela
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,160px)_minmax(0,200px)_minmax(0,320px)]">
            <SearchableSelect<number>
              value={runnerId}
              onChange={handleRunnerChange}
              options={runnerOptions}
              placeholder="Selecione a máquina"
              searchPlaceholder="Buscar máquina..."
              loading={runnersQuery.isLoading}
            />

            <input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value.replace(/\D/g, ""))}
              placeholder="Task (id)"
              inputMode="numeric"
              className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
            />

            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as LevelFilter)}
              className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
            >
              <option value="">Todos os níveis</option>
              <option value="ERROR">Só erros</option>
              <option value="WARNING">Só avisos</option>
            </select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar no texto"
                className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(SOURCE_LABELS) as SourceFilter[]).map((key) => (
              <button
                key={key}
                type="button"
                className={chip(source === key)}
                onClick={() => setSource(key)}
              >
                {SOURCE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          {error && (
            <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">
              {error} Tentando de novo...
            </div>
          )}

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
                Nenhuma linha {hasExtraFilter ? "com esse filtro " : ""}ainda. Se a
                máquina estiver ligada com o worker atualizado, as linhas aparecem aqui em poucos
                segundos.
              </p>
            ) : (
              lines.map((line) => (
                <div key={line.id} className="flex gap-3 hover:bg-white/5">
                  <span className="shrink-0 text-slate-500">{formatTime(line.logged_at)}</span>
                  <span className={`w-14 shrink-0 ${levelClass(line.level)}`}>{line.level}</span>
                  <span className="w-20 shrink-0">
                    {line.source === "bot" && line.task_id ? (
                      <Link
                        to={`/tasks/${line.task_id}`}
                        className="text-sky-300 hover:underline"
                        title="Abrir a task"
                      >
                        task {line.task_id}
                      </Link>
                    ) : (
                      <span className="text-slate-500">worker</span>
                    )}
                  </span>
                  <span className={`min-w-0 whitespace-pre-wrap break-words ${levelClass(line.level)}`}>
                    {line.message}
                  </span>
                </div>
              ))
            )}
          </div>

          {!autoScroll && lines.length > 0 && (
            <button
              type="button"
              onClick={goToEnd}
              className="absolute bottom-4 right-6 inline-flex h-9 items-center gap-2 bg-white px-3 text-sm font-medium text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Ir para o fim
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
