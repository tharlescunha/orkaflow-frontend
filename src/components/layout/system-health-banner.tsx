import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, ChevronDown, ChevronUp, Clock, ServerOff, X } from "lucide-react";
import { useSystemHealth } from "@/hooks/use-system-health";
import { formatMinutes } from "@/lib/health";

// "Dispensar" guarda o que estava no aviso; ele só volta quando surgir algo novo.
const DISMISSED_KEY = "orkaflow:health-banner-dismissed";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(keys: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(keys));
  } catch {
    // sem localStorage (janela anônima/bloqueado): dispensa só nesta tela
  }
}

function runnerLabel(runner: { name: string; label?: string | null }) {
  return runner.label || runner.name;
}

export function SystemHealthBanner() {
  const { failedTasks, problemRunners, stuckTasks, total } = useSystemHealth();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);

  const currentKeys = useMemo(
    () => [
      ...failedTasks.map((task) => `erro:${task.id}`),
      ...problemRunners.map(({ runner, reason }) => `runner:${runner.id}:${reason}`),
      ...stuckTasks.map(({ task }) => `parada:${task.id}`),
    ],
    [failedTasks, problemRunners, stuckTasks],
  );

  const hasNew = currentKeys.some((key) => !dismissed.has(key));

  function dismiss() {
    saveDismissed(currentKeys);
    setDismissed(new Set(currentKeys));
    setExpanded(false);
  }

  if (total === 0 || !hasNew) return null;

  const linkClass = "underline decoration-red-300 underline-offset-2 hover:decoration-red-700";

  return (
    <div role="alert" className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
      {/* Resumo em uma linha; os detalhes abrem sob demanda. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {failedTasks.length > 0 && (
          <Link to="/errors" className={`inline-flex items-center gap-1.5 font-semibold ${linkClass}`}>
            <AlertOctagon className="h-4 w-4 shrink-0" />
            {failedTasks.length} com erro (24h)
          </Link>
        )}
        {problemRunners.length > 0 && (
          <Link to="/runners" className={`inline-flex items-center gap-1.5 font-semibold ${linkClass}`}>
            <ServerOff className="h-4 w-4 shrink-0" />
            {problemRunners.length} runner{problemRunners.length > 1 ? "s" : ""} com problema
          </Link>
        )}
        {stuckTasks.length > 0 && (
          <Link to="/tasks" className={`inline-flex items-center gap-1.5 font-semibold ${linkClass}`}>
            <Clock className="h-4 w-4 shrink-0" />
            {stuckTasks.length} parada{stuckTasks.length > 1 ? "s" : ""} na fila
          </Link>
        )}

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-red-800/80 hover:text-red-900"
          aria-expanded={expanded}
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={dismiss}
          title="Esconder este aviso até aparecer um erro, runner ou task parada novos"
          className="inline-flex items-center gap-1 border-l border-red-200 pl-3 text-xs text-red-800/80 hover:text-red-900"
        >
          <X className="h-3.5 w-3.5" />
          Dispensar
        </button>
      </div>

      {expanded && (
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto border-t border-red-200 pt-2">
          {failedTasks.length > 0 && (
            <div>
              <span className="font-semibold">Tasks com erro, timeout ou parada forçada: </span>
              <span className="text-red-800/90">
                {failedTasks.slice(0, 12).map((task, index) => (
                  <span key={task.id}>
                    {index > 0 && ", "}
                    <Link to={`/tasks/${task.id}`} className={linkClass}>
                      #{task.id}
                    </Link>
                  </span>
                ))}
                {failedTasks.length > 12 && ` e mais ${failedTasks.length - 12}`}
              </span>
            </div>
          )}

          {problemRunners.length > 0 && (
            <div>
              <span className="font-semibold">Runners: </span>
              <span className="text-red-800/90">
                {problemRunners.map(({ runner, reason }, index) => (
                  <span key={runner.id}>
                    {index > 0 && "; "}
                    <Link to={`/runners/${runner.id}`} className={linkClass}>
                      {runnerLabel(runner)}
                    </Link>{" "}
                    ({reason})
                  </span>
                ))}
              </span>
            </div>
          )}

          {stuckTasks.length > 0 && (
            <div>
              <span className="font-semibold">Tasks paradas há mais de 10 min: </span>
              <span className="text-red-800/90">
                {stuckTasks.slice(0, 12).map(({ task, minutes }, index) => (
                  <span key={task.id}>
                    {index > 0 && ", "}
                    <Link to={`/tasks/${task.id}`} className={linkClass}>
                      #{task.id}
                    </Link>{" "}
                    ({formatMinutes(minutes)})
                  </span>
                ))}
                {stuckTasks.length > 12 && ` e mais ${stuckTasks.length - 12}`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
