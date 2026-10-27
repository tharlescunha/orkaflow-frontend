import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, ListChecks, OctagonX, Plus, RotateCcw, ShieldCheck, SquareX } from "lucide-react";

import { ActionsMenu, type ActionItem } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ActiveFilterChips, FilterBar, Pagination, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { SearchableMultiSelect } from "@/components/common/searchable-multi-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { StatusBadge } from "@/components/common/status-badge";
import { TaskStuckBadge } from "@/components/common/task-stuck-badge";
import { getApiErrorMessage, withApiDetail } from "@/lib/api-error";
import { EMPTY, formatDuration, formatTimeSmart } from "@/lib/format";
import { rerunPayload } from "@/lib/run-task";
import { badge, btn, card, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { api } from "@/services/api/client";
import { listRunners } from "@/services/api/runners";
import {
  cancelTask,
  createTask,
  forceStopTask,
  getTask,
  requestStopTask,
  type TaskListItem,
  type TaskStatus,
} from "@/services/api/tasks";
import { toast } from "@/store/toast-store";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_MS = 10_000;

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "waiting", label: "Aguardando" },
  { value: "scheduled", label: "Agendada" },
  { value: "ready", label: "Pronta" },
  { value: "running", label: "Executando" },
  { value: "stop_requested", label: "Parada solicitada" },
  { value: "forced_stop", label: "Parada forçada" },
  { value: "finished", label: "Finalizada" },
  { value: "error", label: "Erro" },
  { value: "timeout", label: "Timeout" },
  { value: "canceled", label: "Cancelada" },
];

const STATUS_VALUES = new Set<string>(statusOptions.map((option) => option.value));
const FINAL_STATUSES: TaskStatus[] = ["finished", "error", "timeout", "canceled", "forced_stop"];

type FilterOptionItem = {
  id: number;
  name: string;
  label?: string | null;
};

type TaskFilterOptionsResponse = {
  automations: FilterOptionItem[];
  runners: FilterOptionItem[];
  statuses: TaskStatus[];
};

type TaskListResponse = {
  items: TaskListItem[];
  total: number;
};

// Ação que espera confirmação: qual task e o quê fazer com ela.
type PendingAction =
  | { kind: "cancel"; task: TaskListItem }
  | { kind: "request-stop"; task: TaskListItem }
  | { kind: "force-stop"; task: TaskListItem }
  | { kind: "rerun"; task: TaskListItem };

function canCancel(status: TaskStatus) {
  return status === "waiting" || status === "scheduled" || status === "ready";
}

function canStop(status: TaskStatus) {
  return status === "running" || status === "stop_requested";
}

function isFinal(status: TaskStatus) {
  return FINAL_STATUSES.includes(status);
}

function getStatusLabel(status: TaskStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function automationLabel(task: TaskListItem) {
  return task.automation_name || `Automação #${task.automation_id}`;
}

// Filtros na URL: "1,4,9" <-> [1, 4, 9].
function parseNumberList(value: string | null): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => Number(part))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function parseStatusList(value: string | null): TaskStatus[] {
  if (!value) return [];
  return value.split(",").filter((part): part is TaskStatus => STATUS_VALUES.has(part));
}

async function fetchTaskFilterOptions(): Promise<TaskFilterOptionsResponse> {
  const response = await api.get<TaskFilterOptionsResponse>("/api/v1/tasks/filter-options");
  return response.data;
}

async function fetchTasks(params: {
  skip: number;
  limit: number;
  statuses: TaskStatus[];
  automationIds: number[];
  runnerIds: number[];
}): Promise<TaskListResponse> {
  const response = await api.get<TaskListResponse>("/api/v1/tasks/", {
    params: {
      skip: params.skip,
      limit: params.limit,
      statuses: params.statuses,
      automation_ids: params.automationIds,
      runner_ids: params.runnerIds,
    },
    paramsSerializer: {
      indexes: null,
    },
  });

  return response.data;
}

export function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Os filtros vivem na URL: o link é compartilhável e o filtro sobrevive ao voltar do detalhe.
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const taskIdSearch = searchParams.get("q") ?? "";
  const selectedStatuses = useMemo(() => parseStatusList(searchParams.get("status")), [searchParams]);
  const selectedAutomationIds = useMemo(() => parseNumberList(searchParams.get("automation")), [searchParams]);
  const selectedRunnerIds = useMemo(() => parseNumberList(searchParams.get("runner")), [searchParams]);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const skip = (page - 1) * PAGE_SIZE;

  // Qualquer filtro novo volta para a primeira página (no handler, não em efeito).
  function updateParams(changes: Record<string, string | null>, resetPage = true) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === null || value === "") next.delete(key);
          else next.set(key, value);
        });
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true }
    );
  }

  const filterOptionsQuery = useQuery({
    queryKey: ["task-filter-options"],
    queryFn: fetchTaskFilterOptions,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const automationOptions = useMemo(
    () =>
      (filterOptionsQuery.data?.automations ?? []).map((item) => ({
        value: item.id,
        label: item.label || item.name,
      })),
    [filterOptionsQuery.data?.automations]
  );

  const runnerOptions = useMemo(
    () =>
      (filterOptionsQuery.data?.runners ?? []).map((item) => ({
        value: item.id,
        label: item.label || item.name,
      })),
    [filterOptionsQuery.data?.runners]
  );

  const availableStatuses = useMemo(() => {
    const backendStatuses = filterOptionsQuery.data?.statuses ?? [];
    if (backendStatuses.length > 0) {
      return statusOptions.filter((option) => backendStatuses.includes(option.value));
    }
    return statusOptions;
  }, [filterOptionsQuery.data?.statuses]);

  // mesmo cache do banner de saude: usado para explicar tasks paradas
  const runnersQuery = useQuery({
    queryKey: ["health", "runners"],
    queryFn: () => listRunners({ limit: 200 }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });

  const runnersById = useMemo(
    () => new Map((runnersQuery.data ?? []).map((runner) => [runner.id, runner])),
    [runnersQuery.data]
  );

  const tasksQuery = useQuery({
    queryKey: ["tasks", page, selectedStatuses, selectedAutomationIds, selectedRunnerIds],
    queryFn: () =>
      fetchTasks({
        skip,
        limit: PAGE_SIZE,
        statuses: selectedStatuses,
        automationIds: selectedAutomationIds,
        runnerIds: selectedRunnerIds,
      }),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  async function invalidateTasks() {
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  const cancelMutation = useMutation({
    mutationFn: cancelTask,
    onSuccess: async () => {
      toast.success("Task cancelada.");
      setPendingAction(null);
      await invalidateTasks();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cancelar a task.", error));
    },
  });

  const requestStopMutation = useMutation({
    mutationFn: requestStopTask,
    onSuccess: async () => {
      toast.success("Parada solicitada. O robô encerra com segurança no próximo ponto seguro.");
      setPendingAction(null);
      await invalidateTasks();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível solicitar a parada.", error));
    },
  });

  const forceStopMutation = useMutation({
    mutationFn: forceStopTask,
    onSuccess: async () => {
      toast.success("Parada forçada aplicada.");
      setPendingAction(null);
      await invalidateTasks();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível aplicar a parada forçada.", error));
    },
  });

  // A lista não traz os parâmetros: busca a task inteira antes de montar o payload.
  const rerunMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const original = await getTask(taskId);
      return createTask(rerunPayload(original));
    },
    onSuccess: async (response, taskId) => {
      toast.success(`Task #${response.task.id} criada a partir da #${taskId}.`);
      setPendingAction(null);
      await invalidateTasks();
      navigate(`/tasks/${response.task.id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível rodar a task de novo."));
    },
  });

  const actionPending =
    cancelMutation.isPending || requestStopMutation.isPending || forceStopMutation.isPending || rerunMutation.isPending;

  const items = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data?.items]);
  const total = tasksQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Busca por ID é local, só na página carregada (a API não filtra por ID parcial).
  const filteredItems = useMemo(() => {
    const term = taskIdSearch.trim();
    if (!term) return items;
    return items.filter((task) => String(task.id).includes(term));
  }, [items, taskIdSearch]);

  const automationNames = useMemo(
    () => new Map((filterOptionsQuery.data?.automations ?? []).map((item) => [item.id, item.label || item.name])),
    [filterOptionsQuery.data?.automations]
  );

  const runnerNames = useMemo(
    () => new Map((filterOptionsQuery.data?.runners ?? []).map((item) => [item.id, item.label || item.name])),
    [filterOptionsQuery.data?.runners]
  );

  const hasActiveFilters =
    taskIdSearch !== "" || selectedStatuses.length > 0 || selectedAutomationIds.length > 0 || selectedRunnerIds.length > 0;

  function changeStatuses(next: TaskStatus[]) {
    updateParams({ status: next.join(",") });
  }

  function changeAutomations(next: number[]) {
    updateParams({ automation: next.join(",") });
  }

  function changeRunners(next: number[]) {
    updateParams({ runner: next.join(",") });
  }

  function changeSearch(value: string) {
    updateParams({ q: value });
  }

  function clearFilters() {
    updateParams({ q: null, status: null, automation: null, runner: null });
  }

  function changePage(next: number) {
    updateParams({ page: next <= 1 ? null : String(next) }, false);
  }

  async function handleRefresh() {
    await tasksQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: ["task-filter-options"] });
  }

  const chips = [
    ...(taskIdSearch ? [{ key: "q", label: `ID: ${taskIdSearch}`, onRemove: () => changeSearch("") }] : []),
    ...selectedStatuses.map((status) => ({
      key: `status-${status}`,
      label: `Status: ${getStatusLabel(status)}`,
      onRemove: () => changeStatuses(selectedStatuses.filter((item) => item !== status)),
    })),
    ...selectedAutomationIds.map((id) => ({
      key: `automation-${id}`,
      label: `Automação: ${automationNames.get(id) ?? `#${id}`}`,
      onRemove: () => changeAutomations(selectedAutomationIds.filter((item) => item !== id)),
    })),
    ...selectedRunnerIds.map((id) => ({
      key: `runner-${id}`,
      label: `Runner: ${runnerNames.get(id) ?? `#${id}`}`,
      onRemove: () => changeRunners(selectedRunnerIds.filter((item) => item !== id)),
    })),
  ];

  function buildActions(task: TaskListItem): ActionItem[] {
    const actions: ActionItem[] = [{ label: "Ver", icon: Eye, onSelect: () => navigate(`/tasks/${task.id}`) }];

    if (canStop(task.status)) {
      actions.push({
        label: "Parar com segurança",
        icon: ShieldCheck,
        separatorBefore: true,
        disabled: actionPending || task.status === "stop_requested" || task.stop_requested,
        onSelect: () => setPendingAction({ kind: "request-stop", task }),
      });
      actions.push({
        label: "Parada forçada",
        icon: OctagonX,
        tone: "danger",
        disabled: actionPending,
        onSelect: () => setPendingAction({ kind: "force-stop", task }),
      });
    }

    if (canCancel(task.status)) {
      actions.push({
        label: "Cancelar",
        icon: SquareX,
        tone: "danger",
        separatorBefore: true,
        disabled: actionPending,
        onSelect: () => setPendingAction({ kind: "cancel", task }),
      });
    }

    if (isFinal(task.status)) {
      actions.push({
        label: "Rodar de novo",
        icon: RotateCcw,
        separatorBefore: true,
        disabled: actionPending,
        onSelect: () => setPendingAction({ kind: "rerun", task }),
      });
    }

    return actions;
  }

  function handleConfirmAction() {
    if (!pendingAction) return;
    const taskId = pendingAction.task.id;
    if (pendingAction.kind === "cancel") cancelMutation.mutate(taskId);
    else if (pendingAction.kind === "request-stop") requestStopMutation.mutate(taskId);
    else if (pendingAction.kind === "force-stop") forceStopMutation.mutate(taskId);
    else rerunMutation.mutate(taskId);
  }

  const newTaskButton = (
    <Link to="/tasks/new" className={btn.primary}>
      <Plus className="h-4 w-4" />
      Nova task
    </Link>
  );

  return (
    <section className={card}>
      <PageHeader
        title="Tasks"
        description="Fila de execução e acompanhamento operacional, mais recentes primeiro."
        actions={
          <>
            <RefreshIndicator
              updatedAt={tasksQuery.dataUpdatedAt}
              isFetching={tasksQuery.isFetching}
              onRefresh={handleRefresh}
              intervalMs={REFRESH_INTERVAL_MS}
            />
            {newTaskButton}
          </>
        }
      />

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <SearchInput value={taskIdSearch} onChange={changeSearch} placeholder="Buscar por ID da task" className="sm:w-56" />

        <SearchableMultiSelect
          label="Status"
          options={availableStatuses}
          selectedValues={selectedStatuses}
          onChange={changeStatuses}
          disabled={filterOptionsQuery.isLoading}
          emptyText="Nenhum status disponível."
          searchPlaceholder="Buscar status..."
          className="w-full sm:w-52"
        />

        <SearchableMultiSelect
          label="Automação"
          options={automationOptions}
          selectedValues={selectedAutomationIds}
          onChange={changeAutomations}
          disabled={filterOptionsQuery.isLoading}
          emptyText="Nenhuma automação ativa disponível."
          searchPlaceholder="Buscar automação..."
          className="w-full sm:w-64"
        />

        <SearchableMultiSelect
          label="Runner"
          options={runnerOptions}
          selectedValues={selectedRunnerIds}
          onChange={changeRunners}
          disabled={filterOptionsQuery.isLoading}
          emptyText="Nenhum runner ativo disponível."
          searchPlaceholder="Buscar runner..."
          className="w-full sm:w-52"
        />
      </FilterBar>

      <ActiveFilterChips chips={chips} />

      {tasksQuery.isLoading ? (
        <TableSkeleton rows={8} columns={7} />
      ) : tasksQuery.isError ? (
        <div className="p-5">
          <QueryError
            error={tasksQuery.error}
            what="a fila de tasks"
            onRetry={() => tasksQuery.refetch()}
            retrying={tasksQuery.isFetching}
          />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={hasActiveFilters ? "Nenhuma task com esses filtros" : "Nenhuma task na fila"}
          description={
            hasActiveFilters
              ? "Tente outro ID ou limpe os filtros."
              : "Crie uma task manual ou aguarde o próximo agendamento."
          }
          action={
            hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className={btn.secondary}>
                Limpar filtros
              </button>
            ) : (
              newTaskButton
            )
          }
        />
      ) : (
        <>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>ID</th>
                  <th className={table.th}>Estado</th>
                  <th className={table.th}>Automação</th>
                  <th className={table.th}>Runner</th>
                  <th className={table.th}>Última atualização</th>
                  <th className={table.th}>Criada em</th>
                  <th className={table.th}>Duração</th>
                  <th className={table.th}>Prioridade</th>
                  <th className={table.th}>Mensagem final</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((task) => {
                  const failed = task.status === "error" || task.status === "timeout";
                  return (
                    <tr
                      key={task.id}
                      className={cn(table.trClickable, failed && "bg-red-50/40 hover:bg-red-50/70")}
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <td className={cn(table.tdMuted, "tabular-nums text-[13px]")}>#{task.id}</td>
                      <td className={table.td}>
                        <StatusBadge status={task.status} />
                        {task.execution_mode === "retry" && (task.retry_count ?? 0) > 0 && (
                          <span
                            className={cn(badge, tone.info, "mt-1")}
                            title={task.parent_task_id ? `Tentativa automática da task #${task.parent_task_id}` : undefined}
                          >
                            tentativa {task.retry_count}
                          </span>
                        )}
                        {task.execution_mode === "trigger" && task.parent_task_id && (
                          <span
                            className={cn(badge, tone.info, "mt-1")}
                            title={`Disparada pelo gatilho de sucesso da task #${task.parent_task_id}`}
                          >
                            gatilho da #{task.parent_task_id}
                          </span>
                        )}
                        <div>
                          <TaskStuckBadge
                            task={task}
                            runner={task.runner_id ? runnersById.get(task.runner_id) : null}
                            waitingReason={task.waiting_reason}
                          />
                        </div>
                        {task.status === "waiting" && task.waiting_reason ? (
                          <p
                            className="mt-1 max-w-[260px] truncate text-[11px] text-amber-700"
                            title={task.waiting_reason}
                          >
                            {task.waiting_reason}
                          </p>
                        ) : null}
                      </td>
                      <td className={table.td}>
                        <span className={table.truncate} title={automationLabel(task)}>
                          {automationLabel(task)}
                        </span>
                      </td>
                      <td className={table.tdMuted}>
                        <span className="block max-w-[200px] truncate" title={task.runner_name || undefined}>
                          {task.runner_name || (task.runner_id ? `Runner #${task.runner_id}` : EMPTY)}
                        </span>
                      </td>
                      <td className={cn(table.tdMuted, "whitespace-nowrap tabular-nums")}>{formatTimeSmart(task.last_update_at)}</td>
                      <td className={cn(table.tdMuted, "whitespace-nowrap tabular-nums")}>{formatTimeSmart(task.created_at)}</td>
                      <td className={cn(table.tdMuted, "whitespace-nowrap tabular-nums")}>
                        {formatDuration(task.execution_duration_seconds)}
                      </td>
                      <td className={cn(table.tdMuted, "tabular-nums")}>{task.priority}</td>
                      <td className={table.tdMuted}>
                        <span className={cn(table.truncate, failed && "text-red-700")} title={task.final_message || undefined}>
                          {task.final_message || EMPTY}
                        </span>
                      </td>
                      <td className={table.tdRight}>
                        <ActionsMenu label={`Ações da task #${task.id}`} items={buildActions(task)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} total={total} onChange={changePage} label="tasks" />
        </>
      )}

      <ConfirmDialog
        open={pendingAction?.kind === "cancel"}
        title={`Cancelar a task #${pendingAction?.task.id}?`}
        description={`A task da automação ${pendingAction ? automationLabel(pendingAction.task) : ""} sai da fila e não é executada.`}
        confirmLabel="Cancelar task"
        cancelLabel="Voltar"
        tone="warning"
        isPending={cancelMutation.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.kind === "request-stop"}
        title={`Parar a task #${pendingAction?.task.id} com segurança?`}
        description="O robô recebe o pedido e encerra no próximo ponto seguro. Pode levar alguns minutos."
        confirmLabel="Parar com segurança"
        cancelLabel="Voltar"
        isPending={requestStopMutation.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.kind === "force-stop"}
        title={`Parada forçada da task #${pendingAction?.task.id}`}
        description="O processo é interrompido na hora, sem esperar o robô terminar o que estava fazendo. Itens em andamento podem ficar pela metade. Use só quando a parada segura não funcionou."
        confirmLabel="Forçar parada"
        cancelLabel="Voltar"
        tone="danger"
        requireText={pendingAction ? String(pendingAction.task.id) : undefined}
        isPending={forceStopMutation.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingAction?.kind === "rerun"}
        title={`Rodar de novo a task #${pendingAction?.task.id}?`}
        description={`Uma nova task da automação ${pendingAction ? automationLabel(pendingAction.task) : ""} é criada com os mesmos parâmetros e entra na fila agora.`}
        confirmLabel="Rodar de novo"
        cancelLabel="Voltar"
        isPending={rerunMutation.isPending}
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  );
}
