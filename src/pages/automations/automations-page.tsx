import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Play, Plus, Power, Workflow } from "lucide-react";

import { ActionsMenu, type ActionItem } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { SearchableSelect } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { runNowPayload } from "@/lib/run-task";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  activateAutomation,
  deactivateAutomation,
  listAutomations,
  type AutomationRead,
} from "@/services/api/automations";
import { listAllBots } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";
import { createTask } from "@/services/api/tasks";
import { toast } from "@/store/toast-store";

type ActiveFilter = "all" | "true" | "false";

const DEFAULT_ACTIVE_FILTER: ActiveFilter = "true";

export function AutomationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [repositoryFilter, setRepositoryFilter] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(DEFAULT_ACTIVE_FILTER);
  const [confirmAutomation, setConfirmAutomation] = useState<AutomationRead | null>(null);
  const [runNowAutomation, setRunNowAutomation] = useState<AutomationRead | null>(null);

  const queryParams = useMemo(() => {
    return {
      repository_id: repositoryFilter ? Number(repositoryFilter) : undefined,
      bot_id: botFilter ? Number(botFilter) : undefined,
      active:
        activeFilter === "all"
          ? undefined
          : activeFilter === "true"
          ? true
          : false,
    };
  }, [repositoryFilter, botFilter, activeFilter]);

  const automationsQuery = useQuery({
    queryKey: ["automations", queryParams],
    queryFn: () => listAutomations(queryParams),
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-filter-automations"],
    queryFn: () => listRepositories({ limit: 100 }),
  });

  const botsQuery = useQuery({
    queryKey: ["bots-filter-automations"],
    queryFn: () => listAllBots(),
  });

  const activateMutation = useMutation({
    mutationFn: (automationId: number) => activateAutomation(automationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setConfirmAutomation(null);
      toast.success(`Automação "${data.name}" ativada.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível ativar a automação."));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (automationId: number) => deactivateAutomation(automationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setConfirmAutomation(null);
      toast.success(`Automação "${data.name}" desativada.`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível desativar a automação."));
    },
  });

  const runNowMutation = useMutation({
    mutationFn: (automation: AutomationRead) => createTask(runNowPayload(automation)),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setRunNowAutomation(null);
      toast.success(`Task #${data.task.id} entrou na fila.`);
      navigate(`/tasks/${data.task.id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível criar a task."));
    },
  });

  function handleRefresh() {
    automationsQuery.refetch();
  }

  function handleClearFilters() {
    setSearch("");
    setRepositoryFilter("");
    setBotFilter("");
    setActiveFilter(DEFAULT_ACTIVE_FILTER);
  }

  function handleConfirmToggle() {
    if (!confirmAutomation) return;

    if (confirmAutomation.active) {
      deactivateMutation.mutate(confirmAutomation.id);
      return;
    }

    activateMutation.mutate(confirmAutomation.id);
  }

  function handleConfirmRunNow() {
    if (!runNowAutomation) return;
    runNowMutation.mutate(runNowAutomation);
  }

  const isToggling = activateMutation.isPending || deactivateMutation.isPending;

  const allAutomations = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);
  const repositories = repositoriesQuery.data ?? [];
  const bots = botsQuery.data?.items ?? [];

  // Busca no cliente (a API não filtra por texto): nome, label, descrição, bot e repositório.
  const automations = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return allAutomations;
    return allAutomations.filter((automation) =>
      normalizeSearch(
        [
          automation.name,
          automation.label ?? "",
          automation.description ?? "",
          automation.bot_name ?? "",
          automation.repository_name ?? "",
          String(automation.id),
        ].join(" ")
      ).includes(term)
    );
  }, [allAutomations, search]);

  const hasActiveFilters =
    search.trim() !== "" ||
    repositoryFilter !== "" ||
    botFilter !== "" ||
    activeFilter !== DEFAULT_ACTIVE_FILTER;

  const repositoryOptions = repositories.map((repository) => ({
    value: String(repository.id),
    label: repository.name,
    description: repository.active ? null : "Inativo",
  }));

  const botOptions = bots
    .filter((bot) =>
      repositoryFilter ? bot.repository_id === Number(repositoryFilter) : true
    )
    .map((bot) => ({
      value: String(bot.id),
      label: bot.name,
      description: bot.active ? null : "Inativo",
    }));

  function buildActions(automation: AutomationRead): ActionItem[] {
    const items: ActionItem[] = [
      { label: "Informações", icon: Eye, onSelect: () => navigate(`/automations/${automation.id}`) },
      { label: "Editar", icon: Pencil, onSelect: () => navigate(`/automations/${automation.id}/edit`) },
    ];

    if (automation.active) {
      items.push({
        label: "Executar agora",
        icon: Play,
        onSelect: () => setRunNowAutomation(automation),
      });
    }

    items.push({
      label: automation.active ? "Desativar" : "Ativar",
      icon: Power,
      tone: automation.active ? "danger" : "success",
      separatorBefore: true,
      onSelect: () => setConfirmAutomation(automation),
    });

    return items;
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Automações"
          description="Cada automação liga um bot a um repositório e define como ele roda."
          actions={
            <>
              <RefreshIndicator
                updatedAt={automationsQuery.dataUpdatedAt}
                isFetching={automationsQuery.isFetching}
                onRefresh={handleRefresh}
              />
              <button type="button" onClick={() => navigate("/automations/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Nova automação
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={handleClearFilters}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, bot ou repositório" />

          <SearchableSelect
            value={repositoryFilter}
            onChange={(value) => {
              setRepositoryFilter(value);
              setBotFilter("");
            }}
            options={repositoryOptions}
            emptyLabel="Todos os repositórios"
            searchPlaceholder="Buscar repositório..."
            emptyText="Nenhum repositório encontrado."
            loading={repositoriesQuery.isLoading}
            className="w-full sm:w-56"
          />

          <SearchableSelect
            value={botFilter}
            onChange={(value) => setBotFilter(value)}
            options={botOptions}
            emptyLabel="Todos os bots"
            searchPlaceholder="Buscar bot..."
            emptyText="Nenhum bot encontrado."
            loading={botsQuery.isLoading}
            className="w-full sm:w-56"
          />

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
            className={cn(select, "w-full sm:w-44")}
            aria-label="Filtrar por status"
          >
            <option value="true">Somente ativas</option>
            <option value="false">Somente inativas</option>
            <option value="all">Ativas e inativas</option>
          </select>
        </FilterBar>

        {automationsQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : automationsQuery.isError ? (
          <div className="px-5 py-5">
            <QueryError
              error={automationsQuery.error}
              what="as automações"
              onRetry={handleRefresh}
              retrying={automationsQuery.isFetching}
            />
          </div>
        ) : automations.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title={hasActiveFilters ? "Nenhuma automação com esses filtros" : "Nenhuma automação cadastrada"}
            description={
              hasActiveFilters
                ? "Tente outro termo ou limpe os filtros para ver todas."
                : "Cadastre a primeira automação para começar a rodar bots."
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={handleClearFilters} className={btn.secondary}>
                  Limpar filtros
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/automations/new")} className={btn.primary}>
                  <Plus className="h-4 w-4" />
                  Nova automação
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
                  <th className={table.th}>Bot</th>
                  <th className={table.th}>Prioridade</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Criada em</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {automations.map((automation) => (
                  <tr
                    key={automation.id}
                    className={table.trClickable}
                    onClick={() => navigate(`/automations/${automation.id}`)}
                  >
                    <td className={cn(table.tdMuted, "tabular-nums")}>{automation.id}</td>

                    <td className={table.tdStrong}>
                      <span className={table.truncate} title={automation.name}>
                        {automation.name}
                      </span>
                      {automation.label && (
                        <span className="block max-w-[280px] truncate text-xs font-normal text-slate-500" title={automation.label}>
                          {automation.label}
                        </span>
                      )}
                      {automation.description && (
                        <span
                          className="mt-0.5 block max-w-[280px] truncate text-xs font-normal text-slate-400"
                          title={automation.description}
                        >
                          {automation.description}
                        </span>
                      )}
                    </td>

                    <td className={table.td}>
                      <span
                        className="block max-w-[200px] truncate"
                        title={automation.repository_name || `#${automation.repository_id}`}
                      >
                        {automation.repository_name || `#${automation.repository_id}`}
                      </span>
                    </td>

                    <td className={table.td}>
                      <span className="block max-w-[200px] truncate" title={automation.bot_name || `#${automation.bot_id}`}>
                        {automation.bot_name || `#${automation.bot_id}`}
                      </span>
                    </td>

                    <td className={cn(table.tdMuted, "tabular-nums")}>{automation.default_priority}</td>

                    <td className={table.td}>
                      <span className={cn(badge, automation.active ? tone.success : tone.neutral)}>
                        {automation.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>

                    <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(automation.created_at)}</td>

                    <td className={table.tdRight}>
                      <ActionsMenu items={buildActions(automation)} label={`Ações de ${automation.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmAutomation}
        title={confirmAutomation?.active ? "Desativar automação" : "Ativar automação"}
        description={
          confirmAutomation
            ? confirmAutomation.active
              ? `Desativar "${confirmAutomation.name}"? Agendamentos e gatilhos param de criar tasks para ela até ser reativada.`
              : `Ativar "${confirmAutomation.name}"? Ela volta a aceitar tasks de agendamentos, gatilhos e execução manual.`
            : ""
        }
        confirmLabel={confirmAutomation?.active ? "Desativar" : "Ativar"}
        tone={confirmAutomation?.active ? "danger" : "default"}
        isPending={isToggling}
        onCancel={() => setConfirmAutomation(null)}
        onConfirm={handleConfirmToggle}
      />

      <ConfirmDialog
        open={!!runNowAutomation}
        title="Executar agora"
        description={
          runNowAutomation
            ? `Executar agora a automação "${runNowAutomation.name}"? Entra na fila e roda na próxima máquina livre.`
            : ""
        }
        confirmLabel="Executar"
        isPending={runNowMutation.isPending}
        onCancel={() => setRunNowAutomation(null)}
        onConfirm={handleConfirmRunNow}
      />
    </div>
  );
}
