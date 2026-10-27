import axios from "axios";

type ValidationItem = { loc?: unknown[]; msg?: string } | string;

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  login: "Login",
  email: "E-mail",
  password: "Senha",
  role: "Perfil legado",
  profile_id: "Perfil",
  active: "Status",
  description: "Descrição",
  label: "Rótulo",
  priority: "Prioridade",
  timeout_seconds: "Timeout",
};

/** Traduz as mensagens de validação mais comuns do FastAPI/Pydantic. */
function translateValidationMessage(message: string): string {
  const text = message.trim();

  if (/value is not a valid email address/i.test(text)) return "e-mail inválido";
  if (/field required|^missing$/i.test(text)) return "campo obrigatório";

  const tooShort = text.match(/at least (\d+) character/i);
  if (tooShort) return `mínimo de ${tooShort[1]} caracteres`;

  const tooLong = text.match(/at most (\d+) character/i);
  if (tooLong) return `máximo de ${tooLong[1]} caracteres`;

  if (/should match pattern/i.test(text)) return "formato inválido";
  if (/valid integer|valid number/i.test(text)) return "deve ser um número";
  if (/valid boolean/i.test(text)) return "deve ser verdadeiro ou falso";
  if (/valid (date|datetime)/i.test(text)) return "data inválida";
  if (/valid string/i.test(text)) return "deve ser um texto";

  const min = text.match(/greater than or equal to (\S+)/i);
  if (min) return `deve ser maior ou igual a ${min[1]}`;

  const max = text.match(/less than or equal to (\S+)/i);
  if (max) return `deve ser menor ou igual a ${max[1]}`;

  if (/^Input should be/i.test(text)) return "valor inválido";

  return text;
}

function formatValidationItem(item: ValidationItem): string {
  if (typeof item === "string") return translateValidationMessage(item);

  const msg = translateValidationMessage(item?.msg ?? "");
  const field = Array.isArray(item?.loc)
    ? item.loc
        .filter((part) => part !== "body" && part !== "query")
        .map(String)
        .pop()
    : undefined;
  const label = field ? (FIELD_LABELS[field] ?? field) : "";

  if (label && msg) return `${label}: ${msg}`;
  return msg || label;
}

/**
 * Extrai uma mensagem legivel de um erro de API (FastAPI).
 * - detail string -> string
 * - detail lista (422) -> mensagens traduzidas e unidas
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

    // 404/405 numa rota que o painel conhece: a API no servidor ainda é uma versão antiga.
    if (error.response.status === 405 || (error.response.status === 404 && detail === "Not Found")) {
      return "A API do servidor está desatualizada e ainda não tem esta função. Atualize o backend (git pull e reinicie a API) e tente de novo.";
    }

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
