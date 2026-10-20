import { AlertTriangle, WifiOff } from "lucide-react";
import { useApiConnection } from "@/hooks/use-api-connection";

function formatTime(date: Date | null) {
  if (!date) return "o início da sessão";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ConnectionBanner() {
  const { disconnected, degraded, databaseStatus, lastContactAt } = useApiConnection();

  if (disconnected) {
    return (
      <div
        role="alert"
        className="flex shrink-0 items-center gap-2 bg-red-700 px-4 py-2 text-sm font-medium text-white"
      >
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          Sem conexão com a API desde {formatTime(lastContactAt)}. Os dados em tela podem
          estar desatualizados.
        </span>
      </div>
    );
  }

  if (degraded) {
    return (
      <div
        role="alert"
        className="flex shrink-0 items-center gap-2 bg-amber-600 px-4 py-2 text-sm font-medium text-white"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>API degradada (banco de dados: {databaseStatus ?? "indisponível"}).</span>
      </div>
    );
  }

  return null;
}
