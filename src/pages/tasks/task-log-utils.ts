import type { TaskLogItem } from "@/services/api/tasks";

export type ConsoleLevel = "debug" | "info" | "success" | "warning" | "error";

export type ConsoleLine = {
  id: string;
  level: ConsoleLevel;
  source: string;
  created_at?: string | null;
  message: string;
};

function tryDecodeEscapedUnicode(text: string) {
  if (!text.includes("\\u")) return text;

  try {
    const escaped = text
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    return JSON.parse(`"${escaped}"`);
  } catch {
    return text;
  }
}

function tryFixMojibake(text: string) {
  const suspicious = /Ã|Â|â|ð|�/.test(text);

  if (!suspicious) return text;

  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return decoded && decoded !== text ? decoded : text;
  } catch {
    return text;
  }
}

export function normalizeDisplayText(value?: string | null) {
  if (!value) return "---";
  return tryFixMojibake(tryDecodeEscapedUnicode(String(value)));
}

const TRACEBACK_MARKERS = ["TRACEBACK:", "Traceback (most recent call last)"];

// Mensagem final do worker: "texto curto" + (às vezes) "TRACEBACK: ..." com o stacktrace inteiro.
export function splitFinalMessage(value?: string | null) {
  const text = value ? normalizeDisplayText(value).trim() : "";
  if (!text) return { headline: "", traceback: "", errorLine: "" };

  let cut = -1;
  for (const marker of TRACEBACK_MARKERS) {
    const index = text.toUpperCase().indexOf(marker.toUpperCase());
    if (index >= 0 && (cut < 0 || index < cut)) cut = index;
  }

  const head = (cut >= 0 ? text.slice(0, cut) : text).trim();
  let traceback = cut >= 0 ? text.slice(cut).replace(/^TRACEBACK:\s*/i, "").trim() : "";
  const tracebackLines = traceback.split("\n").map((l) => l.trim()).filter(Boolean);
  // Última linha do traceback é a exceção ("ValueError: ..."): é o que mais interessa.
  const errorLine = tracebackLines.length ? tracebackLines[tracebackLines.length - 1] : "";
  if (!tracebackLines.length) traceback = "";

  const headline = head.split("\n").map((l) => l.trim()).find(Boolean) ?? errorLine;
  return { headline, traceback, errorLine };
}

function consoleLevel(level?: string | null, message?: string): ConsoleLevel {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "error" || normalized === "critical") return "error";
  if (normalized === "warning" || normalized === "warn") return "warning";
  if (normalized === "debug") return "debug";
  const text = (message ?? "").trimStart().toUpperCase();
  if (text.startsWith("[SUCESSO]") || text.startsWith("[SUCCESS]")) return "success";
  if (text.startsWith("[ERRO]") || text.startsWith("[ERROR]")) return "error";
  if (text.startsWith("[WARNING]") || text.startsWith("[AVISO]")) return "warning";
  return "info";
}

// Última linha de um traceback Python: "TimeoutError: ...", "requests.exceptions.HTTPError: ...".
const EXCEPTION_LINE = /^[A-Za-z_][\w.]*(Error|Exception|Exit|Interrupt|Warning)\b/;

// Linhas seguidas que são um bloco só (traceback, JSON) viram uma entrada no console.
function isContinuation(message: string) {
  const text = message.trim();
  return (
    /^(File "|During handling of the above exception|The above exception was the direct cause)/.test(text) ||
    /^[\]}),]+,?$/.test(text) ||
    /^"[^"]+":/.test(text) ||
    /^\s{2,}\S/.test(message) ||
    /^\^+$/.test(text)
  );
}

function logTime(log: TaskLogItem) {
  return log.created_at ? new Date(log.created_at).getTime() : 0;
}

/**
 * Ordem do log: o que chegou primeiro fica em cima.
 *
 * - Linhas sem número de sequência (agenda, fila, abertura do worker...) entram pelo horário.
 * - As linhas do robô (com sequence_number) ficam juntas e na ordem da sequência: assim um traceback nunca é partido por
 *   uma linha de outra origem. O bloco do robô vem depois do que aconteceu antes da primeira linha dele.
 * - O que veio depois do início do robô (e o resultado, que é montado à parte) fecha o log.
 */
function sortLogs(logs: TaskLogItem[]) {
  const byTime = (a: TaskLogItem, b: TaskLogItem) => logTime(a) - logTime(b) || a.id - b.id;
  const hasSequence = (log: TaskLogItem) => typeof log.sequence_number === "number";

  const robot = logs
    .filter(hasSequence)
    .sort((a, b) => (a.sequence_number as number) - (b.sequence_number as number) || byTime(a, b));
  const others = logs.filter((log) => !hasSequence(log)).sort(byTime);
  if (robot.length === 0) return others;

  const robotStart = logTime(robot[0]);
  return [...others.filter((log) => logTime(log) <= robotStart), ...robot, ...others.filter((log) => logTime(log) > robotStart)];
}

export function buildConsoleLines(
  logs: TaskLogItem[],
  finalMessage?: string | null,
  failed = false,
  finishedAt?: string | null
): ConsoleLine[] {
  const lines: ConsoleLine[] = [];
  // Dentro de um traceback tudo é uma entrada só, até a linha da exceção (a API tira a indentação).
  let inTraceback = false;

  for (const log of sortLogs(logs)) {
    const message = normalizeDisplayText(log.message);
    const level = consoleLevel(log.level, message);
    const source = String(log.source || "worker").toLowerCase();
    const previous = lines[lines.length - 1];
    const sameStream = previous && previous.source === source && previous.level === level;

    if (sameStream && (inTraceback || isContinuation(message))) {
      previous.message = `${previous.message}\n${message}`;
      if (inTraceback && EXCEPTION_LINE.test(message.trim())) inTraceback = false;
      continue;
    }

    inTraceback = message.trim().startsWith("Traceback (most recent call last)");
    lines.push({ id: `log-${log.id}`, level, source, created_at: log.created_at, message });
  }

  // A mensagem final entra no fim do log só se ainda não estiver nele (evita o mesmo traceback 3 vezes).
  const { headline, traceback, errorLine } = splitFinalMessage(finalMessage);
  const allText = lines.map((l) => l.message).join("\n");
  const probe = errorLine || headline;
  if (probe && !allText.includes(probe)) {
    lines.push({
      id: "final-message",
      level: failed ? "error" : "success",
      source: "resultado",
      created_at: finishedAt,
      message: traceback ? `${headline}\n${traceback}`.trim() : normalizeDisplayText(finalMessage).trim(),
    });
  }

  return lines;
}

export function consoleText(lines: ConsoleLine[]) {
  return lines
    .map((l) => {
      const time = l.created_at ? new Date(l.created_at).toLocaleTimeString("pt-BR") : "";
      return `${time} ${l.level.toUpperCase()} [${l.source}] ${l.message}`.trim();
    })
    .join("\n");
}
