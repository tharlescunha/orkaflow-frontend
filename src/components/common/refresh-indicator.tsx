import { useEffect, useState } from "react";
import { RefreshCcw } from "lucide-react";

import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

type RefreshIndicatorProps = {
  // dataUpdatedAt e isFetching da query (TanStack).
  updatedAt?: number;
  isFetching?: boolean;
  onRefresh?: () => void;
  // Intervalo do polling, só para o texto ("a cada 10 s").
  intervalMs?: number;
};

function relative(updatedAt: number, now: number) {
  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  if (seconds < 5) return "agora";
  if (seconds < 60) return `há ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.round(minutes / 60)} h`;
}

// "Atualizado há 12 s" + botão: substitui o contador regressivo de 1 em 1 s que re-renderizava a tela toda.
export function RefreshIndicator({ updatedAt, isFetching, onRefresh, intervalMs }: RefreshIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const text = updatedAt ? relative(updatedAt, now) : "";
  const title = intervalMs ? `Atualiza sozinho a cada ${Math.round(intervalMs / 1000)} s` : undefined;

  return (
    <div className="flex items-center gap-2" title={title}>
      {text && (
        <span className="hidden text-xs text-slate-500 sm:inline" aria-live="polite">
          {isFetching ? "Atualizando..." : `Atualizado ${text}`}
        </span>
      )}
      {onRefresh && (
        <button type="button" onClick={onRefresh} disabled={isFetching} className={btn.secondary} aria-label="Atualizar agora">
          <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          Atualizar
        </button>
      )}
    </div>
  );
}
