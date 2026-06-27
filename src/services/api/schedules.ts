import { api } from "./client";
import type {
  CreateSchedulePayload,
  ListSchedulesParams,
  ScheduleRead,
  UpdateSchedulePayload,
} from "@/types/schedule";

export async function listSchedules(params?: ListSchedulesParams) {
  const response = await api.get<ScheduleRead[]>("/api/v1/schedules/", {
    params,
  });

  return response.data;
}

export async function getSchedule(scheduleId: number) {
  const response = await api.get<ScheduleRead>(`/api/v1/schedules/${scheduleId}`);
  return response.data;
}

export async function createSchedule(payload: CreateSchedulePayload) {
  const response = await api.post<ScheduleRead>("/api/v1/schedules/", payload);
  return response.data;
}

export async function updateSchedule(
  scheduleId: number,
  payload: UpdateSchedulePayload
) {
  const response = await api.put<ScheduleRead>(
    `/api/v1/schedules/${scheduleId}`,
    payload
  );

  return response.data;
}

export async function pauseSchedule(scheduleId: number) {
  const response = await api.post<ScheduleRead>(
    `/api/v1/schedules/${scheduleId}/pause`
  );

  return response.data;
}

export async function reactivateSchedule(scheduleId: number) {
  const response = await api.post<ScheduleRead>(
    `/api/v1/schedules/${scheduleId}/reactivate`
  );

  return response.data;
}

export async function deactivateSchedule(scheduleId: number) {
  const response = await api.post<ScheduleRead>(
    `/api/v1/schedules/${scheduleId}/deactivate`
  );

  return response.data;
}
