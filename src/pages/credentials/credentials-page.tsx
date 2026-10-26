import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, Pagination, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { SearchableSelect } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { deleteCredential, listCredentials } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";
import type { CredentialRead } from "@/types/credential";

const PAGE_SIZE = 10;

type ActiveFilter = "" | "true" | "false";
const DEFAULT_ACTIVE_FILTER: ActiveFilter = "true";

export function CredentialsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(DEFAULT_ACTIVE_FILTER);
  const [deleteTarget, setDeleteTarget] = useState<CredentialRead | null>(null);

  const credentialsQuery = useQuery({
    queryKey: ["credentials"],
    queryFn: () => listCredentials(),
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCredential,
    onSuccess: async () => {
      toast.success("Credencial removida.");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["credentials"] });
      await credentialsQuery.refetch();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível remover a credencial.", error));
    },
  });

  const repositories = useMemo(() => repositoriesQuery.data ?? [], [repositoriesQuery.data]);
  const repositoryMap = useMemo(
    () => new Map(repositories.map((repository) => [repository.id, repository.name])),
    [repositories]
  );

  const filteredItems = useMemo(() => {
    const items = credentialsQuery.data ?? [];
    const query = normalizeSearch(search);

    return items.filter((item) => {
      const repositoryName = repositoryMap.get(item.repository_id) ?? "";
      const matchesSearch = query
        ? normalizeSearch(`${item.label} ${repositoryName} ${item.id}`).includes(query)
        : true;
      const matchesRepository = repositoryFilter ? item.repository_id === Number(repositoryFilter) : true;
      const matchesActive =
        activeFilter === "" ? true : activeFilter === "true" ? item.active : !item.active;
      return matchesSearch && matchesRepository && matchesActive;
    });
  }, [credentialsQuery.data, repositoryMap, search, repositoryFilter, activeFilter]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);

  const hasActiveFilters =
    search.trim() !== "" || repositoryFilter !== "" || activeFilter !== DEFAULT_ACTIVE_FILTER;

  function clearFilters() {
    setSearch("");
    setRepositoryFilter("");
    setActiveFilter(DEFAULT_ACTIVE_FILTER);
    setPage(1);
  }

  function handleRefresh() {
    credentialsQuery.refetch();
    repositoriesQuery.refetch();
  }

  function openDetail(credentialId: number) {
    navigate(`/credentials/${credentialId}`);
  }

  function openEdit(credentialId: number) {
    navigate(`/credentials/${credentialId}/edit`);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Credenciais"
          description="Logins, tokens e senhas que os robôs usam, guardados criptografados por repositório."
          actions={
            <>
              <RefreshIndicator
                updatedAt={credentialsQuery.dataUpdatedAt}
                isFetching={credentialsQuery.isFetching}
                onRefresh={handleRefresh}
              />
              <button type="button" onClick={() => navigate("/credentials/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Nova credencial
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Buscar por label ou repositório"
          />

          <SearchableSelect<number>
            value={repositoryFilter ? Number(repositoryFilter) : ""}
            onChange={(value) => {
              setRepositoryFilter(value === "" ? "" : String(value));
              setPage(1);
            }}
            options={repositories.map((repository) => ({ value: repository.id, label: repository.name }))}
            emptyLabel="Todos os repositórios"
            placeholder="Todos os repositórios"
            searchPlaceholder="Buscar repositório..."
            loading={repositoriesQuery.isLoading}
            className="w-56"
          />

          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as ActiveFilter);
              setPage(1);
            }}
            className={cn(select, "w-44")}
            aria-label="Status"
          >
            <option value="">Todos os status</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </FilterBar>

        {credentialsQuery.isLoading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : credentialsQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={credentialsQuery.error}
              what="as credenciais"
              onRetry={() => credentialsQuery.refetch()}
              retrying={credentialsQuery.isFetching}
            />
          </div>
        ) : paginatedItems.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={hasActiveFilters ? "Nenhuma credencial com esses filtros" : "Nenhuma credencial cadastrada"}
            description={
              hasActiveFilters
                ? "Tente outro texto ou limpe os filtros."
                : "Cadastre a primeira credencial para os robôs usarem."
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className={btn.secondary}>
                  Limpar filtros
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/credentials/new")} className={btn.primary}>
                  <Plus className="h-4 w-4" />
                  Nova credencial
                </button>
              )
            }
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>ID</th>
                  <th className={table.th}>Label</th>
                  <th className={table.th}>Repositório</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Criada em</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((credential) => {
                  const repositoryName =
                    repositoryMap.get(credential.repository_id) ?? `Repositório #${credential.repository_id}`;
                  return (
                    <tr
                      key={credential.id}
                      className={table.trClickable}
                      onClick={() => openDetail(credential.id)}
                    >
                      <td className={table.tdMuted}>{credential.id}</td>
                      <td className={table.tdStrong}>
                        <span className="inline-flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className={table.truncate} title={credential.label}>
                            {credential.label}
                          </span>
                        </span>
                      </td>
                      <td className={table.td}>
                        <span className={table.truncate} title={repositoryName}>
                          {repositoryName}
                        </span>
                      </td>
                      <td className={table.td}>
                        <span className={cn(badge, credential.active ? tone.success : tone.neutral)}>
                          {credential.active ? "Ativa" : "Inativa"}
                        </span>
                      </td>
                      <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(credential.created_at)}</td>
                      <td className={table.tdRight}>
                        <ActionsMenu
                          items={[
                            { label: "Informações", icon: Eye, onSelect: () => openDetail(credential.id) },
                            { label: "Editar", icon: Pencil, onSelect: () => openEdit(credential.id) },
                            {
                              label: "Excluir",
                              icon: Trash2,
                              tone: "danger",
                              separatorBefore: true,
                              disabled: deleteMutation.isPending,
                              onSelect: () => setDeleteTarget(credential),
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
        )}

        {!credentialsQuery.isLoading && !credentialsQuery.isError && total > 0 && (
          <Pagination page={safePage} totalPages={totalPages} total={total} onChange={setPage} label="credenciais" />
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir credencial"
        description={
          deleteTarget
            ? `A credencial "${deleteTarget.label}" será inativada e deixa de ser usada pelos robôs.`
            : undefined
        }
        confirmLabel="Excluir"
        tone="danger"
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
