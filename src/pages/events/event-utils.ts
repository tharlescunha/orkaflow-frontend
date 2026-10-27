import type { NotificationTestResult, NotificationTestStep } from "@/services/api/notifications";
import type { EventRule, EventRunDetail, EventScopeType } from "@/services/api/events";

export const SCOPE_LABEL: Record<EventScopeType, string> = {
  automation: "Automação",
  bot: "Bot",
  all: "Qualquer automação",
};

/** "retorno.status = ok" / "retorno.status existe" / "código 3" / null quando o gatilho não tem configuração. */
export function describeTriggerConfig(rule: Pick<EventRule, "trigger_type" | "trigger_config">): string | null {
  const cfg = rule.trigger_config ?? {};
  if (rule.trigger_type === "result_contains" && cfg.key) {
    return cfg.value ? `retorno.${cfg.key} = ${cfg.value}` : `retorno.${cfg.key} existe`;
  }
  if (rule.trigger_type === "exit_code" && cfg.code != null) return `código ${cfg.code}`;
  return null;
}

export function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ----- Leitura dos "details" de um disparo (JSON livre do backend) -----

export type DetailRequest = { method: string; url: string; headers: Record<string, string>; body: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function readSteps(details: Record<string, unknown> | null): NotificationTestStep[] {
  const raw = details?.steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => {
    const r = asRecord(s) ?? {};
    return {
      name: typeof r.name === "string" ? r.name : "",
      ok: Boolean(r.ok),
      status_code: typeof r.status_code === "number" ? r.status_code : null,
      error: typeof r.error === "string" ? r.error : null,
      extracted: Array.isArray(r.extracted) ? r.extracted.map(String) : [],
    };
  });
}

export function readRequest(details: Record<string, unknown> | null): DetailRequest | null {
  const r = asRecord(details?.request_preview);
  if (!r) return null;
  const headers = asRecord(r.headers) ?? {};
  return {
    method: typeof r.method === "string" ? r.method : "",
    url: typeof r.url === "string" ? r.url : "",
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, String(v)])),
    body: typeof r.body === "string" ? r.body : r.body == null ? "" : JSON.stringify(r.body, null, 2),
  };
}

export function readResponseBody(details: Record<string, unknown> | null): string | null {
  const raw = details?.response_body;
  if (raw == null) return null;
  return typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
}

/** Converte o resultado do teste de um evento para a forma que o <TestResult/> das notificações entende. */
export function runToTestResult(run: EventRunDetail): NotificationTestResult {
  const d = run.details;
  const request = readRequest(d) ?? { method: "", url: "", headers: {}, body: "" };
  const snippet = (typeof d?.response_snippet === "string" ? d.response_snippet : null) ?? run.response_snippet;
  const error = (typeof d?.error === "string" ? d.error : null) ?? run.error;
  const statusCode = typeof d?.status_code === "number" ? d.status_code : run.status_code;
  return {
    ok: typeof d?.ok === "boolean" ? d.ok : run.ok,
    status_code: statusCode,
    response_snippet: snippet,
    error,
    steps: readSteps(d),
    request_preview: request,
  };
}
