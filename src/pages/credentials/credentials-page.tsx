import { useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { deleteCredential, listCredentials } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import type { CredentialRead } from "@/types/credential";

const PAGE_SIZE = 10;

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type DeleteConfirmState = {
  id: number;
  label: string;
} | null;

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatActive(value: boolean) {
  return value ? "Ativa" : "Inativa";
}

export function CredentialsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [actionMenuCredentialId, setActionMenuCredentialId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);

  const credentialsQuery = useQuery({
    queryKey: ["credentials"],
    queryFn: () => listCredentials(),
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
    mutationFn: deleteCredential,
    onSuccess: async () => {
      setToast({
        type: "success",
        message: "Credencial removida com sucesso.",
      });

      setDeleteConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["credentials"] });
      await credentialsQuery.refetch();
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível remover a credencial.",
      });
    },
  });

  const repositories = repositoriesQuery.data ?? [];
  const repositoryMap = useMemo(() => {
    return new Map(repositories.map((repository) => [repository.id, repository.name]));
  }, [repositories]);

  const filteredItems = useMemo(() => {
    const items = credentialsQuery.data ?? [];

    return items.filter((item) => {
      const matchesSearch = search.trim()
        ? item.label.toLowerCase().includes(search.trim().toLowerCase())
        : true;

      const matchesRepository = repositoryFilter
        ? item.repository_id === Number(repositoryFilter)
        : true;

      const matchesActive =
        activeFilter === ""
          ? true
          : activeFilter === "true"
            ? item.active
            : !item.active;

      return matchesSearch && matchesRepository && matchesActive;
    });
  }, [credentialsQuery.data, search, repositoryFilter, activeFilter]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function handleRefresh() {
    credentialsQuery.refetch();
    repositoriesQuery.refetch();
  }

  function openCreatePage() {
    navigate("/credentials/new");
  }

  function openInfo(credentialId: number) {
    setActionMenuCredentialId(null);
    navigate(`/credentials/${credentialId}`);
  }

  function openDeleteConfirm(credential: CredentialRead) {
    setActionMenuCredentialId(null);
    setDeleteConfirm({
      id: credential.id,
      label: credential.label,
    });
  }

  function handleConfirmDelete() {
    if (!deleteConfirm) return;
    deleteMutation.mutate(deleteConfirm.id);
  }

  return (
    <>
      {actionMenuCredentialId ? (
        <button
          type="button"
          aria-label="Fechar menu de ações"
          onClick={() => setActionMenuCredentialId(null)}
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
                <h1 className="text-2xl font-semibold text-slate-950">Credenciais</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Cadastro, organização e manutenção de credenciais seguras do sistema.
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
                  Nova Credencial
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
                  placeholder="Buscar por label"
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
                <option value="true">Ativas</option>
                <option value="false">Inativas</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    ID
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Label
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Repositório
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
                {credentialsQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Carregando credenciais...
                    </td>
                  </tr>
                ) : credentialsQuery.isError ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      Erro ao carregar credenciais.
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Nenhuma credencial encontrada.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((credential) => (
                    <CredentialRow
                      key={credential.id}
                      credential={credential}
                      repositoryName={
                        repositoryMap.get(credential.repository_id) ||
                        `Repositório #${credential.repository_id}`
                      }
                      actionMenuCredentialId={actionMenuCredentialId}
                      setActionMenuCredentialId={setActionMenuCredentialId}
                      onOpenInfo={openInfo}
                      onEdit={(credentialId) => {
                        navigate(`/credentials/${credentialId}/edit`);
                        setActionMenuCredentialId(null);
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
                : `${startIndex + 1} a ${Math.min(startIndex + PAGE_SIZE, total)} de ${total}`}
            </p>

            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="px-2 text-sm text-slate-600">
                Página {safePage} de {totalPages}
              </span>

              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>

        {deleteConfirm ? (
          <DeleteCredentialConfirmModal
            credentialLabel={deleteConfirm.label}
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

type CredentialRowProps = {
  credential: CredentialRead;
  repositoryName: string;
  actionMenuCredentialId: number | null;
  setActionMenuCredentialId: (credentialId: number | null) => void;
  onOpenInfo: (credentialId: number) => void;
  onEdit: (credentialId: number) => void;
  onAskDelete: (credential: CredentialRead) => void;
  deleting: boolean;
};

function CredentialRow({
  credential,
  repositoryName,
  actionMenuCredentialId,
  setActionMenuCredentialId,
  onOpenInfo,
  onEdit,
  onAskDelete,
  deleting,
}: CredentialRowProps) {
  const isOpen = actionMenuCredentialId === credential.id;
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  function handleToggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();

    if (isOpen) {
      setActionMenuCredentialId(null);
      setMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.right - 192,
    });

    setActionMenuCredentialId(credential.id);
  }

  return (
    <tr className="border-b border-slate-200 transition hover:bg-slate-50/70">
      <td className="px-4 py-3 text-sm font-medium text-blue-700">
        <button
          type="button"
          onClick={() => onOpenInfo(credential.id)}
          className="transition hover:text-blue-900"
        >
          {credential.id}
        </button>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        <button
          type="button"
          onClick={() => onOpenInfo(credential.id)}
          className="inline-flex items-center gap-2 font-medium text-slate-900 transition hover:text-blue-700"
        >
          <ShieldCheck className="h-4 w-4 text-slate-500" />
          {credential.label}
        </button>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">{repositoryName}</td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatActive(credential.active)}
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDateTime(credential.created_at)}
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
                    onOpenInfo(credential.id);
                    setActionMenuCredentialId(null);
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
                    onEdit(credential.id);
                    setActionMenuCredentialId(null);
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
                    onAskDelete(credential);
                    setActionMenuCredentialId(null);
                    setMenuPosition(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </button>
              </div>,
              document.body
            )
          : null}
      </td>
    </tr>
  );
}

type DeleteCredentialConfirmModalProps = {
  credentialLabel: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function DeleteCredentialConfirmModal({
  credentialLabel,
  loading,
  onCancel,
  onConfirm,
}: DeleteCredentialConfirmModalProps) {
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
              Tem certeza que deseja excluir a credencial{" "}
              <span className="font-semibold text-slate-900">{credentialLabel}</span>?
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Essa ação irá inativar a credencial.
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
