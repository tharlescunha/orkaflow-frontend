import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRunners, type RunnerRead } from "@/services/api/runners";
import { listTasks, type TaskListItem } from "@/services/api/tasks";
import { listTaskErrors } from "@/services/api/task-errors";
import {
  STUCK_TASK_MINUTES,
  describeRunnerProblem,
  getRunnerHealth,
  minutesSince,
  parseApiDate,
} from "@/lib/health";

export const HEALTH_POLL_MS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pollOptions = {
  refetchInterval: HEALTH_POLL_MS,
  refetchIntervalInBackground: false,
} as const;

export type ProblemRunner = {
  runner: RunnerRead;
  reason: string;
};

export type StuckTask = {
  task: TaskListItem;
  minutes: number;
};

export type SystemHealth = {
  failedTasks: TaskListItem[];
  problemRunners: ProblemRunner[];
  stuckTasks: StuckTask[];
  errors24h: number;
  total: number;
  isLoading: boolean;
};

function taskReferenceDate(task: TaskListItem) {
  return task.finished_at ?? task.last_update_at ?? task.created_at;
}

export function useSystemHealth(): SystemHealth {
  const runnersQuery = useQuery({
    queryKey: ["health", "runners"],
    queryFn: () => listRunners({ limit: 200 }),
    ...pollOptions,
  });

  const failedQuery = useQuery({
    queryKey: ["health", "failed-tasks"],
    queryFn: () =>
      listTasks({ statuses: ["error", "timeout", "forced_stop"], limit: 200 }),
    ...pollOptions,
  });

  const pendingQuery = useQuery({
    queryKey: ["health", "pending-tasks"],
    queryFn: () => listTasks({ statuses: ["waiting", "ready"], limit: 200 }),
    ...pollOptions,
  });

  const errorsQuery = useQuery({
    queryKey: ["health", "errors-24h"],
    queryFn: () =>
      listTaskErrors({
        limit: 1,
        start_date: new Date(Date.now() - DAY_MS).toISOString(),
      }),
    ...pollOptions,
  });

  const runners = runnersQuery.data;
  const failedItems = failedQuery.data?.items;
  const pendingItems = pendingQuery.data?.items;
  const dataUpdatedAt = Math.max(
    runnersQuery.dataUpdatedAt,
    failedQuery.dataUpdatedAt,
    pendingQuery.dataUpdatedAt
  );

  return useMemo(() => {
    // referencia de tempo = momento do ultimo poll (recalcula a cada 20s)
    const now = dataUpdatedAt;

    const failedTasks = (failedItems ?? []).filter((task) => {
      const date = parseApiDate(taskReferenceDate(task));
      return date !== null && now - date.getTime() <= DAY_MS;
    });

    const problemRunners: ProblemRunner[] = [];
    for (const runner of runners ?? []) {
      const reason = describeRunnerProblem(getRunnerHealth(runner, now));
      if (reason) problemRunners.push({ runner, reason });
    }

    const stuckTasks: StuckTask[] = [];
    for (const task of pendingItems ?? []) {
      const since = task.requested_start_at ?? task.created_at;
      const parsed = parseApiDate(since);
      if (!parsed || parsed.getTime() > now) continue; // agendada para o futuro
      const minutes = minutesSince(since, now) ?? 0;
      if (minutes >= STUCK_TASK_MINUTES) stuckTasks.push({ task, minutes });
    }

    return {
      failedTasks,
      problemRunners,
      stuckTasks,
      errors24h: errorsQuery.data?.total ?? 0,
      total: failedTasks.length + problemRunners.length + stuckTasks.length,
      isLoading:
        runnersQuery.isLoading || failedQuery.isLoading || pendingQuery.isLoading,
    };
  }, [
    runners,
    failedItems,
    pendingItems,
    dataUpdatedAt,
    errorsQuery.data?.total,
    runnersQuery.isLoading,
    failedQuery.isLoading,
    pendingQuery.isLoading,
  ]);
}
