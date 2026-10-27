// Ajudas compartilhadas pela lista e pelo formulário de calendários.
// Dias da semana no contrato da API: 0=segunda ... 6=domingo.

export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 0, short: "seg", long: "segunda" },
  { value: 1, short: "ter", long: "terça" },
  { value: 2, short: "qua", long: "quarta" },
  { value: 3, short: "qui", long: "quinta" },
  { value: 4, short: "sex", long: "sexta" },
  { value: 5, short: "sáb", long: "sábado" },
  { value: 6, short: "dom", long: "domingo" },
];

export const DEFAULT_WEEKDAYS = [0, 1, 2, 3, 4];

/** "seg a sex", "seg, qua e sex", "todos os dias", "nenhum". */
export function describeWeekdays(weekdays: number[]): string {
  const days = [...new Set(weekdays)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) return "nenhum";
  if (days.length === 7) return "todos os dias";

  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  if (contiguous && days.length >= 3) {
    return `${WEEKDAYS[days[0]].short} a ${WEEKDAYS[days[days.length - 1]].short}`;
  }

  const names = days.map((d) => WEEKDAYS[d].short);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Feriados nacionais de data fixa (MM-DD). Os móveis vêm do servidor na importação. */
export const FIXED_NATIONAL_HOLIDAYS: { monthDay: string; label: string }[] = [
  { monthDay: "01-01", label: "Confraternização Universal" },
  { monthDay: "04-21", label: "Tiradentes" },
  { monthDay: "05-01", label: "Dia do Trabalho" },
  { monthDay: "09-07", label: "Independência" },
  { monthDay: "10-12", label: "Nossa Senhora Aparecida" },
  { monthDay: "11-02", label: "Finados" },
  { monthDay: "11-15", label: "Proclamação da República" },
  { monthDay: "11-20", label: "Consciência Negra" },
  { monthDay: "12-25", label: "Natal" },
];

export function fixedHolidaysOfYear(year: number): string[] {
  return FIXED_NATIONAL_HOLIDAYS.map((h) => `${year}-${h.monthDay}`);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" que existe de verdade (rejeita 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  const match = value.match(ISO_DATE);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** 2026-04-21 -> "21/04/2026 (ter)". */
export function formatHoliday(value: string): string {
  if (!isValidIsoDate(value)) return value;
  const [y, m, d] = value.split("-").map(Number);
  // getUTCDay: 0=domingo ... 6=sábado; converte para 0=segunda ... 6=domingo.
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const weekday = WEEKDAYS[(jsDay + 6) % 7].short;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y} (${weekday})`;
}

export function sortUniqueDates(dates: string[]): string[] {
  return [...new Set(dates)].sort();
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return HHMM.test(value);
}
