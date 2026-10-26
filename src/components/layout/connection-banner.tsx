import { AlertTriangle, WifiOff } from "lucide-react";
import { useApiConnection } from "@/hooks/use-api-connection";

function formatTime(date: Date | null) {
  if (!date) return "o início da sessão";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ConnectionBanner() {
  const { disconnected, degraded, databaseStatus, issues, lastContactAt } = useApiConnection();

  if (disconnected) {
    return (
      <div
        role="status"
        className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"
      >
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>
          Reconectando ao servidor... A tela mostra os dados de {formatTime(lastContactAt)} e
          atualiza sozinha quando a conexão voltar.
        </span>
      </div>
    );
  }

  if (degraded) {
    return (
      <div
        role="alert"
        className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          API com atenção:{" "}
          {issues.length > 0
            ? issues.join(" · ")
            : `banco de dados ${databaseStatus ?? "indisponível"}`}
          .
        </span>
      </div>
    );
  }

  return null;
}
