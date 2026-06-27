import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  MoreVertical,
  Pencil,
  Power,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import {
  activateRunner,
  disableRunner,
  listRunners,
  type RunnerRead,
} from "@/services/api/runners";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatRunnerStatus(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "busy":
      return "Ocupado";
    case "maintenance":
      return "Manutenção";
    case "blocked":
      return "Bloqueado";
    default:
      return status || "---";
  }
}

function getRunnerStatusClass(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "busy":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "maintenance":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "blocked":
      return "border-red-200 bg-red-50 text-red-700";
    case "offline":
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getEnabledClass(enabled: boolean) {
  return enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-600";
}

type EnabledFilter = "all" | "true" | "false";

type MenuState = {
  runner: RunnerRead;
  anchorRect: DOMRect;
} | null;

export function RunnerConfigsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");
  const [openMenu, setOpenMenu] = useState<MenuState>(null);
  const [confirmRunner, setConfirmRunner] = useState<RunnerRead | null>(null);

  const queryParams = useMemo(() => {
    return {
      status: statusFilter || undefined,
      enabled:
        enabledFilter === "all"
          ? undefined
          : enabledFilter === "true"
          ? true
          : false,
      limit: 100,
      skip: 0,
    };
  }, [statusFilter, enabledFilter]);

  const runnersQuery = useQuery({
    queryKey: ["runners", queryParams],
    queryFn: () => listRunners(queryParams),
    refetchInterval: 10000,
  });

  const activateMutation = useMutation({
    mutationFn: (runnerId: number) => activateRunner(runnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      setConfirmRunner(null);
      setOpenMenu(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: (runnerId: number) => disableRunner(runnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      setConfirmRunner(null);
      setOpenMenu(null);
    },
  });

  useEffect(() => {
    if (!openMenu) return;

    function handleClose() {
      setOpenMenu(null);
    }

    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);

    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
    };
  }, [openMenu]);

  function handleRefresh() {
    runnersQuery.refetch();
  }

  function handleToggleMenu(
    runner: RunnerRead,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    const rect = event.currentTarget.getBoundingClientRect();

    setOpenMenu((prev) => {
      if (prev?.runner.id === runner.id) {
        return null;
      }

      return {
        runner,
        anchorRect: rect,
      };
    });
  }

  function handleAskToggleRunner(runner: RunnerRead) {
    setConfirmRunner(runner);
    setOpenMenu(null);
  }

  function handleConfirmToggle() {
    if (!confirmRunner) return;

    if (confirmRunner.enabled) {
      disableMutation.mutate(confirmRunner.id);
      return;
    }

    activateMutation.mutate(confirmRunner.id);
  }

  const isSubmitting =
    activateMutation.isPending || disableMutation.isPending;

  const runners = runnersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Runners</h1>
              <p className="mt-1 text-sm text-slate-500">
                Gerencie os runners cadastrados no OrkaFlow.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="">Todos os status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="busy">Ocupado</option>
              <option value="maintenance">Manutenção</option>
              <option value="blocked">Bloqueado</option>
            </select>

            <select
              value={enabledFilter}
              onChange={(e) => setEnabledFilter(e.target.value as EnabledFilter)}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="all">Todos ativo/inativo</option>
              <option value="true">Somente ativos</option>
              <option value="false">Somente inativos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {runnersQuery.isLoading ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Carregando runners...
            </div>
          ) : runnersQuery.isError ? (
            <div className="px-6 py-10 text-sm text-red-600">
              Não foi possível carregar os runners.
            </div>
          ) : runners.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Nenhum runner encontrado.
            </div>
          ) : (
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nome
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Label
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ativo
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tasks em execução
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tasks vinculadas
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Último heartbeat
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {runners.map((runner) => (
                  <tr key={runner.id} className="border-b border-slate-200">
                    <td className="px-6 py-4 text-sm text-slate-900">
                      {runner.name}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {runner.label || "---"}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex min-w-[110px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getRunnerStatusClass(
                          runner.status
                        )}`}
                      >
                        {formatRunnerStatus(runner.status)}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getEnabledClass(
                          runner.enabled
                        )}`}
                      >
                        {runner.enabled ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {runner.running_tasks_count ?? 0}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {runner.linked_bots_count ?? 0}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatDateTime(runner.last_heartbeat)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => handleToggleMenu(runner, event)}
                        className="inline-flex h-10 w-10 items-center justify-center border border-slate-900 bg-white text-slate-700 transition hover:bg-slate-50"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <ActionsDropdown
        open={!!openMenu}
        anchorRect={openMenu?.anchorRect ?? null}
        runner={openMenu?.runner ?? null}
        onClose={() => setOpenMenu(null)}
        onView={(runner) => {
          setOpenMenu(null);
          navigate(`/runner-configs/${runner.id}`);
        }}
        onEdit={(runner) => {
          setOpenMenu(null);
          navigate(`/runner-configs/${runner.id}/edit`);
        }}
        onToggle={(runner) => {
          handleAskToggleRunner(runner);
        }}
      />

      <ConfirmModal
        open={!!confirmRunner}
        title={
          confirmRunner?.enabled
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        description={
          confirmRunner
            ? `Runner: ${confirmRunner.name}\n\nTem certeza que deseja ${
                confirmRunner.enabled ? "desativar" : "ativar"
              } este runner?`
            : ""
        }
        onCancel={() => setConfirmRunner(null)}
        onConfirm={handleConfirmToggle}
        confirmLabel={
          confirmRunner?.enabled
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        loading={isSubmitting}
        danger={!!confirmRunner?.enabled}
      />
    </div>
  );
}

function ActionsDropdown({
  open,
  anchorRect,
  runner,
  onClose,
  onView,
  onEdit,
  onToggle,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  runner: RunnerRead | null;
  onClose: () => void;
  onView: (runner: RunnerRead) => void;
  onEdit: (runner: RunnerRead) => void;
  onToggle: (runner: RunnerRead) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 208 });

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;

    const dropdownWidth = 208;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchorRect.right - dropdownWidth;
    let top = anchorRect.bottom + gap;

    if (left < 8) left = 8;
    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    const estimatedHeight = 140;
    if (top + estimatedHeight > viewportHeight - 8) {
      top = anchorRect.top - estimatedHeight - gap;
    }

    if (top < 8) top = 8;

    setPosition({
      top,
      left,
      width: dropdownWidth,
    });
  }, [open, anchorRect]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !anchorRect || !runner) return null;

  return createPortal(
    <div className="fixed inset-0 z-[4000]">
      <div
        ref={dropdownRef}
        className="absolute border border-slate-200 bg-white p-2 shadow-xl"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
        }}
      >
        <button
          type="button"
          onClick={() => onView(runner)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" />
          Informações
        </button>

        <button
          type="button"
          onClick={() => onEdit(runner)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>

        <button
          type="button"
          onClick={() => onToggle(runner)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
            runner.enabled ? "text-red-600" : "text-emerald-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {runner.enabled ? "Desativar" : "Ativar"}
        </button>
      </div>
    </div>,
    document.body
  );
}

function ConfirmModal({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  loading,
  danger = false,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  loading?: boolean;
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-slate-950/55"
        onClick={onCancel}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative z-10 w-full max-w-md border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          </div>

          <div className="px-6 py-5 text-sm whitespace-pre-line text-slate-700">
            {description}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                danger
                  ? "border border-red-600 bg-red-600 hover:bg-red-700"
                  : "border border-emerald-600 bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Processando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
