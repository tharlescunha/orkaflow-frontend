import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Shield,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import {
  blockUser,
  getUserById,
  unblockUser,
} from "@/services/api/users";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function UserDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUserById(userId),
    enabled: Number.isFinite(userId) && userId > 0,
  });

  const statusMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (active) {
        return unblockUser(userId);
      }
      return blockUser(userId);
    },
    onSuccess: async (_, active) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });

      setToast({
        type: "success",
        message: active
          ? "Usuário desbloqueado com sucesso."
          : "Usuário bloqueado com sucesso.",
      });

      setConfirmOpen(false);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível alterar o status do usuário.",
      });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  function goBack() {
    navigate("/users");
  }

  function goEdit() {
    navigate(`/users/${userId}/edit`);
  }

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        ID de usuário inválido.
      </div>
    );
  }

  if (userQuery.isLoading) {
    return (
      <div className="border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
        Carregando usuário...
      </div>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Não foi possível carregar os dados do usuário.
      </div>
    );
  }

  const user = userQuery.data;
  const isBlocking = user.active;

  return (
    <>
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

      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <button
                  type="button"
                  onClick={goBack}
                  className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para usuários
                </button>

                <h1 className="text-2xl font-semibold text-slate-950">
                  Detalhes do Usuário
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Visualize os dados do usuário e o perfil de acesso vinculado.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={goEdit}
                  className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className={`inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white transition ${
                    user.active
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
                >
                  <UserX className="h-4 w-4" />
                  {user.active ? "Bloquear" : "Desbloquear"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="space-y-5">
              <div className="border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Dados principais
                  </h2>
                </div>

                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <InfoItem label="Nome" value={user.name} />
                  <InfoItem label="Login" value={user.login} />
                  <InfoItem label="E-mail" value={user.email} />
                  <InfoItem
                    label="Status"
                    value={user.active ? "Ativo" : "Bloqueado"}
                    highlight={user.active ? "success" : "danger"}
                  />
                  <InfoItem label="Role legado" value={user.role} />
                  <InfoItem
                    label="Criado em"
                    value={formatDateTime(user.created_at)}
                  />
                  <InfoItem
                    label="Atualizado em"
                    value={formatDateTime(user.updated_at)}
                  />
                </div>
              </div>

              <div className="border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Perfil vinculado
                  </h2>
                </div>

                <div className="p-4">
                  {user.profile ? (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-50">
                          <Shield className="h-4 w-4 text-slate-700" />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {user.profile.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            {user.profile.description || "Sem descrição informada."}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <InfoItem
                          label="Status do perfil"
                          value={user.profile.active ? "Ativo" : "Inativo"}
                          highlight={user.profile.active ? "success" : "danger"}
                        />
                        <InfoItem
                          label="Quantidade de permissões"
                          value={String(user.profile.permissions?.length ?? 0)}
                        />
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-slate-700">
                          Permissões do perfil
                        </p>

                        {user.profile.permissions?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {user.profile.permissions.map((permission) => (
                              <span
                                key={permission.id}
                                className="inline-flex items-center border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                                title={permission.description || undefined}
                              >
                                {permission.module}:{permission.action}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                            Este perfil não possui permissões vinculadas.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Usuário sem perfil vinculado.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="space-y-5">
              <div className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo
                  </h2>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center border border-slate-200 bg-slate-50">
                      <UserRound className="h-4 w-4 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {user.name}
                      </p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <SummaryItem label="Login" value={user.login} />
                    <SummaryItem
                      label="Status"
                      value={user.active ? "Ativo" : "Bloqueado"}
                    />
                    <SummaryItem label="Role legado" value={user.role} />
                    <SummaryItem
                      label="Perfil"
                      value={user.profile?.name || "Sem perfil"}
                    />
                  </div>
                </div>
              </div>

              <div className="border border-amber-200 bg-amber-50">
                <div className="border-b border-amber-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-700" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                      Atenção
                    </h2>
                  </div>
                </div>

                <div className="space-y-3 px-4 py-4 text-sm text-amber-900">
                  <p>
                    O <strong>perfil</strong> concentra as permissões reais do
                    usuário no sistema.
                  </p>
                  <p>
                    Se o usuário for <strong>bloqueado</strong>, o backend já
                    corta o acesso imediatamente.
                  </p>
                  <p>
                    O campo <strong>role legado</strong> ainda existe por
                    compatibilidade com partes antigas do projeto.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {confirmOpen ? (
          <ConfirmStatusModal
            loading={statusMutation.isPending}
            isBlocking={isBlocking}
            userName={user.name}
            onCancel={() => {
              if (statusMutation.isPending) return;
              setConfirmOpen(false);
            }}
            onConfirm={() => statusMutation.mutate(!user.active)}
          />
        ) : null}
      </div>
    </>
  );
}

function InfoItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "success" | "danger";
}) {
  const highlightClass =
    highlight === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : highlight === "danger"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-white text-slate-800";

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className={`border px-3 py-2 text-sm ${highlightClass}`}>
        {value || "---"}
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}

function ConfirmStatusModal({
  loading,
  isBlocking,
  userName,
  onCancel,
  onConfirm,
}: {
  loading: boolean;
  isBlocking: boolean;
  userName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            {isBlocking ? "Bloquear usuário" : "Desbloquear usuário"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirme a ação para o usuário <strong>{userName}</strong>.
          </p>
        </div>

        <div className="px-6 py-5">
          <div
            className={`border px-4 py-3 text-sm ${
              isBlocking
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {isBlocking
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
              isBlocking
                ? "bg-red-700 hover:bg-red-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserX className="h-4 w-4" />
            )}
            {loading
              ? "Processando..."
              : isBlocking
                ? "Confirmar bloqueio"
                : "Confirmar desbloqueio"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
