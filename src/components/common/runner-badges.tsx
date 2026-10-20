import { formatMinutes, getRunnerHealth } from "@/lib/health";

type RunnerLike = {
  status?: string | null;
  enabled: boolean;
  last_heartbeat?: string | null;
  config?: { maintenance_mode?: boolean | null; max_concurrency?: number | null } | null;
  running_tasks_count?: number;
};

const base = "inline-flex items-center border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide";

export function RunnerHeartbeatText({ runner }: { runner: RunnerLike }) {
  const health = getRunnerHealth(runner);
  const minutes = health.heartbeatMinutes;

  const tone = !runner.last_heartbeat
    ? "text-red-700 font-semibold"
    : health.staleHeartbeat
    ? "text-red-700 font-semibold"
    : minutes !== null && minutes >= 2
    ? "text-amber-700 font-semibold"
    : "text-slate-500";

  return (
    <span className={tone}>
      {runner.last_heartbeat
        ? `heartbeat há ${formatMinutes(minutes)}`
        : "sem heartbeat registrado"}
    </span>
  );
}

export function RunnerBadges({
  runner,
  showConcurrency = true,
}: {
  runner: RunnerLike;
  showConcurrency?: boolean;
}) {
  const health = getRunnerHealth(runner);
  const running = runner.running_tasks_count;
  const max = runner.config?.max_concurrency;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {health.disabled ? (
        <span className={`${base} border-red-300 bg-red-100 text-red-800`}>Desativado</span>
      ) : null}

      {health.maintenance ? (
        <span className={`${base} border-amber-300 bg-amber-100 text-amber-800`}>
          Em manutenção
        </span>
      ) : null}

      {health.noSignal ? (
        <span className={`${base} border-red-300 bg-red-100 text-red-800`}>Sem sinal</span>
      ) : null}

      {showConcurrency && running !== undefined ? (
        <span className={`${base} border-slate-300 bg-slate-50 text-slate-700 normal-case`}>
          {running} em execução
          {max ? ` / até ${max} background + 1 foreground` : ""}
        </span>
      ) : null}
    </div>
  );
}
