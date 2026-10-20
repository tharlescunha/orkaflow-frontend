import axios from "axios";

type ValidationItem = { loc?: unknown[]; msg?: string } | string;

function formatValidationItem(item: ValidationItem): string {
  if (typeof item === "string") return item;
  const msg = item?.msg ?? "";
  const loc = Array.isArray(item?.loc)
    ? item.loc.filter((part) => part !== "body" && part !== "query").join(".")
    : "";
  if (loc && msg) return `${loc}: ${msg}`;
  return msg || loc;
}

/**
 * Extrai uma mensagem legivel de um erro de API (FastAPI).
 * - detail string -> string
 * - detail lista (422) -> mensagens unidas
 * - sem resposta (rede/timeout) -> mensagem especifica
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Ocorreu um erro inesperado."
): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return "A API demorou demais para responder (timeout).";
      }
      return "Sem conexão com a API. Verifique a rede ou se o servidor está no ar.";
    }

    const data = error.response.data as
      | { detail?: unknown; message?: unknown }
      | string
      | undefined;
    const detail = typeof data === "object" && data !== null ? data.detail : undefined;

    if (typeof detail === "string" && detail.trim()) return detail;

    if (Array.isArray(detail)) {
      const joined = detail
        .map((item) => formatValidationItem(item as ValidationItem))
        .filter(Boolean)
        .join("; ");
      if (joined) return joined;
    }

    if (typeof data === "object" && data !== null && typeof data.message === "string") {
      return data.message;
    }

    return `${fallback} (HTTP ${error.response.status})`;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Junta uma mensagem de contexto ao detalhe retornado pela API. */
export function withApiDetail(context: string, error: unknown): string {
  const detail = getApiErrorMessage(error, "");
  return detail && !detail.startsWith("(") ? `${context} ${detail}` : context;
}
