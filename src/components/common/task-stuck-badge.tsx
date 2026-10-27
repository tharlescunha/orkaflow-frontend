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
  /** Motivo gravado pelo orquestrador (fila com explicação); vence a dedução local. */
  waitingReason?: string | null;
};

export function TaskStuckBadge({ task, runner, waitingReason }: Props) {
  const minutes = getTaskStuckMinutes(task);
  if (minutes === null) return null;

  // Sem runner atribuído, a task ainda está na fila esperando o distribuidor
  // escolher uma máquina (ou não há máquina online liberada para essa automação).
  const reason =
    waitingReason ||
    (runner
      ? describeRunnerProblem(getRunnerHealth(runner))
      : "sem runner atribuído, aguardando máquina disponível");

  return (
    // Compacta na tabela: o motivo fica na dica (title) para não quebrar a coluna em várias linhas.
    <span
      className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
      title={reason ? `Parada há ${formatMinutes(minutes)}. Provável motivo: ${reason}` : "Sem atualização recente."}
    >
      <Clock className="h-3 w-3 shrink-0" />
      parada há {formatMinutes(minutes)}
    </span>
  );
}
