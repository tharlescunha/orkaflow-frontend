import { api } from "./client";

export type TaskErrorCategory =
  | "business"
  | "application"
  | "system"
  | "validation"
  | "integration"
  | "security"
  | string;

export type TaskErrorSource =
  | "worker"
  | "bot"
  | "orchestrator"
  | "system"
  | "api"
  | string;

export type TaskErrorBase = {
  id: number;
  task_id: number;
  error_type: string;
  message: string;
  stacktrace: string | null;
  error_category: TaskErrorCategory | null;
  is_retryable: boolean;
  source: TaskErrorSource | null;
  code: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type TaskErrorListItem = TaskErrorBase;

export type TaskErrorRichListItem = TaskErrorBase & {
  task_status?: string | null;

  automation_id?: number | null;
  automation_name?: string | null;
  automation_label?: string | null;

  bot_id?: number | null;
  bot_name?: string | null;

  bot_version_id?: number | null;
  bot_version_label?: string | null;

  repository_id?: number | null;
  repository_name?: string | null;

  runner_id?: number | null;
  runner_name?: string | null;
  runner_label?: string | null;

  created_by?: number | null;
  created_by_name?: string | null;

  final_message?: string | null;

  task_created_at?: string | null;
  task_started_at?: string | null;
  task_finished_at?: string | null;

  execution_duration_seconds?: number | null;
};

export type TaskErrorRead = TaskErrorRichListItem;

export type TaskErrorListResponse = {
  items: TaskErrorListItem[];
  total: number;
};

export type TaskErrorRichListResponse = {
  items: TaskErrorRichListItem[];
  total: number;
};

export type ListTaskErrorsByTaskParams = {
  taskId: number;
  skip?: number;
  limit?: number;
  error_type?: string;
};

export type ListAllTaskErrorsParams = {
  skip?: number;
  limit?: number;
  q?: string;
  task_id?: number;
  automation_id?: number;
  error_type?: string;
  error_category?: string;
  source?: string;
  code?: string;
  is_retryable?: boolean;
  start_date?: string;
  end_date?: string;
  ordering?: string;
};

export async function listTaskErrorsByTask(
  params: ListTaskErrorsByTaskParams
) {
  const response = await api.get<TaskErrorListResponse>(
    `/api/v1/task-errors/task/${params.taskId}`,
    {
      params: {
        skip: params.skip ?? 0,
        limit: params.limit ?? 100,
        error_type: params.error_type || undefined,
      },
    }
  );

  return response.data;
}

export async function getTaskError(errorId: number) {
  const response = await api.get<TaskErrorRead>(`/api/v1/task-errors/${errorId}`);
  return response.data;
}

export async function listTaskErrors(params: ListAllTaskErrorsParams = {}) {
  const response = await api.get<TaskErrorRichListResponse>(
    "/api/v1/task-errors",
    {
      params: {
        skip: params.skip ?? 0,
        limit: params.limit ?? 10,
        q: params.q || undefined,
        task_id: params.task_id,
        automation_id: params.automation_id,
        error_type: params.error_type || undefined,
        error_category: params.error_category || undefined,
        source: params.source || undefined,
        code: params.code || undefined,
        is_retryable:
          typeof params.is_retryable === "boolean"
            ? params.is_retryable
            : undefined,
        start_date: params.start_date || undefined,
        end_date: params.end_date || undefined,
        ordering: params.ordering || undefined,
      },
    }
  );

  return response.data;
}
