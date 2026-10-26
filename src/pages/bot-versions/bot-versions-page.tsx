import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Eye, GitCommitHorizontal, Plus, RotateCcw } from "lucide-react";

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
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listBotVersions, releaseBotVersion, type BotVersionRead } from "@/services/api/bot-versions";
import { listAllBots } from "@/services/api/bots";
import { toast } from "@/store/toast-store";

const PAGE_SIZE = 10;

type ActiveFilter = "" | "true" | "false";

export function BotVersionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("");
  const [releaseTarget, setReleaseTarget] = useState<BotVersionRead | null>(null);

  const versionsQuery = useQuery({
    queryKey: ["bot-versions"],
    queryFn: listBotVersions,
  });

  const botsQuery = useQuery({
    queryKey: ["bots-select-for-versions"],
    queryFn: () => listAllBots(),
  });

  const releaseMutation = useMutation({
    mutationFn: (versionId: number) => releaseBotVersion(versionId),
    onSuccess: (released) => {
      toast.success(`Release feito: o orquestrador passa a executar a versão ${released.version}.`);
      queryClient.invalidateQueries({ queryKey: ["bot-versions"] });
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      setReleaseTarget(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível fazer o Release."));
      setReleaseTarget(null);
    },
  });

  const bots = useMemo(
    () => [...(botsQuery.data?.items ?? [])].sort((a, b) => Number(b.active) - Number(a.active)),
    [botsQuery.data]
  );
  const botNameMap = useMemo(() => new Map(bots.map((bot) => [bot.id, bot.name])), [bots]);

  function botName(botId: number) {
    return botNameMap.get(botId) ?? `Bot #${botId}`;
  }

  const filteredItems = useMemo(() => {
    const versions = versionsQuery.data ?? [];
    const query = normalizeSearch(search);
    return versions.filter((item) => {
      const name = botNameMap.get(item.bot_id) ?? `Bot #${item.bot_id}`;
      const matchesSearch = query
        ? normalizeSearch(`${item.version} ${name} ${item.commit_hash ?? ""}`).includes(query)
        : true;
      const matchesBot = !botFilter || String(item.bot_id) === botFilter;
      const matchesActive =
        activeFilter === "" ? true : activeFilter === "true" ? item.is_active : !item.is_active;
      return matchesSearch && matchesBot && matchesActive;
    });
  }, [versionsQuery.data, search, botFilter, activeFilter, botNameMap]);

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const skip = (safePage - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(skip, skip + PAGE_SIZE);

  const hasActiveFilters = search.trim() !== "" || botFilter !== "" || activeFilter !== "";

  function clearFilters() {
    setSearch("");
    setBotFilter("");
    setActiveFilter("");
    setPage(1);
  }

  function handleRefresh() {
    versionsQuery.refetch();
    botsQuery.refetch();
  }

  function openDetail(versionId: number) {
    navigate(`/bot-versions/${versionId}`);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Versões dos bots"
          description="Cada versão aponta para um commit do Git. A versão em uso é a que o orquestrador executa."
          actions={
            <>
              <RefreshIndicator
                updatedAt={versionsQuery.dataUpdatedAt}
                isFetching={versionsQuery.isFetching}
                onRefresh={handleRefresh}
              />
              <button type="button" onClick={() => navigate("/bot-versions/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Nova versão
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
            placeholder="Buscar por versão, bot ou commit"
          />

          <SearchableSelect<number>
            value={botFilter ? Number(botFilter) : ""}
            onChange={(value) => {
              setBotFilter(value === "" ? "" : String(value));
              setPage(1);
            }}
            options={bots.map((bot) => ({
              value: bot.id,
              label: bot.name,
              description: bot.active ? bot.repository_name : "Inativo",
            }))}
            emptyLabel="Todos os bots"
            placeholder="Todos os bots"
            searchPlaceholder="Buscar bot..."
            loading={botsQuery.isLoading}
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

        {versionsQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : versionsQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={versionsQuery.error}
              what="as versões"
              onRetry={() => versionsQuery.refetch()}
              retrying={versionsQuery.isFetching}
            />
          </div>
        ) : paginatedItems.length === 0 ? (
          <EmptyState
            icon={GitCommitHorizontal}
            title={hasActiveFilters ? "Nenhuma versão com esses filtros" : "Nenhuma versão cadastrada"}
            description={
              hasActiveFilters
                ? "Tente outro texto ou limpe os filtros."
                : "Crie a primeira versão a partir do Git do bot."
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className={btn.secondary}>
                  Limpar filtros
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/bot-versions/new")} className={btn.primary}>
                  <Plus className="h-4 w-4" />
                  Nova versão
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
                  <th className={table.th}>Bot</th>
                  <th className={table.th}>Versão</th>
                  <th className={table.th}>Commit (Git)</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Criada em</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} className={table.trClickable} onClick={() => openDetail(item.id)}>
                    <td className={table.tdMuted}>{item.id}</td>
                    <td className={table.tdStrong}>
                      <span className={table.truncate} title={botName(item.bot_id)}>
                        {botName(item.bot_id)}
                      </span>
                    </td>
                    <td className={table.td}>
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="font-mono">{item.version}</span>
                        {item.in_use ? (
                          <span
                            className={cn(badge, tone.success)}
                            title={item.pinned ? "Fixada por Release" : "Versão mais nova"}
                          >
                            {item.pinned ? "Em uso (Release)" : "Em uso"}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={cn(table.tdMuted, "font-mono text-xs")}>
                      {item.commit_hash ? item.commit_hash.slice(0, 7) : "---"}
                    </td>
                    <td className={table.td}>
                      <span className={cn(badge, item.is_active ? tone.success : tone.neutral)}>
                        {item.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(item.created_at)}</td>
                    <td className={table.tdRight}>
                      <ActionsMenu
                        items={[
                          { label: "Informações", icon: Eye, onSelect: () => openDetail(item.id) },
                          {
                            label: item.in_use ? "Já é a versão em uso" : "Release",
                            icon: RotateCcw,
                            disabled: Boolean(item.in_use),
                            onSelect: () => setReleaseTarget(item),
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

        {!versionsQuery.isLoading && !versionsQuery.isError && total > 0 && (
          <Pagination page={safePage} totalPages={totalPages} total={total} onChange={setPage} label="versões" />
        )}
      </section>

      <ConfirmDialog
        open={releaseTarget !== null}
        title="Release da versão"
        confirmLabel="Fazer Release"
        tone={releaseTarget && !releaseTarget.commit_hash ? "warning" : "default"}
        isPending={releaseMutation.isPending}
        onConfirm={() => releaseTarget && releaseMutation.mutate(releaseTarget.id)}
        onCancel={() => {
          if (!releaseMutation.isPending) setReleaseTarget(null);
        }}
        description={
          releaseTarget ? (
            <div className="space-y-3">
              <p>
                Bot: <strong>{botName(releaseTarget.bot_id)}</strong>
                <br />
                Versão: <strong className="font-mono">{releaseTarget.version}</strong>
                {releaseTarget.commit_hash ? ` (commit ${releaseTarget.commit_hash.slice(0, 7)})` : ""}
              </p>
              <p>
                As próximas execuções desse bot usam esta versão. As máquinas baixam o commit dela antes de
                rodar.
              </p>
              <p className="text-slate-500">
                Fazer Release na versão mais nova volta o bot a seguir sempre a mais nova. Criar uma versão
                nova também.
              </p>
              {!releaseTarget.commit_hash ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  Esta versão não tem commit registrado (cadastro antigo/manual): a máquina não tem como voltar
                  o código para ela.
                </p>
              ) : null}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
