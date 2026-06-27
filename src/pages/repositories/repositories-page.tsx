import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import {
  activateRepository,
  disableRepository,
  listRepositories,
  type RepositoryRead,
} from "@/services/api/repositories";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getActiveClass(active: boolean) {
  return active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-600";
}

type ActiveFilter = "all" | "true" | "false";

type MenuState = {
  repository: RepositoryRead;
  anchorRect: DOMRect;
} | null;

export function RepositoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [openMenu, setOpenMenu] = useState<MenuState>(null);
  const [confirmRepository, setConfirmRepository] =
    useState<RepositoryRead | null>(null);

  const queryParams = useMemo(() => {
    return {
      active:
        activeFilter === "all"
          ? undefined
          : activeFilter === "true"
          ? true
          : false,
      limit: 100,
      skip: 0,
    };
  }, [activeFilter]);

  const repositoriesQuery = useQuery({
    queryKey: ["repositories", queryParams],
    queryFn: () => listRepositories(queryParams),
    refetchInterval: 10000,
  });

  const activateMutation = useMutation({
    mutationFn: (repositoryId: number) => activateRepository(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      setConfirmRepository(null);
      setOpenMenu(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: (repositoryId: number) => disableRepository(repositoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      setConfirmRepository(null);
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
    repositoriesQuery.refetch();
  }

  function handleToggleMenu(
    repository: RepositoryRead,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    const rect = event.currentTarget.getBoundingClientRect();

    setOpenMenu((prev) => {
      if (prev?.repository.id === repository.id) {
        return null;
      }

      return {
        repository,
        anchorRect: rect,
      };
    });
  }

  function handleAskToggleRepository(repository: RepositoryRead) {
    setConfirmRepository(repository);
    setOpenMenu(null);
  }

  function handleConfirmToggle() {
    if (!confirmRepository) return;

    if (confirmRepository.active) {
      disableMutation.mutate(confirmRepository.id);
      return;
    }

    activateMutation.mutate(confirmRepository.id);
  }

  const isSubmitting =
    activateMutation.isPending || disableMutation.isPending;

  const repositories = repositoriesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                Repositórios
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Gerencie os repositórios cadastrados no OrkaFlow.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/repositories/new")}
                className="inline-flex h-10 items-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Novo repositório
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
          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="all">Todos ativo/inativo</option>
              <option value="true">Somente ativos</option>
              <option value="false">Somente inativos</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {repositoriesQuery.isLoading ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Carregando repositórios...
            </div>
          ) : repositoriesQuery.isError ? (
            <div className="px-6 py-10 text-sm text-red-600">
              Não foi possível carregar os repositórios.
            </div>
          ) : repositories.length === 0 ? (
            <div className="px-6 py-10 text-sm text-slate-500">
              Nenhum repositório encontrado.
            </div>
          ) : (
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nome
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Descrição
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ativo
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Data de criação
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {repositories.map((repository) => (
                  <tr key={repository.id} className="border-b border-slate-200">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {repository.name}
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="max-w-[420px] whitespace-pre-wrap break-words">
                        {repository.description || "---"}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getActiveClass(
                          repository.active
                        )}`}
                      >
                        {repository.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-700">
                      {formatDateTime(repository.created_at)}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(event) => handleToggleMenu(repository, event)}
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
        repository={openMenu?.repository ?? null}
        onClose={() => setOpenMenu(null)}
        onView={(repository) => {
          setOpenMenu(null);
          navigate(`/repositories/${repository.id}`);
        }}
        onEdit={(repository) => {
          setOpenMenu(null);
          navigate(`/repositories/${repository.id}/edit`);
        }}
        onToggle={(repository) => {
          handleAskToggleRepository(repository);
        }}
      />

      <ConfirmModal
        open={!!confirmRepository}
        title={
          confirmRepository?.active
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        description={
          confirmRepository
            ? `Repositório: ${confirmRepository.name}\n\nTem certeza que deseja ${
                confirmRepository.active ? "desativar" : "ativar"
              } este repositório?`
            : ""
        }
        onCancel={() => setConfirmRepository(null)}
        onConfirm={handleConfirmToggle}
        confirmLabel={
          confirmRepository?.active
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        loading={isSubmitting}
        danger={!!confirmRepository?.active}
      />
    </div>
  );
}

function ActionsDropdown({
  open,
  anchorRect,
  repository,
  onClose,
  onView,
  onEdit,
  onToggle,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  repository: RepositoryRead | null;
  onClose: () => void;
  onView: (repository: RepositoryRead) => void;
  onEdit: (repository: RepositoryRead) => void;
  onToggle: (repository: RepositoryRead) => void;
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

  if (!open || !anchorRect || !repository) return null;

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
          onClick={() => onView(repository)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" />
          Informações
        </button>

        <button
          type="button"
          onClick={() => onEdit(repository)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>

        <button
          type="button"
          onClick={() => onToggle(repository)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
            repository.active ? "text-red-600" : "text-emerald-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {repository.active ? "Desativar" : "Ativar"}
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

          <div className="px-6 py-5 whitespace-pre-line text-sm text-slate-700">
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
