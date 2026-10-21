import type { NotificationStep, StepMethod } from "@/services/api/notifications";
import { headersToRows, rowsToHeaders, validateHeaderRows, type HeaderRow } from "./header-utils";

export const STEP_METHODS: StepMethod[] = ["GET", "POST", "PUT", "PATCH"];
export const MAX_STEPS = 5;

export type ExtractRow = { id: number; variable: string; path: string };

export type StepForm = {
  id: number;
  name: string;
  method: StepMethod;
  url: string;
  headers: HeaderRow[];
  body_template: string;
  extract: ExtractRow[];
};

let seq = 1;

export function newExtractRow(variable = "", path = ""): ExtractRow {
  return { id: seq++, variable, path };
}

export function newStep(first: boolean): StepForm {
  return {
    id: seq++,
    name: first ? "Autenticar" : "",
    method: first ? "POST" : "GET",
    url: "",
    headers: [],
    body_template: "",
    extract: first ? [newExtractRow("token", "")] : [],
  };
}

export function stepsFromApi(steps: NotificationStep[] | undefined): StepForm[] {
  return (steps ?? []).map((s) => ({
    id: seq++,
    name: s.name ?? "",
    method: s.method ?? "POST",
    url: s.url ?? "",
    headers: headersToRows(s.headers),
    body_template: s.body_template ?? "",
    extract: (s.extract ?? []).map((e) => newExtractRow(e.variable, e.path)),
  }));
}

function cleanExtract(rows: ExtractRow[]) {
  return rows
    .filter((r) => r.variable.trim() || r.path.trim())
    .map((r) => ({ variable: r.variable.trim(), path: r.path.trim() }));
}

export function stepsToApi(steps: StepForm[]): NotificationStep[] {
  return steps.map((s) => ({
    name: s.name.trim(),
    method: s.method,
    url: s.url.trim(),
    headers: rowsToHeaders(s.headers),
    body_template: s.body_template,
    extract: cleanExtract(s.extract),
  }));
}

const VAR_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const isHttpUrl = (v: string) => /^https?:\/\/\S+/i.test(v.trim());

/** Variáveis definidas em "Guardar da resposta" (válidas, sem repetição). */
export function stepVariableNames(steps: StepForm[]): string[] {
  const names: string[] = [];
  for (const s of steps)
    for (const e of s.extract) {
      const v = e.variable.trim();
      if (v && VAR_RE.test(v) && !names.includes(v)) names.push(v);
    }
  return names;
}

export function validateSteps(steps: StepForm[]): string | null {
  if (steps.length > MAX_STEPS) return `No máximo ${MAX_STEPS} etapas.`;
  const seen = new Set<string>();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const label = `Etapa ${i + 1}${s.name.trim() ? ` (${s.name.trim()})` : ""}`;
    if (!STEP_METHODS.includes(s.method)) return `${label}: método inválido.`;
    if (!s.url.trim()) return `${label}: informe a URL.`;
    if (!isHttpUrl(s.url)) return `${label}: a URL deve começar com http:// ou https://.`;
    const headerError = validateHeaderRows(s.headers);
    if (headerError) return `${label}: ${headerError}`;
    for (const e of cleanExtract(s.extract)) {
      if (!e.variable) return `${label}: informe o nome da variável em "Guardar da resposta".`;
      if (!VAR_RE.test(e.variable))
        return `${label}: variável "${e.variable}" inválida (use letras, números e _, sem começar com número).`;
      if (seen.has(e.variable)) return `${label}: variável "${e.variable}" repetida entre as etapas.`;
      seen.add(e.variable);
    }
  }
  return null;
}
