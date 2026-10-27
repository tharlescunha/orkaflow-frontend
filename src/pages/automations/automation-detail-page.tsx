import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Link2, Pencil, Play, Server, Unlink, X } from "lucide-react";

import { ActionsMenu } from "@/components/common/actions-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CredentialAlertStrip } from "@/components/common/credential-status";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { SearchableSelect } from "@/components/common/searchable-select";
import { DetailSkeleton, TableSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { runNowPayload } from "@/lib/run-task";
import { badge, btn, card, cardBody, cardHeader, cardTitle, label as labelClass, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  getAutomation,
  linkRunnerToAutomation,
  listAutomationRunners,
  unlinkRunnerFromAutomation,
  type AutomationRunnerRead,
} from "@/services/api/automations";
import { listRunners, type RunnerRead } from "@/services/api/runners";
import { createTask } from "@/services/api/tasks";
import { toast } from "@/store/toast-store";

function formatRunnerStatus(status?: string | null) {
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
      return status || "---";
  }
}

function runnerStatusTone(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return tone.success;
    case "busy":
      return tone.info;
    case "maintenance":
      return tone.warning;
    case "blocked":
      return tone.danger;
    default:
      return tone.neutral;
  }
}

export function AutomationDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ automationId: string }>();
  const automationId = Number(params.automationId);
  const queryClient = useQueryClient();

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<AutomationRunnerRead | null>(null);
  const [runNowOpen, setRunNowOpen] = useState(false);

  const automationQuery = useQuery({
    queryKey: ["automation-detail", automationId],
    queryFn: () => getAutomation(automationId),
    enabled: Number.isFinite(automationId) && automationId > 0,
  });

  const linkedRunnersQuery = useQuery({
    queryKey: ["automation-runners", automationId],
    queryFn: () => listAutomationRunners(automationId),
    enabled: Number.isFinite(automationId) && automationId > 0,
  });

  const runnersQuery = useQuery({
    queryKey: ["automation-runners-all"],
    queryFn: () => listRunners({ limit: 500, skip: 0 }),
  });

  const linkMutation = useMutation({
    mutationFn: (runnerId: number) => linkRunnerToAutomation(automationId, runnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-runners", automationId] });
      setIsLinkModalOpen(false);
      setSelectedRunnerId("");
      toast.success("Máquina vinculada à automação.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível vincular a máquina."));
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => unlinkRunnerFromAutomation(automationId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-runners", automationId] });
      setUnlinkTarget(null);
      toast.success("Máquina desvinculada da automação.");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível desvincular a máquina."));
    },
  });

  const runNowMutation = useMutation({
    mutationFn: () => {
      if (!automationQuery.data) throw new Error("Automação ainda não carregou.");
      return createTask(runNowPayload(automationQuery.data));
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setRunNowOpen(false);
      toast.success(`Task #${data.task.id} entrou na fila.`);
      navigate(`/tasks/${data.task.id}`);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível criar a task."));
    },
  });

  const linkedRunners = useMemo(() => linkedRunnersQuery.data ?? [], [linkedRunnersQuery.data]);

  const availableRunners = useMemo(() => {
    const linkedRunnerIds = new Set(linkedRunners.map((item) => item.runner_id));
    return (runnersQuery.data ?? []).filter((runner) => !linkedRunnerIds.has(runner.id));
  }, [runnersQuery.data, linkedRunners]);

  function handleRefresh() {
    automationQuery.refetch();
    linkedRunnersQuery.refetch();
  }

  function handleConfirmLink() {
    if (!selectedRunnerId) return;
    linkMutation.mutate(Number(selectedRunnerId));
  }

  function handleConfirmUnlink() {
    if (!unlinkTarget) return;
    unlinkMutation.mutate(unlinkTarget.id);
  }

  if (!Number.isFinite(automationId) || automationId <= 0) {
    return (
      <div className="space-y-5">
        <section className={card}>
          <PageHeader title="Automação" backTo="/automations" backLabel="Voltar para automações" />
          <div className={cardBody}>
            <EmptyState title="ID de automação inválido" description="Confira o endereço e tente de novo." />
          </div>
        </section>
      </div>
    );
  }

  const automation = automationQuery.data;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/automations"
          backLabel="Voltar para automações"
          title={automation ? automation.name : `Automação #${automationId}`}
          description={automation?.label || "Dados da automação e máquinas onde ela pode rodar."}
          meta={
            automation ? (
              <span className={cn(badge, automation.active ? tone.success : tone.neutral)}>
                {automation.active ? "Ativa" : "Inativa"}
              </span>
            ) : null
          }
          actions={
            <>
              <RefreshIndicator
                updatedAt={automationQuery.dataUpdatedAt}
                isFetching={automationQuery.isFetching || linkedRunnersQuery.isFetching}
                onRefresh={handleRefresh}
              />
              <button
                type="button"
                onClick={() => navigate(`/automations/${automationId}/edit`)}
                className={btn.secondary}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => setRunNowOpen(true)}
                disabled={!automation || !automation.active}
                title={automation && !automation.active ? "Ative a automação para executar" : undefined}
                className={btn.primary}
              >
                <Play className="h-4 w-4" />
                Executar agora
              </button>
            </>
          }
        />

        <div className={cardBody}>
          {automationQuery.isLoading ? (
            <DetailSkeleton fields={8} />
          ) : automationQuery.isError || !automation ? (
            <QueryError
              error={automationQuery.error}
              what="a automação"
              onRetry={() => automationQuery.refetch()}
              retrying={automationQuery.isFetching}
            />
          ) : (
            <div className="space-y-6">
              <CredentialAlertStrip alerts={automation.credential_alerts} />

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Resumo</h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem
                    label="Status"
                    value={
                      <span className={cn(badge, automation.active ? tone.success : tone.neutral)}>
                        {automation.active ? "Ativa" : "Inativa"}
                      </span>
                    }
                  />
                  <InfoItem label="Bot" value={automation.bot_name || `#${automation.bot_id}`} />
                  <InfoItem label="Repositório" value={automation.repository_name || `#${automation.repository_id}`} />
                  <InfoItem label="Prioridade padrão" value={automation.default_priority} />
                  <InfoItem
                    label="Máquinas vinculadas"
                    value={
                      linkedRunnersQuery.isLoading
                        ? "..."
                        : linkedRunners.length === 0
                        ? "Nenhuma (roda em qualquer máquina livre)"
                        : `${linkedRunners.length}`
                    }
                  />
                  <InfoItem label="Nome" value={automation.name} />
                  <InfoItem label="Label" value={automation.label || "---"} />
                  <InfoItem label="Notificação" value={automation.notification_type || "---"} />
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Descrição</h2>
                </div>
                <div className={cardBody}>
                  <div className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {automation.description || "---"}
                  </div>
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Máquinas vinculadas</h2>
                  <button type="button" onClick={() => setIsLinkModalOpen(true)} className={btn.secondary}>
                    <Link2 className="h-4 w-4" />
                    Vincular máquina
                  </button>
                </div>

                {linkedRunnersQuery.isLoading ? (
                  <TableSkeleton rows={3} columns={4} />
                ) : linkedRunnersQuery.isError ? (
                  <div className="px-5 py-5">
                    <QueryError
                      error={linkedRunnersQuery.error}
                      what="as máquinas vinculadas"
                      onRetry={() => linkedRunnersQuery.refetch()}
                      retrying={linkedRunnersQuery.isFetching}
                    />
                  </div>
                ) : linkedRunners.length === 0 ? (
                  <EmptyState
                    compact
                    icon={Server}
                    title="Nenhuma máquina vinculada"
                    description="Sem vínculo, a automação roda em qualquer máquina livre. Vincule para restringir."
                    action={
                      <button type="button" onClick={() => setIsLinkModalOpen(true)} className={btn.secondary}>
                        <Link2 className="h-4 w-4" />
                        Vincular máquina
                      </button>
                    }
                  />
                ) : (
                  <div className={table.wrap}>
                    <table className={table.table}>
                      <thead className={table.thead}>
                        <tr>
                          <th className={table.th}>Máquina</th>
                          <th className={table.th}>Label</th>
                          <th className={table.th}>Status</th>
                          <th className={table.th}>Habilitada</th>
                          <th className={table.thRight}>Ações</th>
                        </tr>
                      </thead>

                      <tbody>
                        {linkedRunners.map((link) => (
                          <tr
                            key={link.id}
                            className={table.trClickable}
                            onClick={() => navigate(`/runners/${link.runner_id}`)}
                          >
                            <td className={table.tdStrong}>
                              <span className={table.truncate} title={link.runner_name || `Máquina #${link.runner_id}`}>
                                {link.runner_name || `Máquina #${link.runner_id}`}
                              </span>
                            </td>
                            <td className={table.tdMuted}>{link.runner_label || "---"}</td>
                            <td className={table.td}>
                              <span className={cn(badge, runnerStatusTone(link.runner_status))}>
                                {formatRunnerStatus(link.runner_status)}
                              </span>
                            </td>
                            <td className={table.td}>
                              <span className={cn(badge, link.runner_enabled ? tone.success : tone.neutral)}>
                                {link.runner_enabled ? "Sim" : "Não"}
                              </span>
                            </td>
                            <td className={table.tdRight}>
                              <ActionsMenu
                                label={`Ações da máquina ${link.runner_name || link.runner_id}`}
                                items={[
                                  {
                                    label: "Desvincular",
                                    icon: Unlink,
                                    tone: "danger",
                                    onSelect: () => setUnlinkTarget(link),
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

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Detalhes técnicos</h2>
                </div>
                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="ID da automação" value={automation.id} />
                  <InfoItem label="ID do bot" value={automation.bot_id} />
                  <InfoItem label="ID do repositório" value={automation.repository_id} />
                  <InfoItem label="Criada em" value={formatDateTime(automation.created_at)} />
                  <InfoItem label="Atualizada em" value={formatDateTime(automation.updated_at)} />
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      <LinkRunnerModal
        open={isLinkModalOpen}
        runners={availableRunners}
        selectedRunnerId={selectedRunnerId}
        onChangeSelectedRunnerId={setSelectedRunnerId}
        onCancel={() => {
          setIsLinkModalOpen(false);
          setSelectedRunnerId("");
        }}
        onConfirm={handleConfirmLink}
        loading={linkMutation.isPending}
      />

      <ConfirmDialog
        open={!!unlinkTarget}
        title="Desvincular máquina"
        description={
          unlinkTarget
            ? `Desvincular "${unlinkTarget.runner_name || `#${unlinkTarget.runner_id}`}" desta automação? Ela deixa de ser candidata a rodar esta automação.`
            : ""
        }
        confirmLabel="Desvincular"
        tone="danger"
        isPending={unlinkMutation.isPending}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={handleConfirmUnlink}
      />

      <ConfirmDialog
        open={runNowOpen}
        title="Executar agora"
        description={
          automation
            ? `Executar agora a automação "${automation.name}"? Entra na fila e roda na próxima máquina livre.`
            : ""
        }
        confirmLabel="Executar"
        isPending={runNowMutation.isPending}
        onCancel={() => setRunNowOpen(false)}
        onConfirm={() => runNowMutation.mutate()}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}

function LinkRunnerModal({
  open,
  runners,
  selectedRunnerId,
  onChangeSelectedRunnerId,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  runners: RunnerRead[];
  selectedRunnerId: string;
  onChangeSelectedRunnerId: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      // Esc dentro da busca do SearchableSelect só fecha a lista, não o modal.
      if (event.key === "Escape" && !event.defaultPrevented) {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9000]" role="dialog" aria-modal="true" aria-label="Vincular máquina">
      <div className="absolute inset-0 bg-slate-950/55" onClick={onCancel} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Vincular máquina</h2>
              <p className="mt-1 text-sm text-slate-500">A automação passa a rodar só nas máquinas vinculadas.</p>
            </div>
            <button type="button" onClick={onCancel} disabled={loading} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            {runners.length === 0 ? (
              <EmptyState compact icon={Server} title="Nenhuma máquina disponível" description="Todas as máquinas cadastradas já estão vinculadas." />
            ) : (
              <div>
                <span className={labelClass}>Máquina</span>
                <SearchableSelect
                  value={selectedRunnerId}
                  onChange={(value) => onChangeSelectedRunnerId(value)}
                  options={runners.map((runner) => ({
                    value: String(runner.id),
                    label: runner.name,
                    description: runner.label || null,
                  }))}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar máquina..."
                  emptyText="Nenhuma máquina encontrada."
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button type="button" onClick={onCancel} disabled={loading} className={btn.secondary}>
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || !selectedRunnerId || runners.length === 0}
              className={btn.primary}
            >
              <Link2 className="h-4 w-4" />
              {loading ? "Vinculando..." : "Vincular"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
