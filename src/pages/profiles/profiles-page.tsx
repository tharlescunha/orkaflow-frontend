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
  Shield,
  ShieldOff,
  X,
} from "lucide-react";

import {
  activateProfile,
  deactivateProfile,
  listProfiles,
  type ProfileRead,
} from "@/services/api/profiles";

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

export function ProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [actionMenuProfileId, setActionMenuProfileId] = useState<number | null>(
    null
  );
  const [toast, setToast] = useState<ToastState>(null);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>(null);

  const profilesQuery = useQuery({
    queryKey: ["profiles", activeFilter],
    queryFn: () =>
      listProfiles({
        active: activeFilter === "" ? undefined : activeFilter === "true",
        limit: 500,
      }),
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const statusMutation = useMutation({
    mutationFn: async ({
      profileId,
      active,
    }: {
      profileId: number;
      active: boolean;
    }) => {
      if (active) return activateProfile(profileId);
      return deactivateProfile(profileId);
    },
    onSuccess: async (_, variables) => {
      setToast({
        type: "success",
        message: variables.active
          ? "Perfil ativado com sucesso."
          : "Perfil desativado com sucesso.",
      });

      setStatusConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await profilesQuery.refetch();
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível atualizar o status do perfil.",
      });
    },
  });

  const allItems = profilesQuery.data ?? [];
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
  }, [activeFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function handleRefresh() {
    profilesQuery.refetch();
  }

  function openCreatePage() {
    navigate("/profiles/new");
  }

  function openInfo(profileId: number) {
    setActionMenuProfileId(null);
    navigate(`/profiles/${profileId}`);
  }

  function openEdit(profileId: number) {
    setActionMenuProfileId(null);
    navigate(`/profiles/${profileId}/edit`);
  }

  function openStatusConfirm(profile: ProfileRead) {
    setActionMenuProfileId(null);
    setStatusConfirm({
      id: profile.id,
      name: profile.name,
      active: profile.active,
    });
  }

  function handleConfirmStatus() {
    if (!statusConfirm) return;

    statusMutation.mutate({
      profileId: statusConfirm.id,
      active: !statusConfirm.active,
    });
  }

  return (
    <>
      {actionMenuProfileId ? (
        <button
          type="button"
          aria-label="Fechar menu de ações"
          onClick={() => setActionMenuProfileId(null)}
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
                  Perfis de Acesso
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Gestão dos perfis e das permissões vinculadas.
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
                  Novo Perfil
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
            <div className="grid gap-3 lg:grid-cols-[220px]">
              <select
                value={activeFilter}
                onChange={(e) =>
                  setActiveFilter(e.target.value as "" | "true" | "false")
                }
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
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
                    Descrição
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Permissões
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
                {profilesQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Carregando perfis...
                    </td>
                  </tr>
                ) : profilesQuery.isError ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      Erro ao carregar perfis.
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Nenhum perfil encontrado.
                    </td>
                  </tr>
                ) : (
                  items.map((profile) => (
                    <ProfileRow
                      key={profile.id}
                      profile={profile}
                      actionMenuProfileId={actionMenuProfileId}
                      setActionMenuProfileId={setActionMenuProfileId}
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
            profileName={statusConfirm.name}
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

type ProfileRowProps = {
  profile: ProfileRead;
  actionMenuProfileId: number | null;
  setActionMenuProfileId: (profileId: number | null) => void;
  onOpenInfo: (profileId: number) => void;
  onEdit: (profileId: number) => void;
  onToggleStatus: (profile: ProfileRead) => void;
  loading: boolean;
};

function ProfileRow({
  profile,
  actionMenuProfileId,
  setActionMenuProfileId,
  onOpenInfo,
  onEdit,
  onToggleStatus,
  loading,
}: ProfileRowProps) {
  const isOpen = actionMenuProfileId === profile.id;
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  function handleToggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();

    if (isOpen) {
      setActionMenuProfileId(null);
      setMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + window.scrollY + 8,
      left: rect.right + window.scrollX - 180,
    });

    setActionMenuProfileId(profile.id);
  }

  return (
    <tr className="hover:bg-slate-50/70">
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-800">
        {profile.name}
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        {profile.description || "---"}
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2 border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          <Shield className="h-3.5 w-3.5" />
          {profile.permissions?.length ?? 0}
        </span>
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm">
        <span
          className={`inline-flex items-center border px-2.5 py-1 text-xs font-medium ${
            profile.active
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {profile.active ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="border-b border-slate-100 px-4 py-3 text-sm text-slate-600">
        {formatDateTime(profile.created_at)}
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
                    onClick={() => onOpenInfo(profile.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar
                  </button>

                  <button
                    type="button"
                    onClick={() => onEdit(profile.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleStatus(profile)}
                    disabled={loading}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-50 ${
                      profile.active ? "text-red-700" : "text-emerald-700"
                    }`}
                  >
                    <ShieldOff className="h-4 w-4" />
                    {profile.active ? "Desativar" : "Ativar"}
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
  profileName: string;
  currentActive: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function StatusConfirmModal({
  profileName,
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
            {currentActive ? "Desativar perfil" : "Ativar perfil"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirme a ação para o perfil <strong>{profileName}</strong>.
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
              ? "Ao desativar, usuários com esse perfil podem perder permissões no sistema."
              : "Ao ativar, o perfil volta a poder ser usado normalmente pelos usuários."}
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
            <ShieldOff className="h-4 w-4" />
            {loading
              ? "Processando..."
              : currentActive
                ? "Confirmar desativação"
                : "Confirmar ativação"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
