import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, link, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { deleteExclusiveGroup, listExclusiveGroups, type ExclusiveGroupRead } from "@/services/api/exclusive-groups";
import { toast } from "@/store/toast-store";

// A lista recarrega sozinha para o "em uso agora" acompanhar as tasks.
const LIST_REFRESH_MS = 15_000;

export function ExclusiveGroupsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ExclusiveGroupRead | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["exclusive-groups"],
    queryFn: () => listExclusiveGroups(),
    refetchInterval: LIST_REFRESH_MS,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteExclusiveGroup,
    onSuccess: async () => {
      toast.success("Grupo excluído.");
      setDeleteTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["exclusive-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["automation-exclusive-groups-form"] });
    },
    onError: (error) => {
      // 409: ainda há automações no grupo; o detail da API diz quantas.
      toast.error(withApiDetail("Não foi possível excluir o grupo.", error));
    },
  });

  const filteredItems = useMemo(() => {
    const items = groupsQuery.data ?? [];
    const query = normalizeSearch(search);
    if (!query) return items;
    return items.filter((item) =>
      normalizeSearch(
        `${item.name} ${item.label ?? ""} ${item.description ?? ""} ${item.automations.map((a) => `${a.name} ${a.label ?? ""}`).join(" ")}`
      ).includes(query)
    );
  }, [groupsQuery.data, search]);

  const hasActiveFilters = search.trim() !== "";

  function openEdit(groupId: number) {
    navigate(`/exclusive-groups/${groupId}/edit`);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Grupos exclusivos"
          description="Automações do mesmo grupo nunca rodam ao mesmo tempo, mesmo em máquinas diferentes (ex.: robôs que usam o mesmo usuário do SAP)."
          actions={
            <>
              <RefreshIndicator
                updatedAt={groupsQuery.dataUpdatedAt}
                isFetching={groupsQuery.isFetching}
                onRefresh={() => groupsQuery.refetch()}
              />
              <button type="button" onClick={() => navigate("/exclusive-groups/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Novo grupo
              </button>
            </>
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={() => setSearch("")}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por grupo ou automação" />
        </FilterBar>

        {groupsQuery.isLoading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : groupsQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={groupsQuery.error}
              what="os grupos exclusivos"
              onRetry={() => groupsQuery.refetch()}
              retrying={groupsQuery.isFetching}
            />
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={Lock}
            title={hasActiveFilters ? "Nenhum grupo com esse texto" : "Nenhum grupo exclusivo cadastrado"}
            description={
              hasActiveFilters
                ? "Tente outro texto ou limpe a busca."
                : "Crie um grupo e coloque nele as automações que não podem rodar juntas."
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={() => setSearch("")} className={btn.secondary}>
                  Limpar filtros
                </button>
              ) : (
                <button type="button" onClick={() => navigate("/exclusive-groups/new")} className={btn.primary}>
                  <Plus className="h-4 w-4" />
                  Novo grupo
                </button>
              )
            }
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Grupo</th>
                  <th className={table.th}>Automações</th>
                  <th className={table.th}>Em uso agora</th>
                  <th className={table.th}>Status</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((group) => (
                  <tr key={group.id} className={table.trClickable} onClick={() => openEdit(group.id)}>
                    <td className={table.tdStrong}>
                      <span className="inline-flex items-center gap-2">
                        <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0">
                          <span className={table.truncate} title={group.label || group.name}>
                            {group.label || group.name}
                          </span>
                          <span className={cn(table.truncate, "text-xs font-normal text-slate-500")} title={group.description || group.name}>
                            {group.description || group.name}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={table.td}>
                      {group.automations.length === 0 ? (
                        <span className="text-slate-500">Nenhuma</span>
                      ) : (
                        <div className="flex max-w-[360px] flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                          {group.automations.map((automation) => (
                            <Link
                              key={automation.id}
                              to={`/automations/${automation.id}`}
                              className={cn(badge, automation.active ? tone.neutral : "border-slate-200 bg-white text-slate-400 line-through")}
                              title={automation.active ? automation.name : `${automation.name} (inativa)`}
                            >
                              {automation.label || automation.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={table.td} onClick={(e) => e.stopPropagation()}>
                      {group.current_lock ? (
                        <div className="text-sm">
                          <Link className={link} to={`/tasks/${group.current_lock.task_id}`}>
                            Task #{group.current_lock.task_id}
                          </Link>
                          <span className="text-slate-600"> · {group.current_lock.automation_name || `Automação #${group.current_lock.automation_id}`}</span>
                          <p className="text-xs text-slate-500">
                            {group.current_lock.runner_name ? `${group.current_lock.runner_name} · ` : ""}
                            desde {formatDateTime(group.current_lock.acquired_at)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">Livre</span>
                      )}
                    </td>
                    <td className={table.td}>
                      <span className={cn(badge, group.active ? tone.success : tone.neutral)}>
                        {group.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className={table.tdRight}>
                      <ActionsMenu
                        items={[
                          { label: "Editar", icon: Pencil, onSelect: () => openEdit(group.id) },
                          {
                            label: "Excluir",
                            icon: Trash2,
                            tone: "danger",
                            separatorBefore: true,
                            disabled: deleteMutation.isPending,
                            onSelect: () => setDeleteTarget(group),
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
        title="Excluir grupo exclusivo"
        description={
          deleteTarget
            ? deleteTarget.automations.length > 0
              ? `O grupo "${deleteTarget.label || deleteTarget.name}" ainda tem ${deleteTarget.automations.length} automação(ões). Tire as automações do grupo antes de excluir, ou apenas desative o grupo.`
              : `O grupo "${deleteTarget.label || deleteTarget.name}" será excluído. Esta ação não pode ser desfeita.`
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
