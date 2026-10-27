import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { deleteCalendar, listCalendars, type CalendarRead } from "@/services/api/calendars";
import { toast } from "@/store/toast-store";

import { describeWeekdays } from "./calendar-utils";

export function CalendarsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CalendarRead | null>(null);

  const calendarsQuery = useQuery({
    queryKey: ["calendars"],
    queryFn: () => listCalendars(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCalendar,
    onSuccess: async () => {
      toast.success("Calendário excluído.");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["calendars"] });
    },
    onError: (error) => {
      // 409: agendamentos ainda usam o calendário; o detail da API diz quais.
      toast.error(withApiDetail("Não foi possível excluir o calendário.", error));
    },
  });

  const filteredItems = useMemo(() => {
    const items = calendarsQuery.data ?? [];
    const query = normalizeSearch(search);
    if (!query) return items;
    return items.filter((item) => normalizeSearch(`${item.name} ${item.description ?? ""}`).includes(query));
  }, [calendarsQuery.data, search]);

  const hasActiveFilters = search.trim() !== "";

  function openEdit(calendarId: number) {
    navigate(`/calendars/${calendarId}/edit`);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Calendários"
          description="Dias úteis, feriados e janelas em que os robôs não devem rodar. Cada agendamento pode usar um calendário."
          actions={
            <>
              <RefreshIndicator
                updatedAt={calendarsQuery.dataUpdatedAt}
                isFetching={calendarsQuery.isFetching}
                onRefresh={() => calendarsQuery.refetch()}
              />
              <button type="button" onClick={() => navigate("/calendars/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Novo calendário
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={() => setSearch("")}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou descrição" />
        </FilterBar>

        {calendarsQuery.isLoading ? (
          <TableSkeleton rows={4} columns={6} />
        ) : calendarsQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={calendarsQuery.error}
              what="os calendários"
              onRetry={() => calendarsQuery.refetch()}
              retrying={calendarsQuery.isFetching}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={hasActiveFilters ? "Nenhum calendário com esse texto" : "Nenhum calendário cadastrado"}
            description={
              hasActiveFilters
                ? "Tente outro texto ou limpe a busca."
                : "Crie um calendário com os dias úteis e feriados e escolha-o nos agendamentos."
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={() => setSearch("")} className={btn.secondary}>
                  Limpar filtros
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/calendars/new")} className={btn.primary}>
                  <Plus className="h-4 w-4" />
                  Novo calendário
                </button>
              )
            }
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Nome</th>
                  <th className={table.th}>Dias úteis</th>
                  <th className={table.th}>Feriados</th>
                  <th className={table.th}>Janelas</th>
                  <th className={table.th}>Agendamentos</th>
                  <th className={table.th}>Status</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((calendar) => (
                  <tr key={calendar.id} className={table.trClickable} onClick={() => openEdit(calendar.id)}>
                    <td className={table.tdStrong}>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0">
                          <span className={table.truncate} title={calendar.name}>
                            {calendar.name}
                          </span>
                          {calendar.description ? (
                            <span className={cn(table.truncate, "text-xs font-normal text-slate-500")} title={calendar.description}>
                              {calendar.description}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className={table.td}>{describeWeekdays(calendar.weekdays)}</td>
                    <td className={table.td}>{calendar.holidays.length}</td>
                    <td className={table.td}>{calendar.blackouts.length}</td>
                    <td className={table.td}>{calendar.schedules_count}</td>
                    <td className={table.td}>
                      <span className={cn(badge, calendar.active ? tone.success : tone.neutral)}>
                        {calendar.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className={table.tdRight}>
                      <ActionsMenu
                        items={[
                          { label: "Editar", icon: Pencil, onSelect: () => openEdit(calendar.id) },
                          {
                            label: "Excluir",
                            icon: Trash2,
                            tone: "danger",
                            separatorBefore: true,
                            disabled: deleteMutation.isPending,
                            onSelect: () => setDeleteTarget(calendar),
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
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir calendário"
        description={
          deleteTarget
            ? deleteTarget.schedules_count > 0
              ? `O calendário "${deleteTarget.name}" é usado por ${deleteTarget.schedules_count} agendamento(s). Tire-o desses agendamentos antes de excluir.`
              : `O calendário "${deleteTarget.name}" será excluído. Esta ação não pode ser desfeita.`
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
