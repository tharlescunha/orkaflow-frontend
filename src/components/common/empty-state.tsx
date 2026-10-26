import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";

type EmptyStateProps = {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  // Botão da ação que resolve o vazio ("Nova automação", "Limpar filtros").
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon: Icon = Inbox, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-8" : "px-6 py-14"}`}>
      <div className="flex h-11 w-11 items-center justify-center border border-slate-200 bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
