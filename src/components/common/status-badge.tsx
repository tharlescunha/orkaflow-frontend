import type { TaskStatus } from "@/services/api/tasks";

type StatusBadgeProps = {
  status: TaskStatus;
  // compact: só a bolinha e o texto, sem fundo (para listas densas).
  compact?: boolean;
};

const statusMap: Record<TaskStatus, { label: string; className: string; dot: string; pulse?: boolean }> = {
  waiting: { label: "Aguardando", className: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  scheduled: { label: "Agendada", className: "bg-sky-50 text-sky-800 border-sky-200", dot: "bg-sky-500" },
  ready: { label: "Pronta", className: "bg-cyan-50 text-cyan-800 border-cyan-200", dot: "bg-cyan-500" },
  running: { label: "Executando", className: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-600", pulse: true },
  stop_requested: { label: "Parando", className: "bg-orange-50 text-orange-800 border-orange-200", dot: "bg-orange-500", pulse: true },
  forced_stop: { label: "Parada forçada", className: "bg-violet-50 text-violet-800 border-violet-200", dot: "bg-violet-500" },
  canceled: { label: "Cancelada", className: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  finished: { label: "Finalizada", className: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  error: { label: "Erro", className: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },
  timeout: { label: "Timeout", className: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-500" },
};

export function StatusBadge({ status, compact }: StatusBadgeProps) {
  const config = statusMap[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  };

  const dot = (
    <span className="relative flex h-2 w-2">
      {config.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${config.dot}`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${config.dot}`} />
    </span>
  );

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-slate-700">
        {dot}
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
      {dot}
      {config.label}
    </span>
  );
}
