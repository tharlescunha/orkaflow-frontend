import { useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, PauseCircle, Pencil, PlayCircle, Power, RefreshCcw, SkipForward } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { EMPTY, formatBoolean, formatDateTime, formatDateTimeShort, formatRelative } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getAutomation } from "@/services/api/automations";
import { deactivateSchedule, getSchedule, pauseSchedule, reactivateSchedule } from "@/services/api/schedules";
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

function getPolicyLabel(value?: string | null) {
  const labels: Record<string, string> = {
    create_always: "Criar sempre",
    ignore_if_running: "Ignorar se estiver em execução",
    enqueue_if_none_pending: "Enfileirar se não houver pendência",
    run_if_missed: "Executar se perdeu a janela",
    skip_if_missed: "Ignorar se perdeu a janela",
  };

  return labels[value ?? ""] ?? value ?? EMPTY;
}

function getCalendarTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    once: "Uma vez",
    second: "Segundo",
    minute: "Minuto",
    hour: "Hora",
    day: "Dia",
    week: "Semana",
    month: "Mês",
  };

  return labels[value ?? ""] ?? value ?? EMPTY;
}

function getRuleSummary(schedule: ScheduleRead) {
  if (schedule.schedule_type === "cron") {
    return schedule.cron_expression || EMPTY;
  }

  if (schedule.calendar_type === "once") {
    return "Execução única";
  }

  return `A cada ${schedule.interval_value ?? 1} ${getCalendarTypeLabel(schedule.calendar_type).toLowerCase()}(s)`;
}

function formatParameters(value: unknown) {
  if (!value) return EMPTY;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Mesma regra da lista: o "ignorado" só aparece enquanto for o último acontecimento.
function isSkipCurrent(schedule: ScheduleRead) {
  if (!schedule.last_skipped_reason || !schedule.last_skipped_at) return false;
  if (!schedule.last_run_at) return true;
  const skipped = new Date(schedule.last_skipped_at).getTime();
  const ran = new Date(schedule.last_run_at).getTime();
  if (Number.isNaN(skipped)) return false;
  if (Number.isNaN(ran)) return true;
  return skipped > ran;
}

export function ScheduleDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ scheduleId: string }>();

  const scheduleId = Number(params.scheduleId);
  const validId = Number.isFinite(scheduleId) && scheduleId > 0;

  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const scheduleQuery = useQuery({
    queryKey: ["schedule-detail", scheduleId],
    queryFn: () => getSchedule(scheduleId),
    enabled: validId,
  });

  const automationQuery = useQuery({
    queryKey: ["schedule-automation", scheduleQuery.data?.automation_id],
    queryFn: () => getAutomation(Number(scheduleQuery.data?.automation_id)),
    enabled: Boolean(scheduleQuery.data?.automation_id),
  });

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["schedule-detail", scheduleId] });
    await queryClient.invalidateQueries({ queryKey: ["schedules"] });
  }

  const pauseMutation = useMutation({
    mutationFn: () => pauseSchedule(scheduleId),
    onSuccess: async () => {
      toast.success("Agendamento pausado.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível pausar o agendamento.", error));
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateSchedule(scheduleId),
    onSuccess: async () => {
      toast.success("Agendamento reativado.");
      await invalidate();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível reativar o agendamento.", error));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateSchedule(scheduleId),
    onSuccess: async () => {
      toast.success("Agendamento desativado.");
      setConfirmDeactivate(false);
      await invalidate();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível desativar o agendamento.", error));
    },
  });

  const backTo = "/schedules";
  const backLabel = "Voltar para agendamentos";

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Agendamento" backTo={backTo} backLabel={backLabel} />
        <div className="p-5">
          <QueryError error={new Error("ID de agendamento inválido.")} what="o agendamento" />
        </div>
      </section>
    );
  }

  if (scheduleQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Agendamento" backTo={backTo} backLabel={backLabel} />
        <div className="p-5">
          <DetailSkeleton fields={8} />
        </div>
      </section>
    );
  }

  if (scheduleQuery.isError || !scheduleQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Agendamento" backTo={backTo} backLabel={backLabel} />
        <div className="p-5">
          <QueryError
            error={scheduleQuery.error}
            what="o agendamento"
            onRetry={() => scheduleQuery.refetch()}
            retrying={scheduleQuery.isFetching}
          />
        </div>
      </section>
    );
  }

  const schedule = scheduleQuery.data;
  const statusLabel = getStatusLabel(schedule);
  const showSkip = isSkipCurrent(schedule);
  const automationName = automationQuery.data?.name ?? `Automação #${schedule.automation_id}`;
  const actionPending = pauseMutation.isPending || reactivateMutation.isPending || deactivateMutation.isPending;
  const isFetching = scheduleQuery.isFetching || automationQuery.isFetching;

  function handleRefresh() {
    scheduleQuery.refetch();
    automationQuery.refetch();
  }

  return (
    <section className={card}>
      <PageHeader
        title={schedule.name}
        description={`Agendamento #${schedule.id} · ${automationName}`}
        backTo={backTo}
        backLabel={backLabel}
        meta={<span className={cn(badge, STATUS_TONE[statusLabel])}>{statusLabel}</span>}
        actions={
          <>
            <button type="button" onClick={handleRefresh} className={btn.secondary} disabled={isFetching}>
              <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              Atualizar
            </button>

            {schedule.status === "paused" ? (
              <button type="button" onClick={() => reactivateMutation.mutate()} className={btn.secondary} disabled={actionPending}>
                <PlayCircle className="h-4 w-4 text-emerald-600" />
                Reativar
              </button>
            ) : schedule.active ? (
              <button type="button" onClick={() => pauseMutation.mutate()} className={btn.secondary} disabled={actionPending}>
                <PauseCircle className="h-4 w-4 text-amber-600" />
                Pausar
              </button>
            ) : null}

            {schedule.active ? (
              <button type="button" onClick={() => setConfirmDeactivate(true)} className={btn.dangerOutline} disabled={actionPending}>
                <Power className="h-4 w-4" />
                Desativar
              </button>
            ) : null}

            <button type="button" onClick={() => navigate(`/schedules/${scheduleId}/edit`)} className={btn.primary}>
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          </>
        }
      />

      <div className="space-y-5 p-5">
        {schedule.last_error ? (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Último erro do agendamento</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{schedule.last_error}</p>
            </div>
          </div>
        ) : null}

        {showSkip ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <SkipForward className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Última execução ignorada em {formatDateTime(schedule.last_skipped_at)}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{schedule.last_skipped_reason}</p>
            </div>
          </div>
        ) : null}

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Execução</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
            <InfoItem
              label="Próxima execução"
              value={
                schedule.next_run_at ? (
                  <span title={formatDateTime(schedule.next_run_at)}>
                    {formatRelative(schedule.next_run_at)}
                    <span className="block text-xs text-slate-500">{formatDateTimeShort(schedule.next_run_at)}</span>
                  </span>
                ) : (
                  EMPTY
                )
              }
            />
            <InfoItem
              label="Última execução"
              value={
                schedule.last_run_at ? (
                  <span title={formatDateTime(schedule.last_run_at)}>
                    {formatRelative(schedule.last_run_at)}
                    <span className="block text-xs text-slate-500">{formatDateTimeShort(schedule.last_run_at)}</span>
                  </span>
                ) : (
                  EMPTY
                )
              }
            />
            <InfoItem label="Regra" value={<span className="font-mono">{getRuleSummary(schedule)}</span>} />
            <InfoItem label="Tipo" value={schedule.schedule_type === "cron" ? "Cron" : `Calendário · ${getCalendarTypeLabel(schedule.calendar_type)}`} />
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Configuração</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
            <InfoItem label="Automação" value={automationName} />
            <InfoItem label="Prioridade" value={String(schedule.priority)} />
            <InfoItem label="Política" value={getPolicyLabel(schedule.policy)} />
            <InfoItem label="Fuso horário" value={schedule.timezone} />
            <InfoItem label="Ativo" value={formatBoolean(schedule.active)} />
            <InfoItem label="Usa parâmetros da automação" value={formatBoolean(schedule.use_default_runtime_parameters)} />
            <InfoItem label="Início" value={formatDateTime(schedule.start_at)} />
            <InfoItem label="Fim" value={formatDateTime(schedule.end_at)} />
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Parâmetros do robô</h2>
          </div>
          <div className={cardBody}>
            {schedule.use_default_runtime_parameters ? (
              <p className="text-sm text-slate-500">Este agendamento usa os parâmetros padrão cadastrados na automação.</p>
            ) : (
              <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs text-slate-800">
                {formatParameters(schedule.runtime_parameters_json)}
              </pre>
            )}
          </div>
        </section>

        <details className={card}>
          <summary className={cn(cardHeader, "cursor-pointer select-none list-none")}>
            <span className={cardTitle}>Detalhes técnicos</span>
          </summary>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
            <InfoItem label="ID" value={String(schedule.id)} />
            <InfoItem label="Expressão cron" value={<span className="font-mono">{schedule.cron_expression || EMPTY}</span>} />
            <InfoItem
              label="Intervalo"
              value={
                schedule.interval_value !== null && schedule.interval_value !== undefined
                  ? `${schedule.interval_value} ${schedule.interval_unit ?? ""}`.trim()
                  : EMPTY
              }
            />
            <InfoItem label="Misfire policy" value={schedule.misfire_policy || EMPTY} />
            <InfoItem label="Criado em" value={formatDateTime(schedule.created_at)} />
            <InfoItem label="Atualizado em" value={formatDateTime(schedule.updated_at)} />
          </div>
        </details>
      </div>

      <ConfirmDialog
        open={confirmDeactivate}
        title="Desativar agendamento"
        description={`"${schedule.name}" deixa de criar tasks. Você pode editá-lo e marcar como ativo depois.`}
        confirmLabel="Desativar"
        tone="danger"
        isPending={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate()}
        onCancel={() => setConfirmDeactivate(false)}
      />
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      {/* overflow-wrap:anywhere quebra nomes longos sem espaço (ex.: automacao_xxx_yyy) sem alargar a coluna. */}
      <div className="mt-1 text-sm text-slate-800 [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
