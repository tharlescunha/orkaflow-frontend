import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Shield, UserCheck, UserX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiTokensCard } from "@/components/common/api-tokens-card";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY, formatDateTime } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, chip, link, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { blockUser, getUserById, unblockUser } from "@/services/api/users";
import { toast } from "@/store/toast-store";

export function UserDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ userId: string }>();
  const userId = Number(params.userId);
  const validId = Number.isFinite(userId) && userId > 0;

  const [confirmOpen, setConfirmOpen] = useState(false);

  const userQuery = useQuery({
    queryKey: ["user", userId],
    queryFn: () => getUserById(userId),
    enabled: validId,
  });

  const statusMutation = useMutation({
    mutationFn: async (active: boolean) => (active ? unblockUser(userId) : blockUser(userId)),
    onSuccess: async (_, active) => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["user", userId] });
      toast.success(active ? "Usuário desbloqueado." : "Usuário bloqueado. Ele perdeu o acesso agora.");
      setConfirmOpen(false);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível alterar o status do usuário.", error));
    },
  });

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Usuário" backTo="/users" backLabel="Voltar para usuários" />
        <div className="p-5">
          <QueryError error={new Error("ID de usuário inválido.")} what="o usuário" />
        </div>
      </section>
    );
  }

  if (userQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Usuário" backTo="/users" backLabel="Voltar para usuários" />
        <div className="p-5">
          <DetailSkeleton fields={6} />
        </div>
      </section>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Usuário" backTo="/users" backLabel="Voltar para usuários" />
        <div className="p-5">
          <QueryError error={userQuery.error} what="o usuário" onRetry={() => userQuery.refetch()} retrying={userQuery.isFetching} />
        </div>
      </section>
    );
  }

  const user = userQuery.data;
  const permissions = user.profile?.permissions ?? [];

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title={user.name}
          description={user.email}
          backTo="/users"
          backLabel="Voltar para usuários"
          meta={
            <span className={cn(badge, user.active ? tone.success : tone.danger)}>{user.active ? "Ativo" : "Bloqueado"}</span>
          }
          actions={
            <>
              {user.active ? (
                <button type="button" onClick={() => setConfirmOpen(true)} className={btn.dangerOutline}>
                  <UserX className="h-4 w-4" />
                  Bloquear
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmOpen(true)} className={btn.success}>
                  <UserCheck className="h-4 w-4" />
                  Desbloquear
                </button>
              )}
              <button type="button" onClick={() => navigate(`/users/${userId}/edit`)} className={btn.primary}>
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </>
          }
        />

        <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5">
            <div className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Acesso</h2>
              </div>
              <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
                <InfoItem
                  label="Status"
                  value={
                    <span className={cn(badge, user.active ? tone.success : tone.danger)}>
                      {user.active ? "Ativo" : "Bloqueado"}
                    </span>
                  }
                />
                <InfoItem
                  label="Perfil"
                  value={
                    user.profile ? (
                      <Link to={`/profiles/${user.profile.id}`} className={link} title={user.profile.description || undefined}>
                        {user.profile.name}
                      </Link>
                    ) : (
                      <span className="text-slate-500">Sem perfil vinculado</span>
                    )
                  }
                />
                <InfoItem label="Login" value={user.login} />
                <InfoItem label="E-mail" value={user.email} />
              </div>
            </div>

            <div className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Permissões do perfil</h2>
                {user.profile && (
                  <span className={cn(badge, user.profile.active ? tone.success : tone.neutral)}>
                    {user.profile.active ? "Perfil ativo" : "Perfil inativo"}
                  </span>
                )}
              </div>
              <div className={cardBody}>
                {!user.profile ? (
                  <p className="text-sm text-slate-500">
                    Este usuário não tem perfil, então não tem permissões no painel.{" "}
                    <Link to={`/users/${userId}/edit`} className={link}>
                      Vincular um perfil
                    </Link>
                  </p>
                ) : permissions.length === 0 ? (
                  <p className="text-sm text-slate-500">O perfil {user.profile.name} não tem permissões vinculadas.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {permissions.map((permission) => (
                      <span key={permission.id} className={chip} title={permission.description || undefined}>
                        <Shield className="h-3 w-3" />
                        {permission.module}:{permission.action}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Detalhes técnicos</h2>
              </div>
              <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
                <InfoItem label="ID" value={String(user.id)} />
                <InfoItem label="Role legado" value={user.role || EMPTY} />
                <InfoItem label="Criado em" value={formatDateTime(user.created_at)} />
                <InfoItem label="Atualizado em" value={formatDateTime(user.updated_at)} />
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className={cn(card, "border-amber-200 bg-amber-50")}>
              <div className="space-y-2 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">Como funciona o acesso</p>
                <p>O perfil concentra as permissões do usuário. Alterar o perfil muda o que ele pode fazer no painel.</p>
                <p>Bloquear corta o acesso na hora. Dá para desbloquear depois sem perder nada.</p>
                <p>O "role legado" existe só por compatibilidade com partes antigas do sistema.</p>
              </div>
            </div>
          </aside>
        </div>

        <div className="px-5 pb-5">
          <ApiTokensCard userId={userId} userName={user.name} />
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={user.active ? "Bloquear usuário" : "Desbloquear usuário"}
        description={
          user.active
            ? `${user.name} perde o acesso ao painel na hora. Você pode desbloquear depois.`
            : `${user.name} volta a acessar o painel normalmente.`
        }
        confirmLabel={user.active ? "Bloquear" : "Desbloquear"}
        tone={user.active ? "danger" : "default"}
        isPending={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate(!user.active)}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm text-slate-800">{value || EMPTY}</div>
    </div>
  );
}
