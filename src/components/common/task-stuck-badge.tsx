import { Clock } from "lucide-react";
import {
  describeRunnerProblem,
  formatMinutes,
  getRunnerHealth,
  getTaskStuckMinutes,
} from "@/lib/health";

type StuckTaskLike = {
  status: string;
  requested_start_at?: string | null;
  last_update_at?: string | null;
  created_at?: string | null;
};

type RunnerLike = {
  status?: string | null;
  enabled: boolean;
  last_heartbeat?: string | null;
  config?: { maintenance_mode?: boolean | null } | null;
};

type Props = {
  task: StuckTaskLike;
  runner?: RunnerLike | null;
};

export function TaskStuckBadge({ task, runner }: Props) {
  const minutes = getTaskStuckMinutes(task);
  if (minutes === null) return null;

  // Sem runner atribuído, a task ainda está na fila esperando o distribuidor
  // escolher uma máquina (ou não há máquina online liberada para essa automação).
  const reason = runner
    ? describeRunnerProblem(getRunnerHealth(runner))
    : "sem runner atribuído, aguardando máquina disponível";

  return (
    <span
      className="mt-1 inline-flex items-center gap-1 border border-red-300 bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800"
      title={reason ? `Provável motivo: ${reason}` : "Sem atualização recente."}
    >
      <Clock className="h-3 w-3 shrink-0" />
      parada há {formatMinutes(minutes)}
      {reason ? ` - ${reason}` : ""}
    </span>
  );
}
