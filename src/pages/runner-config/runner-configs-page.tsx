import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, Pencil, Power, Server, Trash2 } from "lucide-react";

import { RunnerBadges, RunnerHeartbeatText } from "@/components/common/runner-badges";
import { PageHeader } from "@/components/common/page-header";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ActionsMenu } from "@/components/common/actions-menu";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { TableSkeleton } from "@/components/common/skeleton";
import { getRunnerHealth } from "@/lib/health";
import { activateRunner, disableRunner, listRunners, removeRunner, type RunnerRead } from "@/services/api/runners";
import { toast } from "@/store/toast-store";
import { getApiErrorMessage } from "@/lib/api-error";
import { EMPTY, formatDateTime } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

const REFRESH_MS = 10_000;

function formatRunnerStatus(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "busy":
      return "Ocupado";
    case "maintenance":
      return "Manutenção";
    case "blocked":
      return "Bloqueado";
    default:
      return status || EMPTY;
  }
}

function getRunnerStatusTone(runner: RunnerRead): keyof typeof tone {
  if (getRunnerHealth(runner).noSignal) return "danger";
  switch ((runner.status || "").toLowerCase()) {
    case "online":
      return "success";
    case "busy":
      return "info";
    case "maintenance":
      return "warning";
    case "blocked":
    case "offline":
      return "danger";
    default:
      return "neutral";
  }
}

type EnabledFilter = "all" | "true" | "false";

export function RunnerConfigsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("true");
  const [confirmRunner, setConfirmRunner] = useState<RunnerRead | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RunnerRead | null>(null);

  const queryParams = useMemo(() => {
    return {
      status: statusFilter || undefined,
      enabled: enabledFilter === "all" ? undefined : enabledFilter === "true",
      limit: 100,
      skip: 0,
    };
  }, [statusFilter, enabledFilter]);

  const runnersQuery = useQuery({
    queryKey: ["runners", queryParams],
    queryFn: () => listRunners(queryParams),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["runners"] });
    queryClient.invalidateQueries({ queryKey: ["runners-page"] });
  }

  const activateMutation = useMutation({
    mutationFn: (runnerId: number) => activateRunner(runnerId),
    onSuccess: () => {
      toast.success("Runner ativado.");
      invalidate();
      setConfirmRunner(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível ativar o runner.")),
  });

  const disableMutation = useMutation({
    mutationFn: (runnerId: number) => disableRunner(runnerId),
    onSuccess: () => {
      toast.success("Runner desativado.");
      invalidate();
      setConfirmRunner(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível desativar o runner.")),
  });

  const removeMutation = useMutation({
    mutationFn: (runnerId: number) => removeRunner(runnerId),
    onSuccess: () => {
      toast.success('Runner removido. Ele continua em Runners > "Removidos (histórico)".');
      invalidate();
      setRemoveTarget(null);
    },
    onError: (error) => {
      // Fecha o diálogo para o aviso (ex.: task em execução) ficar visível.
      toast.error(getApiErrorMessage(error, "Não foi possível remover o runner."));
      setRemoveTarget(null);
    },
  });

  function handleConfirmToggle() {
    if (!confirmRunner) return;

    if (confirmRunner.enabled) {
      disableMutation.mutate(confirmRunner.id);
      return;
    }

    activateMutation.mutate(confirmRunner.id);
  }

  const isSubmitting = activateMutation.isPending || disableMutation.isPending || removeMutation.isPending;

  const runners = useMemo(() => {
    const list = runnersQuery.data ?? [];
    const q = normalizeSearch(search);
    if (!q) return list;
    return list.filter((runner) =>
      normalizeSearch(`${runner.name ?? ""} ${runner.label ?? ""} ${runner.host_name ?? ""} ${runner.ip ?? ""}`).includes(q)
    );
  }, [runnersQuery.data, search]);

  const hasActiveFilters = search.trim() !== "" || statusFilter !== "" || enabledFilter !== "true";

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setEnabledFilter("true");
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Configuração dos runners"
          description="Concorrência, polling e manutenção de cada máquina."
          actions={
            <>
              <RefreshIndicator
                updatedAt={runnersQuery.dataUpdatedAt}
                isFetching={runnersQuery.isFetching}
                onRefresh={() => runnersQuery.refetch()}
                intervalMs={REFRESH_MS}
              />
              <button type="button" className={btn.primary} onClick={() => navigate("/worker-registration")}>
                <BookOpen className="h-4 w-4" />
                Guia do bot
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, host ou IP" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn(select, "w-48")}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="busy">Ocupado</option>
            <option value="maintenance">Manutenção</option>
            <option value="blocked">Bloqueado</option>
          </select>

          <select
            value={enabledFilter}
            onChange={(e) => setEnabledFilter(e.target.value as EnabledFilter)}
            className={cn(select, "w-48")}
            aria-label="Filtrar por ativo/inativo"
          >
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
            <option value="all">Ativos e inativos</option>
          </select>
        </FilterBar>

        {runnersQuery.isLoading ? (
          <TableSkeleton rows={6} columns={6} />
        ) : runnersQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={runnersQuery.error}
              what="os runners"
              onRetry={() => runnersQuery.refetch()}
              retrying={runnersQuery.isFetching}
            />
          </div>
        ) : runners.length === 0 ? (
          <EmptyState
            icon={Server}
            title="Nenhum runner encontrado"
            description={hasActiveFilters ? "Nenhum runner combina com os filtros." : "Configure uma máquina para ela aparecer aqui."}
            action={
              hasActiveFilters ? (
                <button type="button" className={btn.secondary} onClick={clearFilters}>
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Nome</th>
                  <th className={table.th}>Status</th>
                  <th className={table.th}>Ativo</th>
                  <th className={table.th}>Em execução</th>
                  <th className={table.th}>Bots vinculados</th>
                  <th className={table.th}>Último heartbeat</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>

              <tbody>
                {runners.map((runner) => (
                  <tr key={runner.id} className={table.trClickable} onClick={() => navigate(`/runner-configs/${runner.id}`)}>
                    <td className={table.tdStrong}>
                      <span className={table.truncate} title={runner.name}>
                        {runner.name}
                      </span>
                      {runner.label ? <span className="block text-xs font-normal text-slate-500">{runner.label}</span> : null}
                    </td>

                    <td className={table.td}>
                      <span className={cn(badge, tone[getRunnerStatusTone(runner)])}>
                        {getRunnerHealth(runner).noSignal ? "SEM SINAL" : formatRunnerStatus(runner.status)}
                      </span>
                      <div className="mt-1.5">
                        <RunnerBadges runner={runner} showConcurrency={false} />
                      </div>
                    </td>

                    <td className={table.td}>
                      <span className={cn(badge, runner.enabled ? tone.success : tone.neutral)}>{runner.enabled ? "Ativo" : "Inativo"}</span>
                    </td>

                    <td className={table.td}>
                      <span className="tabular-nums">{runner.running_tasks_count ?? 0}</span>
                      {runner.config?.max_concurrency ? (
                        <span className="ml-1 text-xs text-slate-500">(até {runner.config.max_concurrency} background + 1 foreground)</span>
                      ) : null}
                    </td>

                    <td className={cn(table.td, "tabular-nums")}>{runner.linked_bots_count ?? 0}</td>

                    <td className={table.tdMuted}>
                      {formatDateTime(runner.last_heartbeat)}
                      <div className="text-xs">
                        <RunnerHeartbeatText runner={runner} />
                      </div>
                    </td>

                    <td className={table.tdRight}>
                      <ActionsMenu
                        items={[
                          { label: "Ver detalhes", icon: Eye, onSelect: () => navigate(`/runner-configs/${runner.id}`) },
                          { label: "Editar configuração", icon: Pencil, onSelect: () => navigate(`/runner-configs/${runner.id}/edit`) },
                          {
                            label: runner.enabled ? "Desativar" : "Ativar",
                            icon: Power,
                            tone: runner.enabled ? "default" : "success",
                            onSelect: () => setConfirmRunner(runner),
                          },
                          { label: "Remover", icon: Trash2, tone: "danger", separatorBefore: true, onSelect: () => setRemoveTarget(runner) },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remover runner"
        tone="danger"
        description={
          removeTarget
            ? `Runner: ${removeTarget.name}\n\n` +
              "Ele some das telas de Runners e Config. Runners, é desvinculado das automações " +
              "e não recebe mais tasks. O histórico das execuções continua com o nome dele.\n\n" +
              "Se a máquina for configurada de novo (configurar_worker.bat), ela volta."
            : ""
        }
        confirmLabel="Remover"
        isPending={isSubmitting}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => removeTarget && removeMutation.mutate(removeTarget.id)}
      />

      <ConfirmDialog
        open={Boolean(confirmRunner)}
        title={confirmRunner?.enabled ? "Desativar runner" : "Ativar runner"}
        tone={confirmRunner?.enabled ? "warning" : "default"}
        description={
          confirmRunner
            ? `Runner: ${confirmRunner.name}\n\n${
                confirmRunner.enabled
                  ? "Ele para de receber tasks até ser ativado de novo."
                  : "Ele volta a receber tasks das automações vinculadas."
              }`
            : ""
        }
        confirmLabel={confirmRunner?.enabled ? "Desativar" : "Ativar"}
        isPending={isSubmitting}
        onCancel={() => setConfirmRunner(null)}
        onConfirm={handleConfirmToggle}
      />
    </div>
  );
}
