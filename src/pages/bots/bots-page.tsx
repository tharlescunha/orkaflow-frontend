import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bot, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, Pagination, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { SearchableSelect } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { deleteBot, listBots } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { toast } from "@/store/toast-store";
import type { BotListItem } from "@/types/bot";

const PAGE_SIZE = 10;

type ActiveFilter = "" | "true" | "false";

const DEFAULT_ACTIVE_FILTER: ActiveFilter = "true";

export function BotsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(DEFAULT_ACTIVE_FILTER);
  const [deleteTarget, setDeleteTarget] = useState<BotListItem | null>(null);

  const skip = (page - 1) * PAGE_SIZE;

  // A busca é feita na API (search), então não passa por normalizeSearch aqui.
  const botsQuery = useQuery({
    queryKey: ["bots", page, search, repositoryFilter, activeFilter],
    queryFn: () =>
      listBots({
        skip,
        limit: PAGE_SIZE,
        search: search || undefined,
        repository_id: repositoryFilter ? Number(repositoryFilter) : undefined,
        active: activeFilter === "" ? undefined : activeFilter === "true",
      }),
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBot,
    onSuccess: async (_data, botId) => {
      const name = deleteTarget?.id === botId ? deleteTarget.name : `#${botId}`;
      setDeleteTarget(null);
      toast.success(`Bot "${name}" apagado.`);
      await queryClient.invalidateQueries({ queryKey: ["bots"] });
      await botsQuery.refetch();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível apagar o bot."));
    },
  });

  const items = botsQuery.data?.items ?? [];
  const total = botsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const repositories = repositoriesQuery.data ?? [];

  const hasActiveFilters =
    search.trim() !== "" || repositoryFilter !== "" || activeFilter !== DEFAULT_ACTIVE_FILTER;

  function handleRefresh() {
    botsQuery.refetch();
  }

  function handleClearFilters() {
    setPage(1);
    setSearch("");
    setRepositoryFilter("");
    setActiveFilter(DEFAULT_ACTIVE_FILTER);
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Bots"
          description="Código dos robôs: repositório, versão, modo de execução e tempo limite."
          actions={
            <>
              <RefreshIndicator
                updatedAt={botsQuery.dataUpdatedAt}
                isFetching={botsQuery.isFetching}
                onRefresh={handleRefresh}
              />
              <button type="button" onClick={() => navigate("/bots/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Novo bot
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={handleClearFilters}>
          <SearchInput
            value={search}
            onChange={(value) => {
              setPage(1);
              setSearch(value);
            }}
            placeholder="Buscar por nome"
          />

          <SearchableSelect<number>
            value={repositoryFilter ? Number(repositoryFilter) : ""}
            onChange={(value) => {
              setPage(1);
              setRepositoryFilter(value === "" ? "" : String(value));
            }}
            options={repositories.map((repository) => ({
              value: repository.id,
              label: repository.name,
            }))}
            emptyLabel="Todos os repositórios"
            placeholder="Todos os repositórios"
            searchPlaceholder="Buscar repositório..."
            loading={repositoriesQuery.isLoading}
            className="w-full sm:w-56"
          />

          <select
            value={activeFilter}
            onChange={(e) => {
              setPage(1);
              setActiveFilter(e.target.value as ActiveFilter);
            }}
            className={cn(select, "w-full sm:w-44")}
            aria-label="Filtrar por status"
          >
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
            <option value="">Ativos e inativos</option>
          </select>
        </FilterBar>

        {botsQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : botsQuery.isError ? (
          <div className="px-5 py-5">
            <QueryError error={botsQuery.error} what="os bots" onRetry={handleRefresh} retrying={botsQuery.isFetching} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={hasActiveFilters ? "Nenhum bot com esses filtros" : "Nenhum bot cadastrado"}
            description={
              hasActiveFilters
                ? "Tente outro termo ou limpe os filtros para ver todos."
                : "Cadastre o primeiro bot para poder criar automações."
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={handleClearFilters} className={btn.secondary}>
                  Limpar filtros
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/bots/new")} className={btn.primary}>
                  <Plus className="h-4 w-4" />
                  Novo bot
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
                  <th className={table.th}>Nome</th>
                  <th className={table.th}>Repositório</th>
                  <th className={table.th}>Versão atual</th>
                  <th className={table.th}>Versão lançamento</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Criado em</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {items.map((bot) => (
                  <tr key={bot.id} className={table.trClickable} onClick={() => navigate(`/bots/${bot.id}`)}>
                    <td className={cn(table.tdMuted, "tabular-nums")}>{bot.id}</td>

                    <td className={table.tdStrong}>
                      <span className={table.truncate} title={bot.name}>
                        {bot.name}
                      </span>
                      {bot.description && (
                        <span
                          className="mt-0.5 block max-w-[280px] truncate text-xs font-normal text-slate-500"
                          title={bot.description}
                        >
                          {bot.description}
                        </span>
                      )}
                    </td>

                    <td className={table.td}>
                      <span
                        className="block max-w-[220px] truncate"
                        title={bot.repository_name || (bot.repository_id ? `Repositório #${bot.repository_id}` : undefined)}
                      >
                        {bot.repository_name || (bot.repository_id ? `Repositório #${bot.repository_id}` : "---")}
                      </span>
                    </td>

                    <td className={cn(table.td, "font-mono text-xs")}>{bot.current_version || "---"}</td>
                    <td className={cn(table.td, "font-mono text-xs")}>{bot.release_version || "---"}</td>

                    <td className={table.td}>
                      <span className={cn(badge, bot.active ? tone.success : tone.neutral)}>
                        {bot.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(bot.created_at)}</td>

                    <td className={table.tdRight}>
                      <ActionsMenu
                        label={`Ações de ${bot.name}`}
                        items={[
                          { label: "Informações", icon: Eye, onSelect: () => navigate(`/bots/${bot.id}`) },
                          { label: "Editar", icon: Pencil, onSelect: () => navigate(`/bots/${bot.id}/edit`) },
                          {
                            label: "Apagar",
                            icon: Trash2,
                            tone: "danger",
                            separatorBefore: true,
                            disabled: deleteMutation.isPending,
                            onSelect: () => setDeleteTarget(bot),
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

        {!botsQuery.isLoading && !botsQuery.isError && total > 0 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            label={total === 1 ? "bot" : "bots"}
            onChange={(next) => setPage(Math.min(Math.max(1, next), totalPages))}
          />
        )}
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Apagar bot"
        description={
          deleteTarget
            ? `Apagar o bot "${deleteTarget.name}"? Automações que usam este bot deixam de funcionar. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Apagar"
        tone="danger"
        isPending={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
