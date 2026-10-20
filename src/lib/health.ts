export const HEARTBEAT_STALE_MINUTES = 3;
export const STUCK_TASK_MINUTES = 10;

/** Datas da API sao UTC; strings sem fuso sao tratadas como UTC. */
export function parseApiDate(value?: string | null): Date | null {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function minutesSince(value?: string | null, now = Date.now()): number | null {
  const date = parseApiDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((now - date.getTime()) / 60_000));
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "menos de 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours}h ${rest}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

type RunnerLike = {
  status?: string | null;
  enabled: boolean;
  last_heartbeat?: string | null;
  config?: { maintenance_mode?: boolean | null } | null;
};

export type RunnerHealth = {
  disabled: boolean;
  maintenance: boolean;
  offline: boolean;
  /** heartbeat velho (> 3 min) ou ausente */
  staleHeartbeat: boolean;
  /** status online/busy mas heartbeat velho */
  noSignal: boolean;
  heartbeatMinutes: number | null;
  /** true se o runner nao esta apto a receber trabalho agora */
  unavailable: boolean;
};

export function getRunnerHealth(runner: RunnerLike, now = Date.now()): RunnerHealth {
  const status = (runner.status ?? "").toLowerCase();
  const heartbeatMinutes = minutesSince(runner.last_heartbeat, now);
  const staleHeartbeat =
    heartbeatMinutes === null || heartbeatMinutes >= HEARTBEAT_STALE_MINUTES;
  const disabled = !runner.enabled;
  const maintenance = Boolean(runner.config?.maintenance_mode) || status === "maintenance";
  const offline = status === "offline";
  const claimsOnline = status === "online" || status === "busy";
  const noSignal = claimsOnline && staleHeartbeat;

  return {
    disabled,
    maintenance,
    offline,
    staleHeartbeat,
    noSignal,
    heartbeatMinutes,
    unavailable: disabled || maintenance || offline || noSignal,
  };
}

export function describeRunnerProblem(health: RunnerHealth): string | null {
  if (health.disabled) return "runner desativado";
  if (health.maintenance) return "runner em manutenção";
  if (health.offline) return "runner offline";
  if (health.noSignal) {
    return `runner sem sinal (heartbeat há ${formatMinutes(health.heartbeatMinutes)})`;
  }
  return null;
}

/** Texto de status do runner; "SEM SINAL" quando diz online mas o heartbeat esta velho. */
export function getRunnerStatusText(runner: RunnerLike) {
  const health = getRunnerHealth(runner);
  if (health.noSignal) return "SEM SINAL";
  return String(runner.status || "offline").toUpperCase();
}

const WATCHED_STATUSES = ["waiting", "ready", "running", "stop_requested"];

type StuckTaskLike = {
  status: string;
  requested_start_at?: string | null;
  last_update_at?: string | null;
  created_at?: string | null;
};

/** Minutos sem andamento da task, ou null se nao esta parada. */
export function getTaskStuckMinutes(task: StuckTaskLike, now = Date.now()): number | null {
  if (!WATCHED_STATUSES.includes(task.status)) return null;

  const requested = parseApiDate(task.requested_start_at);
  // agendada para o futuro nao esta parada
  if (requested && requested.getTime() > now) return null;

  const reference = task.last_update_at ?? task.requested_start_at ?? task.created_at;
  const minutes = minutesSince(reference, now);
  if (minutes === null || minutes < STUCK_TASK_MINUTES) return null;
  return minutes;
}
