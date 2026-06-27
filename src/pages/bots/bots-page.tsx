import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { deleteBot, listBots } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import type { BotListItem } from "@/types/bot";

const PAGE_SIZE = 10;

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type DeleteConfirmState = {
  id: number;
  name: string;
} | null;

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function truncateText(value?: string | null, max = 60) {
  if (!value) return "---";
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function formatActive(value: boolean) {
  return value ? "Ativo" : "Inativo";
}

export function BotsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [actionMenuBotId, setActionMenuBotId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);

  const skip = (page - 1) * PAGE_SIZE;

  const botsQuery = useQuery({
    queryKey: ["bots", page, search, repositoryFilter, activeFilter],
    queryFn: () =>
      listBots({
        skip,
        limit: PAGE_SIZE,
        search: search || undefined,
        repository_id: repositoryFilter ? Number(repositoryFilter) : undefined,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      }),
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const deleteMutation = useMutation({
    mutationFn: deleteBot,
    onSuccess: async () => {
      setToast({
        type: "success",
        message: "Bot removido com sucesso.",
      });

      setDeleteConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await botsQuery.refetch();
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível remover o bot.",
      });
    },
  });

  const items = botsQuery.data?.items ?? [];
  const total = botsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const repositories = repositoriesQuery.data ?? [];

  function handleRefresh() {
    botsQuery.refetch();
  }

  function openCreatePage() {
    navigate("/bots/new");
  }

  function openInfo(botId: number) {
    setActionMenuBotId(null);
    navigate(`/bots/${botId}`);
  }

  function openDeleteConfirm(bot: BotListItem) {
    setActionMenuBotId(null);
    setDeleteConfirm({
      id: bot.id,
      name: bot.name,
    });
  }

  function handleConfirmDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate(deleteConfirm.id);
  }

  return (
    <>
      {actionMenuBotId ? (
        <button
          type="button"
          aria-label="Fechar menu de ações"
          onClick={() => setActionMenuBotId(null)}
          className="fixed inset-0 z-10 bg-transparent"
        />
      ) : null}

      <div className="space-y-5">
        {toast ? (
          <div
            className={`fixed right-6 top-20 z-[80] flex items-start gap-3 border px-4 py-3 shadow-lg ${
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
                <h1 className="text-2xl font-semibold text-slate-950">Bots</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Cadastro, acompanhamento e manutenção dos bots do sistema.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar
                </button>

                <button
                  onClick={openCreatePage}
                  className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Novo Bot
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
            <div className="grid gap-3 lg:grid-cols-[280px_240px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  placeholder="Buscar por nome"
                  className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  type="text"
                />
              </div>

              <select
                value={repositoryFilter}
                onChange={(e) => {
                  setPage(1);
                  setRepositoryFilter(e.target.value);
                }}
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os repositórios</option>
                {repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))}
              </select>

              <select
                value={activeFilter}
                onChange={(e) => {
                  setPage(1);
                  setActiveFilter(e.target.value as "" | "true" | "false");
                }}
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    ID
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nome
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Repositório
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Versão atual
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Versão lançamento
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Criado em
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {botsQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Carregando bots...
                    </td>
                  </tr>
                ) : botsQuery.isError ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      Erro ao carregar bots.
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Nenhum bot encontrado.
                    </td>
                  </tr>
                ) : (
                  items.map((bot) => (
                    <BotRow
                      key={bot.id}
                      bot={bot}
                      actionMenuBotId={actionMenuBotId}
                      setActionMenuBotId={setActionMenuBotId}
                      onOpenInfo={openInfo}
                      onEdit={(botId) => {
                        navigate(`/bots/${botId}/edit`);
                        setActionMenuBotId(null);
                      }}
                      onAskDelete={openDeleteConfirm}
                      deleting={deleteMutation.isPending}
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
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>

        {deleteConfirm ? (
          <DeleteBotConfirmModal
            botName={deleteConfirm.name}
            loading={deleteMutation.isPending}
            onCancel={() => {
              if (deleteMutation.isPending) return;
              setDeleteConfirm(null);
            }}
            onConfirm={handleConfirmDelete}
          />
        ) : null}
      </div>
    </>
  );
}

type BotRowProps = {
  bot: BotListItem;
  actionMenuBotId: number | null;
  setActionMenuBotId: (botId: number | null) => void;
  onOpenInfo: (botId: number) => void;
  onEdit: (botId: number) => void;
  onAskDelete: (bot: BotListItem) => void;
  deleting: boolean;
};

function BotRow({
  bot,
  actionMenuBotId,
  setActionMenuBotId,
  onOpenInfo,
  onEdit,
  onAskDelete,
  deleting,
}: BotRowProps) {
  const isOpen = actionMenuBotId === bot.id;
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  function handleToggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();

    if (isOpen) {
      setActionMenuBotId(null);
      setMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.right - 192,
    });

    setActionMenuBotId(bot.id);
  }

  return (
    <tr className="border-b border-slate-200 transition hover:bg-slate-50/70">
      <td className="px-4 py-3 text-sm font-medium text-blue-700">
        <button
          type="button"
          onClick={() => onOpenInfo(bot.id)}
          className="transition hover:text-blue-900"
        >
          {bot.id}
        </button>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        <div>
          <button
            type="button"
            onClick={() => onOpenInfo(bot.id)}
            className="font-medium text-slate-900 transition hover:text-blue-700"
          >
            {bot.name}
          </button>

          <p
            className="mt-1 max-w-[320px] text-xs text-slate-500"
            title={bot.description || undefined}
          >
            {truncateText(bot.description, 70)}
          </p>
        </div>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {bot.repository_name ||
          (bot.repository_id ? `Repositório #${bot.repository_id}` : "---")}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {bot.current_version || "---"}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {bot.release_version || "---"}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatActive(bot.active)}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDateTime(bot.created_at)}
      </td>

      <td className="relative px-4 py-3">
        <button
          type="button"
          onClick={handleToggleMenu}
          className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isOpen && menuPosition
          ? createPortal(
              <div
                className="fixed z-[120] w-48 border border-slate-200 bg-white p-2 shadow-lg"
                style={{
                  top: menuPosition.top,
                  left: menuPosition.left,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenInfo(bot.id);
                    setActionMenuBotId(null);
                    setMenuPosition(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" />
                  Informações
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onEdit(bot.id);
                    setActionMenuBotId(null);
                    setMenuPosition(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    onAskDelete(bot);
                    setActionMenuBotId(null);
                    setMenuPosition(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Deletar
                </button>
              </div>,
              document.body
            )
          : null}
      </td>
    </tr>
  );
}

type DeleteBotConfirmModalProps = {
  botName: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteBotConfirmModal({
  botName,
  loading,
  onCancel,
  onConfirm,
}: DeleteBotConfirmModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-950">
              Confirmar exclusão
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tem certeza que deseja excluir o bot{" "}
              <span className="font-semibold text-slate-900">{botName}</span>?
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Essa ação não poderá ser desfeita.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {loading ? "Excluindo..." : "Excluir"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
