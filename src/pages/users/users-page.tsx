import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  UserX,
  X,
} from "lucide-react";

import {
  blockUser,
  listUsers,
  type UserRead,
  unblockUser,
} from "@/services/api/users";
import { listProfiles } from "@/services/api/profiles";

const PAGE_SIZE = 10;

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type StatusConfirmState = {
  id: number;
  name: string;
  active: boolean;
} | null;

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatActive(value: boolean) {
  return value ? "Ativo" : "Bloqueado";
}

function getProfileName(user: UserRead) {
  if (user.profile?.name) return user.profile.name;
  return "---";
}

export function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [actionMenuUserId, setActionMenuUserId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>(null);

  const usersQuery = useQuery({
    queryKey: ["users", search, profileFilter, activeFilter],
    queryFn: () =>
      listUsers({
        search: search || undefined,
        profile_id: profileFilter ? Number(profileFilter) : undefined,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      }),
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles-options"],
    queryFn: () => listProfiles({ active: true, limit: 500 }),
  });

  useEffect(() => {
    if (!toast) return;

    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const statusMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: number; active: boolean }) =>
      active ? unblockUser(userId) : blockUser(userId),
    onSuccess: async (_, variables) => {
      setToast({
        type: "success",
        message: variables.active
          ? "Usuário desbloqueado com sucesso."
          : "Usuário bloqueado com sucesso.",
      });

      setStatusConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await usersQuery.refetch();
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível atualizar o status do usuário.",
      });
    },
  });

  const allItems = usersQuery.data ?? [];
  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const items = useMemo(
    () => allItems.slice(skip, skip + PAGE_SIZE),
    [allItems, skip]
  );

  useEffect(() => {
    setPage(1);
  }, [search, profileFilter, activeFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function handleRefresh() {
    usersQuery.refetch();
    profilesQuery.refetch();
  }

  function openCreatePage() {
    navigate("/users/new");
  }

  function openInfo(userId: number) {
    setActionMenuUserId(null);
    navigate(`/users/${userId}`);
  }

  function openEdit(userId: number) {
    setActionMenuUserId(null);
    navigate(`/users/${userId}/edit`);
  }

  function openStatusConfirm(user: UserRead) {
    setActionMenuUserId(null);
    setStatusConfirm({
      id: user.id,
      name: user.name,
      active: user.active,
    });
  }

  function handleConfirmStatus() {
    if (!statusConfirm) return;

    statusMutation.mutate({
      userId: statusConfirm.id,
      active: !statusConfirm.active,
    });
  }

  const profiles = profilesQuery.data ?? [];

  return (
    <>
      {actionMenuUserId ? (
        <button
          type="button"
          aria-label="Fechar menu de ações"
          onClick={() => setActionMenuUserId(null)}
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
                <h1 className="text-2xl font-semibold text-slate-950">
                  Usuários
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Gestão de usuários, perfis e bloqueio de acesso.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
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
                  Novo Usuário
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
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, login ou e-mail"
                  className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  type="text"
                />
              </div>

              <select
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os perfis</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                  </option>
                ))}
              </select>

              <select
                value={activeFilter}
                onChange={(e) =>
                  setActiveFilter(e.target.value as "" | "true" | "false")
                }
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Bloqueados</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-white">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Nome
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Login
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    E-mail
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Perfil
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Criado em
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {usersQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Carregando usuários...
                    </td>
                  </tr>
                ) : usersQuery.isError ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      Erro ao carregar usuários.
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  items.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      actionMenuUserId={actionMenuUserId}
                      setActionMenuUserId={setActionMenuUserId}
                      onOpenInfo={openInfo}
                      onEdit={openEdit}
                      onToggleStatus={openStatusConfirm}
                      loading={statusMutation.isPending}
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
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="px-2 text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages}
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

        {statusConfirm ? (
          <StatusConfirmModal
            userName={statusConfirm.name}
            currentActive={statusConfirm.active}
            loading={statusMutation.isPending}
            onCancel={() => {
              if (statusMutation.isPending) return;
              setStatusConfirm(null);
            }}
            onConfirm={handleConfirmStatus}
          />
        ) : null}
      </div>
    </>
  );
}

type UserRowProps = {
  user: UserRead;
  actionMenuUserId: number | null;
  setActionMenuUserId: (userId: number | null) => void;
  onOpenInfo: (userId: number) => void;
  onEdit: (userId: number) => void;
  onToggleStatus: (user: UserRead) => void;
  loading: boolean;
};

function UserRow({
  user,
  actionMenuUserId,
  setActionMenuUserId,
  onOpenInfo,
  onEdit,
  onToggleStatus,
  loading,
}: UserRowProps) {
  const isOpen = actionMenuUserId === user.id;
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  function handleToggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();

    if (isOpen) {
      setActionMenuUserId(null);
      setMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - 180,
    });

    setActionMenuUserId(user.id);
  }

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-800">
        {user.name}
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        {user.login}
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        {user.email}
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          <Shield className="h-3.5 w-3.5" />
          {getProfileName(user)}
        </span>
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm">
        <span
          className={`inline-flex items-center border px-2.5 py-1 text-xs font-medium ${
            user.active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {formatActive(user.active)}
        </span>
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        {formatDateTime(user.created_at)}
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm">
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleToggleMenu}
            className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isOpen && menuPosition
            ? createPortal(
                <div
                  className="fixed z-[70] min-w-[180px] border border-slate-200 bg-white p-1 shadow-xl"
                  style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenInfo(user.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar
                  </button>

                  <button
                    type="button"
                    onClick={() => onEdit(user.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleStatus(user)}
                    disabled={loading}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-50 ${
                      user.active ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    <UserX className="h-4 w-4" />
                    {user.active ? "Bloquear" : "Desbloquear"}
                  </button>
                </div>,
                document.body
              )
            : null}
        </div>
      </td>
    </tr>
  );
}

type StatusConfirmModalProps = {
  userName: string;
  currentActive: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function StatusConfirmModal({
  userName,
  currentActive,
  loading,
  onCancel,
  onConfirm,
}: StatusConfirmModalProps) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            {currentActive ? "Bloquear usuário" : "Desbloquear usuário"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirme a ação para o usuário <strong>{userName}</strong>.
          </p>
        </div>

        <div className="px-6 py-5">
          <div
            className={`border px-4 py-3 text-sm ${
              currentActive
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {currentActive
              ? "Ao bloquear, o usuário perderá acesso ao sistema imediatamente."
              : "Ao desbloquear, o usuário poderá voltar a acessar o sistema normalmente."}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white transition disabled:opacity-50 ${
              currentActive
                ? "bg-red-700 hover:bg-red-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            <UserX className="h-4 w-4" />
            {loading
              ? "Processando..."
              : currentActive
                ? "Confirmar bloqueio"
                : "Confirmar desbloqueio"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
