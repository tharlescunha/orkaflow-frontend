import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FolderGit2, Pencil, Plus, Power, PowerOff } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY, formatDateTime } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { activateRepository, disableRepository, listRepositories, type RepositoryRead } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";

type ActiveFilter = "all" | "true" | "false";

const DEFAULT_ACTIVE: ActiveFilter = "all";
const REFETCH_MS = 10000;

type ConfirmState = { id: number; name: string; active: boolean } | null;

export function RepositoriesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(DEFAULT_ACTIVE);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const queryParams = useMemo(() => {
    return {
      active: activeFilter === "all" ? undefined : activeFilter === "true",
      limit: 100,
      skip: 0,
    };
  }, [activeFilter]);

  const repositoriesQuery = useQuery({
    queryKey: ["repositories", queryParams],
    queryFn: () => listRepositories(queryParams),
    refetchInterval: REFETCH_MS,
  });

  const activateMutation = useMutation({
    mutationFn: (repositoryId: number) => activateRepository(repositoryId),
    onSuccess: () => {
      toast.success("Repositório ativado.");
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      setConfirm(null);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível ativar o repositório.", error));
    },
  });

  const disableMutation = useMutation({
    mutationFn: (repositoryId: number) => disableRepository(repositoryId),
    onSuccess: () => {
      toast.success("Repositório desativado.");
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
      setConfirm(null);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível desativar o repositório.", error));
    },
  });

  const repositories = useMemo(() => {
    const term = normalizeSearch(search);
    const all = repositoriesQuery.data ?? [];
    if (!term) return all;
    return all.filter(
      (repository) =>
        normalizeSearch(repository.name).includes(term) || normalizeSearch(repository.description ?? "").includes(term)
    );
  }, [repositoriesQuery.data, search]);

  const hasActiveFilters = search !== "" || activeFilter !== DEFAULT_ACTIVE;

  function clearFilters() {
    setSearch("");
    setActiveFilter(DEFAULT_ACTIVE);
  }

  function handleConfirmToggle() {
    if (!confirm) return;
    if (confirm.active) {
      disableMutation.mutate(confirm.id);
      return;
    }
    activateMutation.mutate(confirm.id);
  }

  const isSubmitting = activateMutation.isPending || disableMutation.isPending;

  const newButton = (
    <button type="button" onClick={() => navigate("/repositories/new")} className={btn.primary}>
      <Plus className="h-4 w-4" />
      Novo repositório
    </button>
  );

  return (
    <section className={card}>
      <PageHeader
        title="Repositórios"
        description="Onde ficam os bots: cada automação aponta para um repositório."
        actions={
          <>
            <RefreshIndicator
              updatedAt={repositoriesQuery.dataUpdatedAt}
              isFetching={repositoriesQuery.isFetching}
              onRefresh={() => repositoriesQuery.refetch()}
              intervalMs={REFETCH_MS}
            />
            {newButton}
          </>
        }
      />

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou descrição" />

        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          aria-label="Status"
          className={cn(select, "w-full sm:w-44")}
        >
          <option value="all">Todos os status</option>
          <option value="true">Somente ativos</option>
          <option value="false">Somente inativos</option>
        </select>
      </FilterBar>

      {repositoriesQuery.isLoading ? (
        <TableSkeleton rows={6} columns={5} />
      ) : repositoriesQuery.isError ? (
        <div className="p-5">
          <QueryError
            error={repositoriesQuery.error}
            what="os repositórios"
            onRetry={() => repositoriesQuery.refetch()}
            retrying={repositoriesQuery.isFetching}
          />
        </div>
      ) : repositories.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title={hasActiveFilters ? "Nenhum repositório com esses filtros" : "Nenhum repositório cadastrado"}
          description={
            hasActiveFilters ? "Tente outra busca ou limpe os filtros." : "Cadastre o primeiro repositório para vincular bots e automações."
          }
          action={
            hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className={btn.secondary}>
                Limpar filtros
              </button>
            ) : (
              newButton
            )
          }
        />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Nome</th>
                <th className={table.th}>Descrição</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Criado em</th>
                <th className={table.thRight}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {repositories.map((repository: RepositoryRead) => (
                <tr key={repository.id} className={table.trClickable} onClick={() => navigate(`/repositories/${repository.id}`)}>
                  <td className={table.tdStrong}>
                    <span className={table.truncate} title={repository.name}>
                      {repository.name}
                    </span>
                  </td>

                  <td className={table.tdMuted}>
                    <span className="block max-w-[420px] truncate" title={repository.description ?? undefined}>
                      {repository.description || EMPTY}
                    </span>
                  </td>

                  <td className={table.td}>
                    <span className={cn(badge, repository.active ? tone.success : tone.neutral)}>
                      {repository.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>

                  <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(repository.created_at)}</td>

                  <td className={table.tdRight}>
                    <ActionsMenu
                      label={`Ações de ${repository.name}`}
                      items={[
                        { label: "Ver", icon: Eye, onSelect: () => navigate(`/repositories/${repository.id}`) },
                        { label: "Editar", icon: Pencil, onSelect: () => navigate(`/repositories/${repository.id}/edit`) },
                        repository.active
                          ? {
                              label: "Desativar",
                              icon: PowerOff,
                              tone: "danger",
                              separatorBefore: true,
                              disabled: isSubmitting,
                              onSelect: () => setConfirm({ id: repository.id, name: repository.name, active: true }),
                            }
                          : {
                              label: "Ativar",
                              icon: Power,
                              tone: "success",
                              separatorBefore: true,
                              disabled: isSubmitting,
                              onSelect: () => setConfirm({ id: repository.id, name: repository.name, active: false }),
                            },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.active ? "Desativar repositório" : "Ativar repositório"}
        description={
          confirm?.active
            ? `"${confirm.name}" será desativado e todos os bots e automações dele são desativados junto: nada do repositório continua rodando nem sendo sincronizado nas máquinas. Reativar o repositório depois não reativa os bots e automações (isso é feito um a um).`
            : `"${confirm?.name ?? ""}" volta a ficar disponível para automações.`
        }
        confirmLabel={confirm?.active ? "Desativar" : "Ativar"}
        tone={confirm?.active ? "danger" : "default"}
        isPending={isSubmitting}
        onConfirm={handleConfirmToggle}
        onCancel={() => setConfirm(null)}
      />
    </section>
  );
}
