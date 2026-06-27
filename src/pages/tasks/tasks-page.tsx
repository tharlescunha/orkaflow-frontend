import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  MoreVertical,
  OctagonX,
  RefreshCcw,
  Search,
  SquareX,
  X,
} from "lucide-react";

import { api } from "@/services/api/client";
import {
  cancelTask,
  forceStopTask,
  type TaskListItem,
  type TaskStatus,
} from "@/services/api/tasks";
import { StatusBadge } from "@/components/common/status-badge";

const PAGE_SIZE = 10;
const REFRESH_INTERVAL_SECONDS = 10;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_SECONDS * 1000;

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "waiting", label: "Aguardando" },
  { value: "scheduled", label: "Agendada" },
  { value: "ready", label: "Pronta" },
  { value: "running", label: "Executando" },
  { value: "stop_requested", label: "Parada solicitada" },
  { value: "forced_stop", label: "Força parada" },
  { value: "finished", label: "Finalizada" },
  { value: "error", label: "Erro" },
  { value: "timeout", label: "Timeout" },
  { value: "canceled", label: "Cancelada" },
];

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

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

type FilterMenu = "status" | "automation" | "runner" | null;

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "---";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function truncateText(value?: string | null, max = 55) {
  if (!value) return "---";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function canCancel(status: TaskStatus) {
  return ["waiting", "scheduled", "ready"].includes(status);
}

function canForceStop(status: TaskStatus) {
  return ["running", "stop_requested"].includes(status);
}

function getStatusLabel(status: TaskStatus) {
  return (
    statusOptions.find((option) => option.value === status)?.label ?? status
  );
}

function getFilterButtonText(
  label: string,
  count: number,
  firstLabel?: string | null
) {
  if (count === 0) return label;
  if (count === 1 && firstLabel) return firstLabel;
  return `${label} (${count})`;
}

function arrayEquals<T>(a: T[], b: T[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

async function fetchTaskFilterOptions(): Promise<TaskFilterOptionsResponse> {
  const response = await api.get<TaskFilterOptionsResponse>(
    "/api/v1/tasks/filter-options"
  );
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

type MultiSelectDropdownProps<TValue extends string | number> = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  options: Array<{
    value: TValue;
    label: string;
  }>;
  selectedValues: TValue[];
  onChange: (next: TValue[]) => void;
  disabled?: boolean;
  emptyText?: string;
};

function MultiSelectDropdown<TValue extends string | number>({
  label,
  isOpen,
  onToggle,
  options,
  selectedValues,
  onChange,
  disabled = false,
  emptyText = "Nenhuma opção disponível.",
}: MultiSelectDropdownProps<TValue>) {
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  function handleToggleValue(value: TValue) {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value));
      return;
    }

    onChange([...selectedValues, value]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-3 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate text-left">
          {getFilterButtonText(label, selectedValues.length, selectedLabels[0])}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-12 z-40 w-full min-w-[280px] border border-slate-200 bg-white shadow-lg">
          <div className="max-h-72 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500">{emptyText}</div>
            ) : (
              options.map((option) => {
                const checked = selectedValues.includes(option.value);

                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => handleToggleValue(option.value)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center border ${
                        checked
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-3 w-3" />
                    </span>

                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function TasksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filtersAreaRef = useRef<HTMLDivElement | null>(null);

  const [page, setPage] = useState(1);
  const [taskIdSearch, setTaskIdSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [selectedAutomationIds, setSelectedAutomationIds] = useState<number[]>(
    []
  );
  const [selectedRunnerIds, setSelectedRunnerIds] = useState<number[]>([]);
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenu>(null);
  const [actionMenuTaskId, setActionMenuTaskId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_SECONDS);

  const skip = (page - 1) * PAGE_SIZE;

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

  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      page,
      selectedStatuses,
      selectedAutomationIds,
      selectedRunnerIds,
    ],
    queryFn: () =>
      fetchTasks({
        skip,
        limit: PAGE_SIZE,
        statuses: selectedStatuses,
        automationIds: selectedAutomationIds,
        runnerIds: selectedRunnerIds,
      }),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!filtersAreaRef.current || !target) return;
      if (!filtersAreaRef.current.contains(target)) {
        setOpenFilterMenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setCountdown(REFRESH_INTERVAL_SECONDS);
  }, [page, selectedStatuses, selectedAutomationIds, selectedRunnerIds]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) return REFRESH_INTERVAL_SECONDS;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tasksQuery.dataUpdatedAt) {
      setCountdown(REFRESH_INTERVAL_SECONDS);
    }
  }, [tasksQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => {
      setToast(null);
    }, 8000);

    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [selectedStatuses, selectedAutomationIds, selectedRunnerIds]);

  const cancelMutation = useMutation({
    mutationFn: cancelTask,
    onSuccess: async () => {
      setToast({
        type: "success",
        message: "Task cancelada com sucesso.",
      });

      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível cancelar a task.",
      });
    },
  });

  const forceStopMutation = useMutation({
    mutationFn: forceStopTask,
    onSuccess: async () => {
      setToast({
        type: "success",
        message: "Força parada aplicada com sucesso.",
      });

      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível aplicar força parada.",
      });
    },
  });

  const items = tasksQuery.data?.items ?? [];
  const total = tasksQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const filteredItems = useMemo(() => {
    if (!taskIdSearch.trim()) return items;

    return items.filter((task) =>
      String(task.id).includes(taskIdSearch.trim())
    );
  }, [items, taskIdSearch]);

  const selectedAutomationMap = useMemo(() => {
    return new Map(
      (filterOptionsQuery.data?.automations ?? []).map((item) => [
        item.id,
        item.label || item.name,
      ])
    );
  }, [filterOptionsQuery.data?.automations]);

  const selectedRunnerMap = useMemo(() => {
    return new Map(
      (filterOptionsQuery.data?.runners ?? []).map((item) => [
        item.id,
        item.label || item.name,
      ])
    );
  }, [filterOptionsQuery.data?.runners]);

  const hasAnyFilter =
    selectedStatuses.length > 0 ||
    selectedAutomationIds.length > 0 ||
    selectedRunnerIds.length > 0;

  async function handleRefresh() {
    setCountdown(REFRESH_INTERVAL_SECONDS);
    await tasksQuery.refetch();
    await queryClient.invalidateQueries({ queryKey: ["task-filter-options"] });
  }

  function openInfo(taskId: number) {
    setActionMenuTaskId(null);
    navigate(`/tasks/${taskId}`);
  }

  function clearAllFilters() {
    setSelectedStatuses([]);
    setSelectedAutomationIds([]);
    setSelectedRunnerIds([]);
    setOpenFilterMenu(null);
  }

  function removeStatusFilter(status: TaskStatus) {
    setSelectedStatuses((current) => current.filter((item) => item !== status));
  }

  function removeAutomationFilter(automationId: number) {
    setSelectedAutomationIds((current) =>
      current.filter((item) => item !== automationId)
    );
  }

  function removeRunnerFilter(runnerId: number) {
    setSelectedRunnerIds((current) => current.filter((item) => item !== runnerId));
  }

  function handleStatusesChange(next: TaskStatus[]) {
    if (!arrayEquals(next, selectedStatuses)) {
      setSelectedStatuses(next);
    }
  }

  function handleAutomationIdsChange(next: number[]) {
    if (!arrayEquals(next, selectedAutomationIds)) {
      setSelectedAutomationIds(next);
    }
  }

  function handleRunnerIdsChange(next: number[]) {
    if (!arrayEquals(next, selectedRunnerIds)) {
      setSelectedRunnerIds(next);
    }
  }

  return (
    <>
      {actionMenuTaskId ? (
        <button
          type="button"
          aria-label="Fechar menu de ações"
          onClick={() => setActionMenuTaskId(null)}
          className="fixed inset-0 z-10 bg-transparent"
        />
      ) : null}

      <div className="space-y-5">
        {toast ? (
          <div
            className={`fixed right-6 top-20 z-[80] flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <X className="mt-0.5 h-5 w-5 shrink-0" />
            )}

            <div className="pr-4 text-sm font-medium">{toast.message}</div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-current/70 transition hover:text-current"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">
                  Tasks
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Fila de execução e acompanhamento operacional.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  Atualização automática em{" "}
                  <span className="font-semibold">{countdown}s</span>
                </div>

                <button
                  onClick={handleRefresh}
                  className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar
                </button>

                <Link
                  to="/tasks/new"
                  className="inline-flex h-10 items-center gap-2 border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Nova task
                </Link>
              </div>
            </div>
          </div>

          <div
            ref={filtersAreaRef}
            className="border-b border-slate-200 bg-slate-50/60 px-6 py-4"
          >
            <div className="grid gap-3 xl:grid-cols-[260px_260px_260px_220px_1fr]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={taskIdSearch}
                  onChange={(e) => setTaskIdSearch(e.target.value)}
                  placeholder="Buscar por ID da task"
                  className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  type="text"
                />
              </div>

              <MultiSelectDropdown
                label="Status"
                isOpen={openFilterMenu === "status"}
                onToggle={() =>
                  setOpenFilterMenu((current) =>
                    current === "status" ? null : "status"
                  )
                }
                options={availableStatuses}
                selectedValues={selectedStatuses}
                onChange={handleStatusesChange}
                disabled={filterOptionsQuery.isLoading}
                emptyText="Nenhum status disponível."
              />

              <MultiSelectDropdown
                label="Automação"
                isOpen={openFilterMenu === "automation"}
                onToggle={() =>
                  setOpenFilterMenu((current) =>
                    current === "automation" ? null : "automation"
                  )
                }
                options={automationOptions}
                selectedValues={selectedAutomationIds}
                onChange={handleAutomationIdsChange}
                disabled={filterOptionsQuery.isLoading}
                emptyText="Nenhuma automação ativa disponível."
              />

              <MultiSelectDropdown
                label="Runner"
                isOpen={openFilterMenu === "runner"}
                onToggle={() =>
                  setOpenFilterMenu((current) =>
                    current === "runner" ? null : "runner"
                  )
                }
                options={runnerOptions}
                selectedValues={selectedRunnerIds}
                onChange={handleRunnerIdsChange}
                disabled={filterOptionsQuery.isLoading}
                emptyText="Nenhum runner ativo disponível."
              />

              <div className="flex h-10 items-center justify-between gap-3 border border-slate-200 bg-white px-3 text-sm text-slate-500">
                <span>Ordenação: mais recentes primeiro</span>

                {hasAnyFilter ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 transition hover:text-slate-950"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar
                  </button>
                ) : null}
              </div>
            </div>

            {hasAnyFilter ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedStatuses.map((status) => (
                  <button
                    key={`status-${status}`}
                    type="button"
                    onClick={() => removeStatusFilter(status)}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>Status: {getStatusLabel(status)}</span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}

                {selectedAutomationIds.map((automationId) => (
                  <button
                    key={`automation-${automationId}`}
                    type="button"
                    onClick={() => removeAutomationFilter(automationId)}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>
                      Automação:{" "}
                      {selectedAutomationMap.get(automationId) ||
                        `Automação #${automationId}`}
                    </span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}

                {selectedRunnerIds.map((runnerId) => (
                  <button
                    key={`runner-${runnerId}`}
                    type="button"
                    onClick={() => removeRunnerFilter(runnerId)}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <span>
                      Runner:{" "}
                      {selectedRunnerMap.get(runnerId) || `Runner #${runnerId}`}
                    </span>
                    <X className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1520px] w-full">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    ID
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Prioridade
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Estado
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Última atualização
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Automação
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Runner
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Criada em
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tempo execução
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Mensagem final
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {tasksQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Carregando tasks...
                    </td>
                  </tr>
                ) : tasksQuery.isError ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      Erro ao carregar a fila de tasks.
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Nenhuma task encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      actionMenuTaskId={actionMenuTaskId}
                      setActionMenuTaskId={setActionMenuTaskId}
                      onOpenInfo={openInfo}
                      onCancel={(taskId) => cancelMutation.mutate(taskId)}
                      onForceStop={(taskId) => forceStopMutation.mutate(taskId)}
                      loadingCancel={cancelMutation.isPending}
                      loadingForceStop={forceStopMutation.isPending}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {total === 0
                ? "0 resultados"
                : `${skip + 1} a ${Math.min(skip + PAGE_SIZE, total)} de ${total}`}
            </p>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="px-2 text-sm text-slate-600">
                Página {page} de {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

type TaskRowProps = {
  task: TaskListItem & { final_message?: string | null };
  actionMenuTaskId: number | null;
  setActionMenuTaskId: (taskId: number | null) => void;
  onOpenInfo: (taskId: number) => void;
  onCancel: (taskId: number) => void;
  onForceStop: (taskId: number) => void;
  loadingCancel: boolean;
  loadingForceStop: boolean;
};

function TaskRow({
  task,
  actionMenuTaskId,
  setActionMenuTaskId,
  onOpenInfo,
  onCancel,
  onForceStop,
  loadingCancel,
  loadingForceStop,
}: TaskRowProps) {
  const isOpen = actionMenuTaskId === task.id;

  return (
    <tr className="border-b border-slate-200 transition hover:bg-slate-50/70">
      <td className="px-4 py-3 text-sm font-medium text-blue-700">
        <button
          type="button"
          onClick={() => onOpenInfo(task.id)}
          className="transition hover:text-blue-900"
        >
          {task.id}
        </button>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">{task.priority}</td>

      <td className="px-4 py-3">
        <StatusBadge status={task.status} />
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDateTime(task.last_update_at)}
      </td>

      <td
        className="max-w-[260px] px-4 py-3 text-sm text-slate-700"
        title={task.automation_name || undefined}
      >
        {truncateText(
          task.automation_name || `Automação #${task.automation_id}`,
          35
        )}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {task.runner_name || (task.runner_id ? `Runner #${task.runner_id}` : "---")}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDateTime(task.created_at)}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDuration(task.execution_duration_seconds)}
      </td>

      <td
        className="max-w-[260px] px-4 py-3 text-sm text-slate-700"
        title={task.final_message || undefined}
      >
        {truncateText(task.final_message, 45)}
      </td>

      <td className="relative px-4 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActionMenuTaskId(isOpen ? null : task.id);
          }}
          className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isOpen ? (
          <div className="absolute right-4 top-12 z-30 w-52 border border-slate-200 bg-white p-2 shadow-lg">
            <button
              type="button"
              onClick={() => onOpenInfo(task.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <Eye className="h-4 w-4" />
              Informações
            </button>

            {canCancel(task.status) ? (
              <button
                type="button"
                disabled={loadingCancel}
                onClick={() => {
                  onCancel(task.id);
                  setActionMenuTaskId(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
              >
                <SquareX className="h-4 w-4" />
                Cancelar
              </button>
            ) : null}

            {canForceStop(task.status) ? (
              <button
                type="button"
                disabled={loadingForceStop}
                onClick={() => {
                  onForceStop(task.id);
                  setActionMenuTaskId(null);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                <OctagonX className="h-4 w-4" />
                Força parada
              </button>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}
