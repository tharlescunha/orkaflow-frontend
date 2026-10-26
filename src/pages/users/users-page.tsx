import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, RefreshCcw, Shield, UserCheck, UserX, Users } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ActiveFilterChips, FilterBar, Pagination, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableSelect } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { badge, btn, card, chip, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listProfiles } from "@/services/api/profiles";
import { blockUser, listUsers, unblockUser, type UserRead } from "@/services/api/users";
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
  false: "Bloqueados",
};

export function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("true");
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

  const statusMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: number; active: boolean }) =>
      active ? unblockUser(userId) : blockUser(userId),
    onSuccess: async (_, variables) => {
      toast.success(variables.active ? "Usuário desbloqueado." : "Usuário bloqueado. Ele perdeu o acesso agora.");
      setStatusConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await usersQuery.refetch();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar o status do usuário.", error));
    },
  });

  const allItems = usersQuery.data ?? [];
  const total = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;
  const items = allItems.slice(skip, skip + PAGE_SIZE);

  const profiles = profilesQuery.data ?? [];
  const selectedProfileName = profiles.find((p) => String(p.id) === profileFilter)?.name;

  // Qualquer filtro muda a página de volta para a primeira (no handler, não em efeito).
  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeProfile(value: string) {
    setProfileFilter(value);
    setPage(1);
  }

  function changeActive(value: ActiveFilter) {
    setActiveFilter(value);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setProfileFilter("");
    setActiveFilter("");
    setPage(1);
  }

  // O padrão da tela é "só ativos"; "Todos" conta como filtro alterado.
  const hasActiveFilters = search !== "" || profileFilter !== "" || activeFilter !== "true";

  const chips = [
    ...(search ? [{ key: "search", label: `Busca: ${search}`, onRemove: () => changeSearch("") }] : []),
    ...(profileFilter
      ? [{ key: "profile", label: `Perfil: ${selectedProfileName ?? profileFilter}`, onRemove: () => changeProfile("") }]
      : []),
    ...(activeFilter !== "true"
      ? [{ key: "active", label: `Status: ${ACTIVE_LABEL[activeFilter]}`, onRemove: () => changeActive("true") }]
      : []),
  ];

  function handleRefresh() {
    usersQuery.refetch();
    profilesQuery.refetch();
  }

  function openStatusConfirm(user: UserRead) {
    setStatusConfirm({ id: user.id, name: user.name, active: user.active });
  }

  function handleConfirmStatus() {
    if (!statusConfirm) return;
    statusMutation.mutate({ userId: statusConfirm.id, active: !statusConfirm.active });
  }

  const newUserButton = (
    <button type="button" onClick={() => navigate("/users/new")} className={btn.primary}>
      <Plus className="h-4 w-4" />
      Novo usuário
    </button>
  );

  return (
    <section className={card}>
      <PageHeader
        title="Usuários"
        description="Quem acessa o painel, com que perfil, e bloqueio de acesso."
        actions={
          <>
            <button type="button" onClick={handleRefresh} className={btn.secondary} disabled={usersQuery.isFetching}>
              <RefreshCcw className={cn("h-4 w-4", usersQuery.isFetching && "animate-spin")} />
              Atualizar
            </button>
            {newUserButton}
          </>
        }
      />

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <SearchInput value={search} onChange={changeSearch} placeholder="Buscar por nome, login ou e-mail" />

        <SearchableSelect<number>
          value={profileFilter ? Number(profileFilter) : ""}
          onChange={(value) => changeProfile(value === "" ? "" : String(value))}
          options={profiles.map((profile) => ({ value: profile.id, label: profile.name }))}
          emptyLabel="Todos os perfis"
          placeholder="Todos os perfis"
          searchPlaceholder="Buscar perfil..."
          loading={profilesQuery.isLoading}
          className="w-full sm:w-56"
        />

        <select
          value={activeFilter}
          onChange={(e) => changeActive(e.target.value as ActiveFilter)}
          aria-label="Status"
          className={cn(select, "w-full sm:w-44")}
        >
          <option value="">Todos os status</option>
          <option value="true">Ativos</option>
          <option value="false">Bloqueados</option>
        </select>
      </FilterBar>

      <ActiveFilterChips chips={chips} />

      {usersQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : usersQuery.isError ? (
        <div className="p-5">
          <QueryError error={usersQuery.error} what="os usuários" onRetry={() => usersQuery.refetch()} retrying={usersQuery.isFetching} />
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Users}
          title={hasActiveFilters ? "Nenhum usuário com esses filtros" : "Nenhum usuário cadastrado"}
          description={
            hasActiveFilters
              ? "Tente outra busca ou limpe os filtros."
              : "Cadastre o primeiro usuário e vincule um perfil de acesso."
          }
          action={
            hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className={btn.secondary}>
                Limpar filtros
              </button>
            ) : (
              newUserButton
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
                  <th className={table.th}>Login</th>
                  <th className={table.th}>E-mail</th>
                  <th className={table.th}>Perfil</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Criado em</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id} className={table.trClickable} onClick={() => navigate(`/users/${user.id}`)}>
                    <td className={table.tdStrong}>
                      <span className={table.truncate} title={user.name}>
                        {user.name}
                      </span>
                    </td>
                    <td className={table.tdMuted}>
                      <span className="block max-w-[180px] truncate" title={user.login}>
                        {user.login}
                      </span>
                    </td>
                    <td className={table.tdMuted}>
                      <span className={table.truncate} title={user.email ?? undefined}>
                        {user.email}
                      </span>
                    </td>
                    <td className={table.td}>
                      {user.profile?.name ? (
                        <span className={chip}>
                          <Shield className="h-3.5 w-3.5" />
                          {user.profile.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Sem perfil</span>
                      )}
                    </td>
                    <td className={table.td}>
                      <span className={cn(badge, user.active ? tone.success : tone.danger)}>
                        {user.active ? "Ativo" : "Bloqueado"}
                      </span>
                    </td>
                    <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(user.created_at)}</td>
                    <td className={table.tdRight}>
                      <ActionsMenu
                        label={`Ações de ${user.name}`}
                        items={[
                          { label: "Ver", icon: Eye, onSelect: () => navigate(`/users/${user.id}`) },
                          { label: "Editar", icon: Pencil, onSelect: () => navigate(`/users/${user.id}/edit`) },
                          user.active
                            ? {
                                label: "Bloquear",
                                icon: UserX,
                                tone: "danger",
                                separatorBefore: true,
                                disabled: statusMutation.isPending,
                                onSelect: () => openStatusConfirm(user),
                              }
                            : {
                                label: "Desbloquear",
                                icon: UserCheck,
                                tone: "success",
                                separatorBefore: true,
                                disabled: statusMutation.isPending,
                                onSelect: () => openStatusConfirm(user),
                              },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={currentPage} totalPages={totalPages} total={total} onChange={setPage} label="usuários" />
        </>
      )}

      <ConfirmDialog
        open={statusConfirm !== null}
        title={statusConfirm?.active ? "Bloquear usuário" : "Desbloquear usuário"}
        description={
          statusConfirm?.active
            ? `${statusConfirm.name} perde o acesso ao painel na hora. Você pode desbloquear depois.`
            : `${statusConfirm?.name ?? "O usuário"} volta a acessar o painel normalmente.`
        }
        confirmLabel={statusConfirm?.active ? "Bloquear" : "Desbloquear"}
        tone={statusConfirm?.active ? "danger" : "default"}
        isPending={statusMutation.isPending}
        onConfirm={handleConfirmStatus}
        onCancel={() => setStatusConfirm(null)}
      />
    </section>
  );
}
