import type { TaskStatus } from "@/services/api/tasks";

type StatusBadgeProps = {
  status: TaskStatus;
};

const statusMap: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  waiting: {
    label: "Aguardando",
    className: "bg-amber-100 text-amber-800 border border-amber-200",
  },
  scheduled: {
    label: "Agendada",
    className: "bg-sky-100 text-sky-800 border border-sky-200",
  },
  ready: {
    label: "Pronta",
    className: "bg-cyan-100 text-cyan-800 border border-cyan-200",
  },
  running: {
    label: "Executando",
    className: "bg-blue-100 text-blue-800 border border-blue-200",
  },
  stop_requested: {
    label: "Parada solicitada",
    className: "bg-orange-100 text-orange-800 border border-orange-200",
  },
  forced_stop: {
    label: "Força parada",
    className: "bg-violet-100 text-violet-800 border border-violet-200",
  },
  canceled: {
    label: "Cancelada",
    className: "bg-slate-200 text-slate-700 border border-slate-300",
  },
  finished: {
    label: "Finalizada",
    className: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  },
  error: {
    label: "Erro",
    className: "bg-red-100 text-red-800 border border-red-200",
  },
  timeout: {
    label: "Timeout",
    className: "bg-rose-100 text-rose-800 border border-rose-200",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusMap[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  };

  return (
    <span
      className={`inline-flex min-w-[132px] items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
