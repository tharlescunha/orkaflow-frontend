// Formatação única para todas as telas (antes cada página tinha a sua cópia de formatDateTime).
export const EMPTY = "---";

const dateTimeMedium = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });
const dateTimeShort = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" });

function toDate(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 26/10/2026, 14:05:33 */
export function formatDateTime(value?: string | number | Date | null) {
  const date = toDate(value);
  return date ? dateTimeMedium.format(date) : EMPTY;
}

/** 26/10/2026, 14:05 */
export function formatDateTimeShort(value?: string | number | Date | null) {
  const date = toDate(value);
  return date ? dateTimeShort.format(date) : EMPTY;
}

export function formatDate(value?: string | number | Date | null) {
  const date = toDate(value);
  return date ? dateOnly.format(date) : EMPTY;
}

/** 14:05:33 hoje; "26/10 14:05:33" em outro dia. */
export function formatTimeSmart(value?: string | number | Date | null) {
  const date = toDate(value);
  if (!date) return EMPTY;
  const time = timeOnly.format(date);
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/** 1h 2m 3s, 2m 3s, 45s */
export function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return EMPTY;
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/** "agora", "há 5 min", "há 3 h", "há 2 d" (ou "em 5 min" para datas futuras). */
export function formatRelative(value?: string | number | Date | null, now: Date = new Date()) {
  const date = toDate(value);
  if (!date) return EMPTY;
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const past = diffSeconds <= 0;
  const abs = Math.abs(diffSeconds);
  let text: string;
  if (abs < 45) text = past ? "agora" : "em instantes";
  else if (abs < 3600) text = `${Math.round(abs / 60)} min`;
  else if (abs < 86400) text = `${Math.round(abs / 3600)} h`;
  else text = `${Math.round(abs / 86400)} d`;
  if (abs < 45) return text;
  return past ? `há ${text}` : `em ${text}`;
}

export function formatNumber(value?: number | null, fractionDigits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits }).format(value);
}

export function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${formatNumber(value, 1)}%`;
}

export function formatBoolean(value?: boolean | null) {
  if (value === null || value === undefined) return EMPTY;
  return value ? "Sim" : "Não";
}
