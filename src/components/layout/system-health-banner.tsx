import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, ChevronDown, ChevronUp, Clock, ServerOff } from "lucide-react";
import { useSystemHealth } from "@/hooks/use-system-health";
import { formatMinutes } from "@/lib/health";

function runnerLabel(runner: { name: string; label?: string | null }) {
  return runner.label || runner.name;
}

export function SystemHealthBanner() {
  const { failedTasks, problemRunners, stuckTasks, total } = useSystemHealth();
  const [expanded, setExpanded] = useState(false);

  if (total === 0) return null;

  const linkClass = "underline decoration-white/60 underline-offset-2 hover:decoration-white";

  return (
    <div role="alert" className="shrink-0 bg-red-700 px-4 py-1.5 text-sm text-white">
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
          className="ml-auto inline-flex items-center gap-1 text-xs text-white/90 hover:text-white"
          aria-expanded={expanded}
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto border-t border-white/25 pt-2">
          {failedTasks.length > 0 && (
            <div>
              <span className="font-semibold">Tasks com erro, timeout ou parada forçada: </span>
              <span className="text-white/85">
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
              <span className="text-white/85">
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
              <span className="text-white/85">
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
