import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Eye, PauseCircle, Pencil, PlayCircle, Plus, Power, RefreshCcw } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableSelect, type SearchableOption } from "@/components/common/searchable-select";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY, formatDateTimeShort, formatRelative } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listAutomations } from "@/services/api/automations";
import { deactivateSchedule, listSchedules, pauseSchedule, reactivateSchedule } from "@/services/api/schedules";
import type { ScheduleRead } from "@/types/schedule";
import { toast } from "@/store/toast-store";

type StatusLabel = "Ativo" | "Pausado" | "Inativo" | "Erro";

function getStatusLabel(schedule: ScheduleRead): StatusLabel {
  if (schedule.status === "paused") return "Pausado";
  if (schedule.status === "error") return "Erro";
  if (schedule.status === "inactive") return "Inativo";
  return schedule.active ? "Ativo" : "Inativo";
}

const STATUS_TONE: Record<StatusLabel, string> = {
  Ativo: tone.success,
  Pausado: tone.warning,
  Inativo: tone.neutral,
  Erro: tone.danger,
};

// Padrão: esconde só os desativados (status "inactive"). Pausados continuam na lista
// porque ainda têm ação (Reativar), e os com erro precisam de atenção.
type SituationFilter = "not_inactive" | "active" | "paused" | "inactive" | "all";

const DEFAULT_SITUATION: SituationFilter = "not_inactive";

function matchesSituation(schedule: ScheduleRead, filter: SituationFilter) {
  const label = getStatusLabel(schedule);
  switch (filter) {
    case "not_inactive":
      return label !== "Inativo";
    case "active":
      return schedule.active;
    case "paused":
      return label === "Pausado";
    case "inactive":
      return label === "Inativo";
    default:
      return true;
  }
}

function getTypeLabel(schedule: ScheduleRead) {
  if (schedule.schedule_type === "cron") return "Cron";

  const labels: Record<string, string> = {
    once: "Calendário · Uma vez",
    second: "Calendário · Segundos",
    minute: "Calendário · Minutos",
    hour: "Calendário · Horas",
    day: "Calendário · Dias",
    week: "Calendário · Semanas",
    month: "Calendário · Meses",
  };

  return labels[schedule.calendar_type ?? ""] ?? "Calendário";
}

function getRuleLabel(schedule: ScheduleRead) {
  if (schedule.schedule_type === "cron") {
    return schedule.cron_expression || EMPTY;
  }

  const unitLabels: Record<string, string> = {
    once: "uma vez",
    second: "segundo(s)",
    minute: "minuto(s)",
    hour: "hora(s)",
    day: "dia(s)",
    week: "semana(s)",
    month: "mês(es)",
  };

  if (schedule.calendar_type === "once") {
    return "Execução única";
  }

  const interval = schedule.interval_value ?? 1;
  const unit = unitLabels[schedule.calendar_type ?? ""] ?? "intervalo";

  return `A cada ${interval} ${unit}`;
}

// O "Ignorado" só interessa enquanto for o último acontecimento: se depois disso o
// agendamento voltou a rodar (last_run_at mais recente), o aviso some.
function isSkipCurrent(schedule: ScheduleRead) {
  if (!schedule.last_skipped_reason || !schedule.last_skipped_at) return false;
  if (!schedule.last_run_at) return true;
  const skipped = new Date(schedule.last_skipped_at).getTime();
  const ran = new Date(schedule.last_run_at).getTime();
  if (Number.isNaN(skipped)) return false;
  if (Number.isNaN(ran)) return true;
  return skipped > ran;
}

type ConfirmState = { id: number; name: string } | null;

export function SchedulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [automationFilter, setAutomationFilter] = useState<number | "">("");
  const [situationFilter, setSituationFilter] = useState<SituationFilter>(DEFAULT_SITUATION);
  const [deactivateConfirm, setDeactivateConfirm] = useState<ConfirmState>(null);

  const schedulesQuery = useQuery({
    queryKey: ["schedules"],
    queryFn: () => listSchedules(),
  });

  const automationsQuery = useQuery({
    queryKey: ["automations-options"],
    queryFn: () => listAutomations(),
  });

  const pauseMutation = useMutation({
    mutationFn: (scheduleId: number) => pauseSchedule(scheduleId),
    onSuccess: async () => {
      toast.success("Agendamento pausado.");
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível pausar o agendamento.", error));
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (scheduleId: number) => reactivateSchedule(scheduleId),
    onSuccess: async () => {
      toast.success("Agendamento reativado.");
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível reativar o agendamento.", error));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (scheduleId: number) => deactivateSchedule(scheduleId),
    onSuccess: async () => {
      toast.success("Agendamento desativado.");
      setDeactivateConfirm(null);
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível desativar o agendamento.", error));
    },
  });

  const automationMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const automation of automationsQuery.data ?? []) {
      map.set(automation.id, automation.name);
    }
    return map;
  }, [automationsQuery.data]);

  // Ativas primeiro; inativas continuam disponíveis (podem ter agendamentos antigos), marcadas na descrição.
  const automationOptions = useMemo<SearchableOption<number>[]>(() => {
    return [...(automationsQuery.data ?? [])]
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"))
      .map((automation) => ({
        value: automation.id,
        label: automation.name,
        description:
          [automation.active ? null : "Inativa", automation.repository_name, automation.bot_name]
            .filter(Boolean)
            .join(" · ") || null,
      }));
  }, [automationsQuery.data]);

  const filteredSchedules = useMemo(() => {
    const term = normalizeSearch(search);

    return (schedulesQuery.data ?? []).filter((schedule) => {
      const automationName = automationMap.get(schedule.automation_id) ?? "";
      const status = getStatusLabel(schedule);

      const matchesText =
        !term ||
        normalizeSearch(schedule.name).includes(term) ||
        normalizeSearch(automationName).includes(term) ||
        normalizeSearch(schedule.cron_expression ?? "").includes(term) ||
        normalizeSearch(status).includes(term);

      const matchesAutomation = automationFilter === "" || schedule.automation_id === automationFilter;

      return matchesText && matchesAutomation && matchesSituation(schedule, situationFilter);
    });
  }, [schedulesQuery.data, automationMap, search, automationFilter, situationFilter]);

  const hasActiveFilters = search !== "" || automationFilter !== "" || situationFilter !== DEFAULT_SITUATION;

  function clearFilters() {
    setSearch("");
    setAutomationFilter("");
    setSituationFilter(DEFAULT_SITUATION);
  }

  function handleRefresh() {
    schedulesQuery.refetch();
    automationsQuery.refetch();
  }

  const isFetching = schedulesQuery.isFetching || automationsQuery.isFetching;
  const actionPending = pauseMutation.isPending || reactivateMutation.isPending || deactivateMutation.isPending;

  const newButton = (
    <button type="button" onClick={() => navigate("/schedules/new")} className={btn.primary}>
      <Plus className="h-4 w-4" />
      Novo agendamento
    </button>
  );

  return (
    <section className={card}>
      <PageHeader
        title="Agendamentos"
        description="Quando cada automação roda sozinha: regra, próxima execução e situação."
        actions={
          <>
            <button type="button" onClick={handleRefresh} className={btn.secondary} disabled={isFetching}>
              <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Atualizar
            </button>
            {newButton}
          </>
        }
      />

      <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, automação ou cron" />

        <SearchableSelect<number>
          value={automationFilter}
          onChange={setAutomationFilter}
          options={automationOptions}
          emptyLabel="Todas as automações"
          placeholder="Todas as automações"
          searchPlaceholder="Buscar automação, repositório, bot..."
          loading={automationsQuery.isLoading}
          className="w-full sm:w-64"
        />

        <select
          value={situationFilter}
          onChange={(e) => setSituationFilter(e.target.value as SituationFilter)}
          aria-label="Situação"
          className={cn(select, "w-full sm:w-48")}
        >
          <option value="not_inactive">Ativos e pausados</option>
          <option value="active">Somente ativos</option>
          <option value="paused">Somente pausados</option>
          <option value="inactive">Somente inativos</option>
          <option value="all">Todos</option>
        </select>

        <span className="ml-auto hidden text-xs text-slate-500 sm:inline">
          {filteredSchedules.length} {filteredSchedules.length === 1 ? "agendamento" : "agendamentos"}
        </span>
      </FilterBar>

      {schedulesQuery.isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : schedulesQuery.isError ? (
        <div className="p-5">
          <QueryError
            error={schedulesQuery.error}
            what="os agendamentos"
            onRetry={() => schedulesQuery.refetch()}
            retrying={schedulesQuery.isFetching}
          />
        </div>
      ) : filteredSchedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={hasActiveFilters ? "Nenhum agendamento com esses filtros" : "Nenhum agendamento cadastrado"}
          description={
            hasActiveFilters
              ? "Tente outra busca ou limpe os filtros."
              : "Crie o primeiro agendamento para uma automação rodar sozinha."
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
                <th className={table.th}>Agendamento</th>
                <th className={table.th}>Automação</th>
                <th className={table.th}>Tipo</th>
                <th className={table.th}>Regra</th>
                <th className={table.th}>Próxima execução</th>
                <th className={table.th}>Status</th>
                <th className={table.thRight}>Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredSchedules.map((schedule) => {
                const automationName = automationMap.get(schedule.automation_id) ?? `Automação #${schedule.automation_id}`;
                const statusLabel = getStatusLabel(schedule);
                const showSkip = isSkipCurrent(schedule);

                return (
                  <tr key={schedule.id} className={table.trClickable} onClick={() => navigate(`/schedules/${schedule.id}`)}>
                    <td className={table.tdStrong}>
                      <span className={table.truncate} title={schedule.name}>
                        {schedule.name}
                      </span>
                      <span className="block text-xs font-normal text-slate-500">#{schedule.id}</span>
                      {schedule.last_error ? (
                        <span
                          className="block max-w-[280px] truncate text-xs font-medium text-red-700"
                          title={schedule.last_error}
                        >
                          Erro: {schedule.last_error}
                        </span>
                      ) : null}
                      {showSkip ? (
                        <span
                          className="block max-w-[280px] truncate text-xs font-normal text-amber-700"
                          title={`${schedule.last_skipped_reason} (${formatDateTimeShort(schedule.last_skipped_at)})`}
                        >
                          Ignorado: {schedule.last_skipped_reason}
                        </span>
                      ) : null}
                    </td>

                    <td className={table.td}>
                      <span className={table.truncate} title={automationName}>
                        {automationName}
                      </span>
                    </td>

                    <td className={cn(table.tdMuted, "whitespace-nowrap")}>{getTypeLabel(schedule)}</td>

                    <td className={table.td}>
                      <span className="block max-w-[260px] whitespace-nowrap truncate font-mono text-xs" title={getRuleLabel(schedule)}>
                        {getRuleLabel(schedule)}
                      </span>
                    </td>

                    <td className={cn(table.td, "whitespace-nowrap")}>
                      {schedule.next_run_at ? (
                        <span title={formatDateTimeShort(schedule.next_run_at)}>{formatRelative(schedule.next_run_at)}</span>
                      ) : (
                        <span className="text-slate-400">{EMPTY}</span>
                      )}
                    </td>

                    <td className={table.td}>
                      <span className={cn(badge, STATUS_TONE[statusLabel])}>{statusLabel}</span>
                    </td>

                    <td className={table.tdRight}>
                      <ActionsMenu
                        label={`Ações de ${schedule.name}`}
                        items={[
                          { label: "Ver", icon: Eye, onSelect: () => navigate(`/schedules/${schedule.id}`) },
                          { label: "Editar", icon: Pencil, onSelect: () => navigate(`/schedules/${schedule.id}/edit`) },
                          ...(schedule.status === "paused"
                            ? [
                                {
                                  label: "Reativar",
                                  icon: PlayCircle,
                                  tone: "success" as const,
                                  separatorBefore: true,
                                  disabled: actionPending,
                                  onSelect: () => reactivateMutation.mutate(schedule.id),
                                },
                              ]
                            : schedule.active
                              ? [
                                  {
                                    label: "Pausar",
                                    icon: PauseCircle,
                                    separatorBefore: true,
                                    disabled: actionPending,
                                    onSelect: () => pauseMutation.mutate(schedule.id),
                                  },
                                ]
                              : []),
                          ...(schedule.active
                            ? [
                                {
                                  label: "Desativar",
                                  icon: Power,
                                  tone: "danger" as const,
                                  disabled: actionPending,
                                  onSelect: () => setDeactivateConfirm({ id: schedule.id, name: schedule.name }),
                                },
                              ]
                            : []),
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

      <ConfirmDialog
        open={deactivateConfirm !== null}
        title="Desativar agendamento"
        description={`"${deactivateConfirm?.name ?? ""}" deixa de criar tasks. Você pode editá-lo e marcar como ativo depois.`}
        confirmLabel="Desativar"
        tone="danger"
        isPending={deactivateMutation.isPending}
        onConfirm={() => deactivateConfirm && deactivateMutation.mutate(deactivateConfirm.id)}
        onCancel={() => setDeactivateConfirm(null)}
      />
    </section>
  );
}
