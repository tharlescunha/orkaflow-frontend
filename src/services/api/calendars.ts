import { api } from "./client";

/** Janela proibida: horário local "HH:MM"; weekdays 0=segunda ... 6=domingo; [] = todos os dias. */
export type CalendarBlackout = { label: string; start: string; end: string; weekdays: number[] };

export type CalendarRead = {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  /** dias úteis, 0=segunda ... 6=domingo */
  weekdays: number[];
  /** "YYYY-MM-DD", ordenadas */
  holidays: string[];
  blackouts: CalendarBlackout[];
  /** quantos agendamentos usam este calendário */
  schedules_count: number;
  created_at: string;
  updated_at: string | null;
};

export type CalendarPayload = {
  name: string;
  description?: string | null;
  active: boolean;
  weekdays: number[];
  holidays: string[];
  blackouts: CalendarBlackout[];
};

export type CalendarCheck = { allowed: boolean; reason: string | null; next_allowed_at: string | null };

export async function listCalendars(params?: { active?: boolean }) {
  const response = await api.get<CalendarRead[]>("/api/v1/calendars/", { params });
  return response.data;
}

export async function getCalendar(calendarId: number) {
  const response = await api.get<CalendarRead>(`/api/v1/calendars/${calendarId}`);
  return response.data;
}

export async function createCalendar(payload: CalendarPayload) {
  const response = await api.post<CalendarRead>("/api/v1/calendars/", payload);
  return response.data;
}

export async function updateCalendar(calendarId: number, payload: CalendarPayload) {
  const response = await api.put<CalendarRead>(`/api/v1/calendars/${calendarId}`, payload);
  return response.data;
}

export async function deleteCalendar(calendarId: number) {
  await api.delete(`/api/v1/calendars/${calendarId}`);
}

/** Adiciona os feriados nacionais brasileiros do ano (mantém os já cadastrados). */
export async function importHolidays(calendarId: number, year: number) {
  const response = await api.post<CalendarRead>(`/api/v1/calendars/${calendarId}/holidays/import`, { year });
  return response.data;
}

export async function checkCalendar(calendarId: number, atIso: string) {
  const response = await api.get<CalendarCheck>(`/api/v1/calendars/${calendarId}/check`, { params: { at: atIso } });
  return response.data;
}
