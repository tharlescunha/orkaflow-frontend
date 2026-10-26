import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, RefreshCcw, Shield, ShieldCheck, ShieldOff } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ActiveFilterChips, FilterBar, Pagination, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, chip, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { activateProfile, deactivateProfile, listProfiles, type ProfileRead } from "@/services/api/profiles";
import { toast } from "@/store/toast-store";

const PAGE_SIZE = 10;

type ActiveFilter = "" | "true" | "false";

type StatusConfirmState = {
  id: number;
  name: string;
  active: boolean;
} | null;

const ACTIVE_LABEL: Record<ActiveFilter, string> = {
  "": "Todos os status",
  true: "Ativos",
  false: "Inativos",
};

export function ProfilesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("");
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState>(null);

  const profilesQuery = useQuery({
    queryKey: ["profiles", activeFilter],
    queryFn: () =>
      listProfiles({
        active: activeFilter === "" ? undefined : activeFilter === "true",
        limit: 500,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ profileId, active }: { profileId: number; active: boolean }) =>
      active ? activateProfile(profileId) : deactivateProfile(profileId),
    onSuccess: async (_, variables) => {
      toast.success(variables.active ? "Perfil ativado." : "Perfil desativado.");
      setStatusConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await profilesQuery.refetch();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar o status do perfil.", error));
    },
  });

  // Busca em cliente, sem diferenciar acento ou maiúscula (nome e descrição).
  const filtered = useMemo(() => {
    const all = profilesQuery.data ?? [];
    const q = normalizeSearch(search);
    if (!q) return all;
    return all.filter((profile) => normalizeSearch(`${profile.name} ${profile.description ?? ""}`).includes(q));
  }, [profilesQuery.data, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const items = useMemo(() => filtered.slice(skip, skip + PAGE_SIZE), [filtered, skip]);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeActive(value: ActiveFilter) {
    setActiveFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setActiveFilter("");
    setPage(1);
  }

  const hasActiveFilters = search !== "" || activeFilter !== "";

  const chips = [
    ...(search ? [{ key: "search", label: `Busca: ${search}`, onRemove: () => changeSearch("") }] : []),
    ...(activeFilter !== ""
      ? [{ key: "active", label: `Status: ${ACTIVE_LABEL[activeFilter]}`, onRemove: () => changeActive("") }]
      : []),
  ];

  function openStatusConfirm(profile: ProfileRead) {
    setStatusConfirm({ id: profile.id, name: profile.name, active: profile.active });
  }

  function handleConfirmStatus() {
    if (!statusConfirm) return;
    statusMutation.mutate({ profileId: statusConfirm.id, active: !statusConfirm.active });
  }

  const newProfileButton = (
    <button type="button" onClick={() => navigate("/profiles/new")} className={btn.primary}>
      <Plus className="h-4 w-4" />
      Novo perfil
    </button>
  );

  return (
    <section className={card}>
      <PageHeader
        title="Perfis de acesso"
        description="Cada perfil agrupa as permissões que os usuários vinculados a ele têm no painel."
        actions={
          <>
            <button type="button" onClick={() => profilesQuery.refetch()} className={btn.secondary} disabled={profilesQuery.isFetching}>
              <RefreshCcw className={cn("h-4 w-4", profilesQuery.isFetching && "animate-spin")} />
              Atualizar
            </button>
            {newProfileButton}
          </>
        }
      />

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <SearchInput value={search} onChange={changeSearch} placeholder="Buscar por nome ou descrição" />

        <select
          value={activeFilter}
          onChange={(e) => changeActive(e.target.value as ActiveFilter)}
          aria-label="Status"
          className={cn(select, "w-full sm:w-44")}
        >
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
        </select>
      </FilterBar>

      <ActiveFilterChips chips={chips} />

      {profilesQuery.isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : profilesQuery.isError ? (
        <div className="p-5">
          <QueryError error={profilesQuery.error} what="os perfis" onRetry={() => profilesQuery.refetch()} retrying={profilesQuery.isFetching} />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Shield}
          title={hasActiveFilters ? "Nenhum perfil com esses filtros" : "Nenhum perfil cadastrado"}
          description={
            hasActiveFilters
              ? "Tente outra busca ou limpe os filtros."
              : "Crie o primeiro perfil e escolha as permissões que ele dá."
          }
          action={
            hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className={btn.secondary}>
                Limpar filtros
              </button>
            ) : (
              newProfileButton
            )
          }
        />
      ) : (
        <>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Nome</th>
                  <th className={table.th}>Descrição</th>
                  <th className={table.th}>Permissões</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Criado em</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((profile) => {
                  const permissionCount = profile.permissions?.length ?? 0;
                  return (
                    <tr key={profile.id} className={table.trClickable} onClick={() => navigate(`/profiles/${profile.id}`)}>
                      <td className={table.tdStrong}>
                        <span className={table.truncate} title={profile.name}>
                          {profile.name}
                        </span>
                      </td>
                      <td className={table.tdMuted}>
                        <span className="block max-w-[360px] truncate" title={profile.description || undefined}>
                          {profile.description || "---"}
                        </span>
                      </td>
                      <td className={table.td}>
                        <span className={chip}>
                          <Shield className="h-3.5 w-3.5" />
                          {permissionCount === 1 ? "1 permissão" : `${permissionCount} permissões`}
                        </span>
                      </td>
                      <td className={table.td}>
                        <span className={cn(badge, profile.active ? tone.success : tone.neutral)}>
                          {profile.active ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(profile.created_at)}</td>
                      <td className={table.tdRight}>
                        <ActionsMenu
                          label={`Ações de ${profile.name}`}
                          items={[
                            { label: "Ver", icon: Eye, onSelect: () => navigate(`/profiles/${profile.id}`) },
                            { label: "Editar", icon: Pencil, onSelect: () => navigate(`/profiles/${profile.id}/edit`) },
                            profile.active
                              ? {
                                  label: "Desativar",
                                  icon: ShieldOff,
                                  tone: "danger",
                                  separatorBefore: true,
                                  disabled: statusMutation.isPending,
                                  onSelect: () => openStatusConfirm(profile),
                                }
                              : {
                                  label: "Ativar",
                                  icon: ShieldCheck,
                                  tone: "success",
                                  separatorBefore: true,
                                  disabled: statusMutation.isPending,
                                  onSelect: () => openStatusConfirm(profile),
                                },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination page={currentPage} totalPages={totalPages} total={total} onChange={setPage} label="perfis" />
        </>
      )}

      <ConfirmDialog
        open={statusConfirm !== null}
        title={statusConfirm?.active ? "Desativar perfil" : "Ativar perfil"}
        description={
          statusConfirm?.active
            ? `Usuários com o perfil ${statusConfirm.name} podem perder permissões no painel. Você pode ativar de novo depois.`
            : `O perfil ${statusConfirm?.name ?? ""} volta a valer para os usuários vinculados.`
        }
        confirmLabel={statusConfirm?.active ? "Desativar" : "Ativar"}
        tone={statusConfirm?.active ? "danger" : "default"}
        isPending={statusMutation.isPending}
        onConfirm={handleConfirmStatus}
        onCancel={() => setStatusConfirm(null)}
      />
    </section>
  );
}
