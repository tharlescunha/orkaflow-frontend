import { AlertCircle, RefreshCcw } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";

type QueryErrorProps = {
  error: unknown;
  // O que não carregou, para a frase ficar natural: "as automações", "os logs".
  what: string;
  onRetry?: () => void;
  retrying?: boolean;
};

// Estado de erro padrão das listas e telas: motivo real + botão de tentar de novo.
export function QueryError({ error, what, onRetry, retrying }: QueryErrorProps) {
  const detail = getApiErrorMessage(error, "");
  const timedOut = /timeout|tempo limite|exceeded/i.test(detail);

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Não foi possível carregar {what}.</p>
          <p className="mt-0.5 text-red-700/80">
            {timedOut
              ? "O servidor demorou demais para responder."
              : detail || "Verifique a conexão com o servidor."}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 font-medium text-red-800 transition hover:bg-red-100 disabled:opacity-60"
        >
          <RefreshCcw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
          Tentar de novo
        </button>
      )}
    </div>
  );
}
