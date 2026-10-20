import { Link } from "react-router-dom";
import { AlertOctagon, Clock, ServerOff } from "lucide-react";
import { useSystemHealth } from "@/hooks/use-system-health";
import { formatMinutes } from "@/lib/health";

function runnerLabel(runner: { name: string; label?: string | null }) {
  return runner.label || runner.name;
}

export function SystemHealthBanner() {
  const { failedTasks, problemRunners, stuckTasks, total } = useSystemHealth();

  if (total === 0) return null;

  const linkClass = "underline decoration-white/60 underline-offset-2 hover:decoration-white";

  return (
    <div role="alert" className="shrink-0 space-y-1 bg-red-700 px-4 py-2 text-sm text-white">
      {failedTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AlertOctagon className="h-4 w-4 shrink-0" />
          <Link to="/errors" className={`font-semibold ${linkClass}`}>
            {failedTasks.length} task{failedTasks.length > 1 ? "s" : ""} com erro/timeout/parada
            forçada nas últimas 24h
          </Link>
          <span className="text-white/80">
            {failedTasks.slice(0, 5).map((task, index) => (
              <span key={task.id}>
                {index > 0 && ", "}
                <Link to={`/tasks/${task.id}`} className={linkClass}>
                  #{task.id}
                </Link>
              </span>
            ))}
            {failedTasks.length > 5 && ` e mais ${failedTasks.length - 5}`}
          </span>
        </div>
      )}

      {problemRunners.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ServerOff className="h-4 w-4 shrink-0" />
          <Link to="/runners" className={`font-semibold ${linkClass}`}>
            {problemRunners.length} runner{problemRunners.length > 1 ? "s" : ""} com problema
          </Link>
          <span className="text-white/80">
            {problemRunners.slice(0, 4).map(({ runner, reason }, index) => (
              <span key={runner.id}>
                {index > 0 && "; "}
                <Link to={`/runners/${runner.id}`} className={linkClass}>
                  {runnerLabel(runner)}
                </Link>{" "}
                ({reason})
              </span>
            ))}
            {problemRunners.length > 4 && ` e mais ${problemRunners.length - 4}`}
          </span>
        </div>
      )}

      {stuckTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Clock className="h-4 w-4 shrink-0" />
          <Link to="/tasks" className={`font-semibold ${linkClass}`}>
            {stuckTasks.length} task{stuckTasks.length > 1 ? "s" : ""} parada
            {stuckTasks.length > 1 ? "s" : ""} em waiting/ready há mais de 10 min
          </Link>
          <span className="text-white/80">
            {stuckTasks.slice(0, 5).map(({ task, minutes }, index) => (
              <span key={task.id}>
                {index > 0 && ", "}
                <Link to={`/tasks/${task.id}`} className={linkClass}>
                  #{task.id}
                </Link>{" "}
                ({formatMinutes(minutes)})
              </span>
            ))}
            {stuckTasks.length > 5 && ` e mais ${stuckTasks.length - 5}`}
          </span>
        </div>
      )}
    </div>
  );
}
