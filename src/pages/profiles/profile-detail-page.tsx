import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY, formatDateTime } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, chip, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { activateProfile, deactivateProfile, getProfileById, type PermissionRead } from "@/services/api/profiles";
import { toast } from "@/store/toast-store";

export function ProfileDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ profileId: string }>();
  const profileId = Number(params.profileId);
  const validId = Number.isFinite(profileId) && profileId > 0;

  const [confirmOpen, setConfirmOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfileById(profileId),
    enabled: validId,
  });

  const statusMutation = useMutation({
    mutationFn: async (active: boolean) => (active ? activateProfile(profileId) : deactivateProfile(profileId)),
    onSuccess: async (_, active) => {
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      toast.success(active ? "Perfil ativado." : "Perfil desativado.");
      setConfirmOpen(false);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível alterar o status do perfil.", error));
    },
  });

  // Permissões agrupadas por módulo, para a pessoa achar rápido o que o perfil dá.
  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionRead[]>();
    (profileQuery.data?.permissions ?? []).forEach((permission) => {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [profileQuery.data?.permissions]);

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Perfil" backTo="/profiles" backLabel="Voltar para perfis" />
        <div className="p-5">
          <QueryError error={new Error("ID de perfil inválido.")} what="o perfil" />
        </div>
      </section>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Perfil" backTo="/profiles" backLabel="Voltar para perfis" />
        <div className="p-5">
          <DetailSkeleton fields={4} />
        </div>
      </section>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Perfil" backTo="/profiles" backLabel="Voltar para perfis" />
        <div className="p-5">
          <QueryError error={profileQuery.error} what="o perfil" onRetry={() => profileQuery.refetch()} retrying={profileQuery.isFetching} />
        </div>
      </section>
    );
  }

  const profile = profileQuery.data;
  const permissionCount = profile.permissions?.length ?? 0;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title={profile.name}
          description={profile.description || "Sem descrição."}
          backTo="/profiles"
          backLabel="Voltar para perfis"
          meta={
            <>
              <span className={cn(badge, profile.active ? tone.success : tone.neutral)}>{profile.active ? "Ativo" : "Inativo"}</span>
              <span className={chip}>
                <Shield className="h-3 w-3" />
                {permissionCount === 1 ? "1 permissão" : `${permissionCount} permissões`}
              </span>
            </>
          }
          actions={
            <>
              {profile.active ? (
                <button type="button" onClick={() => setConfirmOpen(true)} className={btn.dangerOutline}>
                  <ShieldOff className="h-4 w-4" />
                  Desativar
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmOpen(true)} className={btn.success}>
                  <ShieldCheck className="h-4 w-4" />
                  Ativar
                </button>
              )}
              <button type="button" onClick={() => navigate(`/profiles/${profileId}/edit`)} className={btn.primary}>
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
                <h2 className={cardTitle}>Permissões</h2>
                <span className="text-xs text-slate-500">{groupedPermissions.length} módulos</span>
              </div>
              <div className={cardBody}>
                {groupedPermissions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Este perfil não dá nenhuma permissão. Usuários vinculados a ele não conseguem fazer nada no painel.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {groupedPermissions.map(([module, permissions]) => (
                      <div key={module}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{module}</p>
                        <div className="flex flex-wrap gap-2">
                          {permissions.map((permission) => (
                            <span key={permission.id} className={chip} title={permission.description || undefined}>
                              {permission.action}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Detalhes técnicos</h2>
              </div>
              <div className={cn(cardBody, "grid gap-5 md:grid-cols-3")}>
                <InfoItem label="ID" value={String(profile.id)} />
                <InfoItem label="Criado em" value={formatDateTime(profile.created_at)} />
                <InfoItem label="Atualizado em" value={formatDateTime(profile.updated_at)} />
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className={cn(card, "border-amber-200 bg-amber-50")}>
              <div className="space-y-2 px-5 py-4 text-sm text-amber-900">
                <p className="font-semibold">Antes de mexer</p>
                <p>Mudar as permissões deste perfil vale para todos os usuários vinculados a ele, na hora.</p>
                <p>Desativar o perfil pode tirar as permissões desses usuários até ele ser ativado de novo.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={profile.active ? "Desativar perfil" : "Ativar perfil"}
        description={
          profile.active
            ? `Usuários com o perfil ${profile.name} podem perder permissões no painel. Você pode ativar de novo depois.`
            : `O perfil ${profile.name} volta a valer para os usuários vinculados.`
        }
        confirmLabel={profile.active ? "Desativar" : "Ativar"}
        tone={profile.active ? "danger" : "default"}
        isPending={statusMutation.isPending}
        onConfirm={() => statusMutation.mutate(!profile.active)}
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
