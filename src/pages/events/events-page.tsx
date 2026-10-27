import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { History, Pencil, Plus, Power, PowerOff, Send, Trash2, Zap } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime, formatRelative } from "@/lib/format";
import { badge, btn, card, chip, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  deleteEventRule,
  listEventRules,
  testEventRule,
  updateEventRule,
  type EventRule,
  type EventRulePayload,
} from "@/services/api/events";
import { toast } from "@/store/toast-store";
import { EventRunsDrawer } from "./event-runs-drawer";
import { SCOPE_LABEL, describeTriggerConfig, urlHost } from "./event-utils";

function toPayload(rule: EventRule): EventRulePayload {
  return {
    name: rule.name,
    description: rule.description,
    active: rule.active,
    scope_type: rule.scope_type,
    scope_id: rule.scope_id,
    trigger_type: rule.trigger_type,
    trigger_config: rule.trigger_config ?? {},
    pre_steps: rule.pre_steps ?? [],
    url: rule.url,
    method: rule.method,
    headers: rule.headers ?? {},
    body_template: rule.body_template ?? "",
    timeout_seconds: rule.timeout_seconds,
  };
}

export function EventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<EventRule | null>(null);
  const [historyTarget, setHistoryTarget] = useState<EventRule | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["event-rules"],
    queryFn: () => listEventRules(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["event-rules"] });

  const deleteMutation = useMutation({
    mutationFn: deleteEventRule,
    onSuccess: async () => {
      toast.success("Evento excluído.");
      setDeleteTarget(null);
      await invalidate();
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível excluir o evento.", error)),
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: EventRule) => updateEventRule(rule.id, { ...toPayload(rule), active: !rule.active }),
    onSuccess: async (updated) => {
      toast.success(updated.active ? "Evento ativado." : "Evento desativado.");
      await invalidate();
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível alterar o evento.", error)),
  });

  const testMutation = useMutation({
    mutationFn: (rule: EventRule) => testEventRule(rule.id),
    onSuccess: async (run, rule) => {
      if (run.ok) toast.success(`Teste de "${rule.name}" enviado com sucesso.`);
      else toast.error(`O teste de "${rule.name}" falhou. Veja o histórico para os detalhes.`);
      await invalidate();
      queryClient.invalidateQueries({ queryKey: ["event-runs"] });
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível testar o evento.", error)),
  });

  const rules = rulesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Eventos"
          description="Quando um robô termina de um jeito, o orquestrador faz uma requisição: avisar no Teams, abrir chamado, chamar um fluxo."
          actions={
            <>
              <RefreshIndicator
                updatedAt={rulesQuery.dataUpdatedAt}
                isFetching={rulesQuery.isFetching}
                onRefresh={() => rulesQuery.refetch()}
              />
              <button type="button" onClick={() => navigate("/events/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Novo evento
              </button>
            </>
          }
        />

        {rulesQuery.isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : rulesQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={rulesQuery.error}
              what="os eventos"
              onRetry={() => rulesQuery.refetch()}
              retrying={rulesQuery.isFetching}
            />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="Nenhum evento cadastrado"
            description="Um evento liga um acontecimento (erro, sucesso, timeout, senha vencida, um valor no retorno do robô) a uma requisição HTTP que o orquestrador faz por você. Crie o primeiro para avisar o time ou abrir um chamado automaticamente."
            action={
              <button type="button" onClick={() => navigate("/events/new")} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Novo evento
              </button>
            }
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Evento</th>
                  <th className={table.th}>Quando</th>
                  <th className={table.th}>Então</th>
                  <th className={table.th}>Último disparo</th>
                  <th className={table.th}>Ativo</th>
                  <th className={table.thRight}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const config = describeTriggerConfig(rule);
                  const stepsCount = rule.pre_steps?.length ?? 0;
                  const busy =
                    (toggleMutation.isPending && toggleMutation.variables?.id === rule.id) ||
                    (testMutation.isPending && testMutation.variables?.id === rule.id);
                  return (
                    <tr key={rule.id} className={table.trClickable} onClick={() => navigate(`/events/${rule.id}/edit`)}>
                      <td className={table.tdStrong}>
                        <span className={table.truncate} title={rule.name}>
                          {rule.name}
                        </span>
                        {rule.description && (
                          <span className={cn(table.truncate, "text-xs font-normal text-slate-500")} title={rule.description}>
                            {rule.description}
                          </span>
                        )}
                      </td>
                      <td className={table.td}>
                        <span className="block text-slate-900">
                          {rule.scope_type === "all" ? SCOPE_LABEL.all : rule.scope_label ?? `${SCOPE_LABEL[rule.scope_type]} #${rule.scope_id}`}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {rule.trigger_label || rule.trigger_type}
                          {config && <span className="font-mono"> · {config}</span>}
                        </span>
                      </td>
                      <td className={table.td}>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className={chip}>{rule.method}</span>
                          <span className="max-w-[220px] truncate text-slate-900" title={rule.url}>
                            {urlHost(rule.url)}
                          </span>
                          {stepsCount > 0 && (
                            <span className="text-xs text-slate-500">
                              +{stepsCount} {stepsCount === 1 ? "etapa" : "etapas"}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={cn(table.td, "whitespace-nowrap")}>
                        {rule.last_run_at ? (
                          <span className="inline-flex items-center gap-2" title={formatDateTime(rule.last_run_at)}>
                            <span className={cn(badge, rule.last_run_ok ? tone.success : tone.danger)}>
                              {rule.last_run_ok ? "OK" : "Erro"}
                            </span>
                            <span className="text-xs text-slate-500">{formatRelative(rule.last_run_at)}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">nunca</span>
                        )}
                      </td>
                      <td className={table.td}>
                        <span className={cn(badge, rule.active ? tone.success : tone.neutral)}>{rule.active ? "Ativo" : "Inativo"}</span>
                      </td>
                      <td className={table.tdRight}>
                        <ActionsMenu
                          items={[
                            { label: "Editar", icon: Pencil, onSelect: () => navigate(`/events/${rule.id}/edit`) },
                            { label: "Testar", icon: Send, disabled: busy, onSelect: () => testMutation.mutate(rule) },
                            { label: "Histórico", icon: History, onSelect: () => setHistoryTarget(rule) },
                            {
                              label: rule.active ? "Desativar" : "Ativar",
                              icon: rule.active ? PowerOff : Power,
                              tone: rule.active ? "default" : "success",
                              disabled: busy,
                              separatorBefore: true,
                              onSelect: () => toggleMutation.mutate(rule),
                            },
                            {
                              label: "Excluir",
                              icon: Trash2,
                              tone: "danger",
                              disabled: deleteMutation.isPending,
                              onSelect: () => setDeleteTarget(rule),
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
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir evento"
        description={
          deleteTarget
            ? `O evento "${deleteTarget.name}" será excluído e deixa de disparar. O histórico de disparos continua disponível.`
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

      <EventRunsDrawer rule={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}
