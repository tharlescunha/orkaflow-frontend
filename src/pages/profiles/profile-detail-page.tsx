import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pencil,
  Shield,
  ShieldOff,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  activateProfile,
  deactivateProfile,
  getProfileById,
} from "@/services/api/profiles";

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

export function ProfileDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ profileId: string }>();
  const profileId = Number(params.profileId);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfileById(profileId),
    enabled: Number.isFinite(profileId) && profileId > 0,
  });

  const statusMutation = useMutation({
    mutationFn: async (active: boolean) => {
      if (active) {
        return activateProfile(profileId);
      }
      return deactivateProfile(profileId);
    },
    onSuccess: async (_, active) => {
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });

      setToast({
        type: "success",
        message: active
          ? "Perfil ativado com sucesso."
          : "Perfil desativado com sucesso.",
      });

      setConfirmOpen(false);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível alterar o status do perfil.",
      });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  function goBack() {
    navigate("/profiles");
  }

  function goEdit() {
    navigate(`/profiles/${profileId}/edit`);
  }

  if (!Number.isFinite(profileId) || profileId <= 0) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        ID de perfil inválido.
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
        Carregando perfil...
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Não foi possível carregar os dados do perfil.
      </div>
    );
  }

  const profile = profileQuery.data;
  const isDeactivating = profile.active;

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
                  Voltar para perfis
                </button>

                <h1 className="text-2xl font-semibold text-slate-950">
                  Detalhes do Perfil
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Visualize os dados do perfil e as permissões vinculadas.
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
                    profile.active
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-emerald-700 hover:bg-emerald-800"
                  }`}
                >
                  <ShieldOff className="h-4 w-4" />
                  {profile.active ? "Desativar" : "Ativar"}
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
                  <InfoItem label="Nome" value={profile.name} />
                  <InfoItem
                    label="Status"
                    value={profile.active ? "Ativo" : "Inativo"}
                    highlight={profile.active ? "success" : "danger"}
                  />
                  <InfoItem
                    label="Criado em"
                    value={formatDateTime(profile.created_at)}
                  />
                  <InfoItem
                    label="Atualizado em"
                    value={formatDateTime(profile.updated_at)}
                  />
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Descrição
                    </p>
                    <div className="border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800">
                      {profile.description || "Sem descrição informada."}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-700" />
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Permissões vinculadas
                    </h2>
                  </div>
                </div>

                <div className="p-4">
                  {profile.permissions?.length ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {profile.permissions.map((permission) => (
                        <div
                          key={permission.id}
                          className="border border-slate-200 bg-white px-3 py-3"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {permission.module}:{permission.action}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {permission.description || "Sem descrição"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      Este perfil não possui permissões vinculadas.
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
                      <Shield className="h-4 w-4 text-slate-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {profile.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {profile.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 text-sm">
                    <SummaryItem
                      label="Status"
                      value={profile.active ? "Ativo" : "Inativo"}
                    />
                    <SummaryItem
                      label="Permissões"
                      value={String(profile.permissions?.length ?? 0)}
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
                    Alterações neste perfil impactam todos os usuários
                    vinculados a ele.
                  </p>
                  <p>
                    Se o perfil for <strong>desativado</strong>, ele deixa de ser
                    utilizável normalmente no sistema.
                  </p>
                  <p>
                    Revise as permissões com cuidado antes de editar ou ativar.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {confirmOpen ? (
          <ConfirmStatusModal
            loading={statusMutation.isPending}
            isDeactivating={isDeactivating}
            profileName={profile.name}
            onCancel={() => {
              if (statusMutation.isPending) return;
              setConfirmOpen(false);
            }}
            onConfirm={() => statusMutation.mutate(!profile.active)}
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
  isDeactivating,
  profileName,
  onCancel,
  onConfirm,
}: {
  loading: boolean;
  isDeactivating: boolean;
  profileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-md border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            {isDeactivating ? "Desativar perfil" : "Ativar perfil"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Confirme a ação para o perfil <strong>{profileName}</strong>.
          </p>
        </div>

        <div className="px-6 py-5">
          <div
            className={`border px-4 py-3 text-sm ${
              isDeactivating
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {isDeactivating
              ? "Ao desativar, usuários vinculados podem perder permissões no sistema."
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
              isDeactivating
                ? "bg-red-700 hover:bg-red-800"
                : "bg-emerald-700 hover:bg-emerald-800"
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            {loading
              ? "Processando..."
              : isDeactivating
                ? "Confirmar desativação"
                : "Confirmar ativação"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
