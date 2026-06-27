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
  activateAutomation,
  deactivateAutomation,
  listAutomations,
  type AutomationRead,
} from "@/services/api/automations";
import { listRepositories } from "@/services/api/repositories";
import { listBots } from "@/services/api/bots";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getEnabledClass(enabled: boolean) {
  return enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-600";
}

type ActiveFilter = "all" | "true" | "false";

type MenuState = {
  automation: AutomationRead;
  anchorRect: DOMRect;
} | null;

export function AutomationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [openMenu, setOpenMenu] = useState<MenuState>(null);
  const [confirmAutomation, setConfirmAutomation] = useState<AutomationRead | null>(null);

  const queryParams = useMemo(() => {
    return {
      repository_id: repositoryFilter ? Number(repositoryFilter) : undefined,
      bot_id: botFilter ? Number(botFilter) : undefined,
      active:
        activeFilter === "all"
          ? undefined
          : activeFilter === "true"
          ? true
          : false,
    };
  }, [repositoryFilter, botFilter, activeFilter]);

  const automationsQuery = useQuery({
    queryKey: ["automations", queryParams],
    queryFn: () => listAutomations(queryParams),
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-filter-automations"],
    queryFn: () => listRepositories({ limit: 100 }),
  });

  const botsQuery = useQuery({
    queryKey: ["bots-filter-automations"],
    queryFn: () => listBots({ limit: 100 }),
  });

  const activateMutation = useMutation({
    mutationFn: (automationId: number) => activateAutomation(automationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setConfirmAutomation(null);
      setOpenMenu(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (automationId: number) => deactivateAutomation(automationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setConfirmAutomation(null);
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
    automationsQuery.refetch();
  }

  function handleToggleMenu(
    automation: AutomationRead,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    const rect = event.currentTarget.getBoundingClientRect();

    setOpenMenu((prev) => {
      if (prev?.automation.id === automation.id) {
        return null;
      }

      return {
        automation,
        anchorRect: rect,
      };
    });
  }

  function handleAskToggleAutomation(automation: AutomationRead) {
    setConfirmAutomation(automation);
    setOpenMenu(null);
  }

  function handleConfirmToggle() {
    if (!confirmAutomation) return;

    if (confirmAutomation.active) {
      deactivateMutation.mutate(confirmAutomation.id);
      return;
    }

    activateMutation.mutate(confirmAutomation.id);
  }

  const isSubmitting =
    activateMutation.isPending || deactivateMutation.isPending;

  const automations = automationsQuery.data ?? [];
  const repositories = repositoriesQuery.data ?? [];
  const bots = botsQuery.data?.items ?? [];

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Automações</h1>
              <p className="mt-1 text-sm text-slate-500">
                Gerencie as automações cadastradas no OrkaFlow.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/automations/new")}
                className="inline-flex h-10 items-center border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Nova automação
              </button>

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
        </div>

        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <select
              value={repositoryFilter}
              onChange={(e) => {
                setRepositoryFilter(e.target.value);
                setBotFilter("");
              }}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="">Todos os repositórios</option>
              {repositories.map((repository) => (
                <option key={repository.id} value={repository.id}>
                  {repository.name}
                </option>
              ))}
            </select>

            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="">Todos os bots</option>
              {bots
                .filter((bot) =>
                  repositoryFilter ? bot.repository_id === Number(repositoryFilter) : true
                )
                .map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))}
            </select>

            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="all">Todas ativo/inativo</option>
              <option value="true">Somente ativas</option>
              <option value="false">Somente inativas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {automationsQuery.isLoading ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Carregando automações...
            </div>
          ) : automationsQuery.isError ? (
            <div className="px-6 py-10 text-sm text-red-600">
              Não foi possível carregar as automações.
            </div>
          ) : automations.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Nenhuma automação encontrada.
            </div>
          ) : (
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    ID
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nome
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Descrição
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Repositório
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Bot
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ativa
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Criada em
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {automations.map((automation) => (
                  <tr key={automation.id} className="border-b border-slate-200 align-top">
                    <td className="px-6 py-4 text-sm text-slate-700">{automation.id}</td>

                    <td className="px-6 py-4 text-sm text-slate-900">
                      {automation.name}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="max-w-[340px] whitespace-pre-wrap break-words">
                        {automation.description || "---"}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {automation.repository_name || `#${automation.repository_id}`}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {automation.bot_name || `#${automation.bot_id}`}
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getEnabledClass(
                          automation.active
                        )}`}
                      >
                        {automation.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatDateTime(automation.created_at)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => handleToggleMenu(automation, event)}
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
        automation={openMenu?.automation ?? null}
        onClose={() => setOpenMenu(null)}
        onView={(automation) => {
          setOpenMenu(null);
          navigate(`/automations/${automation.id}`);
        }}
        onEdit={(automation) => {
          setOpenMenu(null);
          navigate(`/automations/${automation.id}/edit`);
        }}
        onToggle={(automation) => {
          handleAskToggleAutomation(automation);
        }}
      />

      <ConfirmModal
        open={!!confirmAutomation}
        title={
          confirmAutomation?.active
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        description={
          confirmAutomation
            ? `Automação: ${confirmAutomation.name}\n\nTem certeza que deseja ${
                confirmAutomation.active ? "desativar" : "ativar"
              } esta automação?`
            : ""
        }
        onCancel={() => setConfirmAutomation(null)}
        onConfirm={handleConfirmToggle}
        confirmLabel={
          confirmAutomation?.active
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        loading={isSubmitting}
        danger={!!confirmAutomation?.active}
      />
    </div>
  );
}

function ActionsDropdown({
  open,
  anchorRect,
  automation,
  onClose,
  onView,
  onEdit,
  onToggle,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  automation: AutomationRead | null;
  onClose: () => void;
  onView: (automation: AutomationRead) => void;
  onEdit: (automation: AutomationRead) => void;
  onToggle: (automation: AutomationRead) => void;
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

  if (!open || !anchorRect || !automation) return null;

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
          onClick={() => onView(automation)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" />
          Informações
        </button>

        <button
          type="button"
          onClick={() => onEdit(automation)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>

        <button
          type="button"
          onClick={() => onToggle(automation)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
            automation.active ? "text-red-600" : "text-emerald-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {automation.active ? "Desativar" : "Ativar"}
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
      <div className="absolute inset-0 bg-slate-950/55" onClick={onCancel} />

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
