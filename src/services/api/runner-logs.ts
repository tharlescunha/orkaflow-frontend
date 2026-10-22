import { api } from "./client";

export type RunnerLogSource = "worker" | "bot";

export type RunnerLogLine = {
  id: number;
  runner_id: number;
  logged_at: string;
  level: string;
  source: RunnerLogSource;
  task_id?: number | null;
  message: string;
};

export type RunnerLogPage = {
  items: RunnerLogLine[];
  last_id?: number | null;
  retention_days: number;
};

export type ListRunnerLogsParams = {
  runner_id: number;
  // Sem after_id: as últimas linhas. Com after_id: só as novas (polling).
  after_id?: number;
  limit?: number;
  source?: RunnerLogSource;
  task_id?: number;
  level?: string;
  search?: string;
};

export async function listRunnerLogs(params: ListRunnerLogsParams) {
  const response = await api.get<RunnerLogPage>("/api/v1/runner-logs/", {
    params,
  });

  return response.data;
}
