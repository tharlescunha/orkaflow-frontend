import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  PauseCircle,
  Pencil,
  PlayCircle,
  Power,
  RefreshCcw,
} from "lucide-react";

import { getAutomation } from "@/services/api/automations";
import {
  deactivateSchedule,
  getSchedule,
  pauseSchedule,
  reactivateSchedule,
} from "@/services/api/schedules";
import type { ScheduleRead } from "@/types/schedule";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatBoolean(value: boolean) {
  return value ? "Sim" : "Não";
}

function getStatusLabel(schedule: ScheduleRead) {
  if (schedule.status === "paused") return "Pausado";
  if (schedule.status === "error") return "Erro";
  if (schedule.status === "inactive") return "Inativo";
  if (schedule.status === "active") return schedule.active ? "Ativo" : "Inativo";
  return schedule.active ? "Ativo" : "Inativo";
}

function getPolicyLabel(value?: string | null) {
  const labels: Record<string, string> = {
    create_always: "Criar sempre",
    ignore_if_running: "Ignorar se estiver em execução",
    enqueue_if_none_pending: "Enfileirar se não houver pendência",
    run_if_missed: "Executar se perdeu a janela",
    skip_if_missed: "Ignorar se perdeu a janela",
  };

  return labels[value ?? ""] ?? value ?? "---";
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

  return labels[value ?? ""] ?? value ?? "---";
}

function formatParameters(value: unknown) {
  if (!value) return "---";

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ScheduleDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ scheduleId: string }>();

  const scheduleId = Number(params.scheduleId);

  const scheduleQuery = useQuery({
    queryKey: ["schedule-detail", scheduleId],
    queryFn: () => getSchedule(scheduleId),
    enabled: Number.isFinite(scheduleId) && scheduleId > 0,
  });

  const automationQuery = useQuery({
    queryKey: ["schedule-automation", scheduleQuery.data?.automation_id],
    queryFn: () => getAutomation(Number(scheduleQuery.data?.automation_id)),
    enabled: Boolean(scheduleQuery.data?.automation_id),
  });

  const pauseMutation = useMutation({
    mutationFn: () => pauseSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedule-detail", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => reactivateSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedule-detail", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedule-detail", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const schedule = scheduleQuery.data;

  const ruleSummary = useMemo(() => {
    if (!schedule) return "---";

    if (schedule.schedule_type === "cron") {
      return schedule.cron_expression || "---";
    }

    if (schedule.calendar_type === "once") {
      return "Execução única";
    }

    return `A cada ${schedule.interval_value ?? 1} ${getCalendarTypeLabel(
      schedule.calendar_type
    ).toLowerCase()}(s)`;
  }, [schedule]);

  function handleRefresh() {
    scheduleQuery.refetch();
    automationQuery.refetch();
  }

  if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de agendamento inválido.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/schedules")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para agendamentos
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes do Agendamento #{scheduleId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualização completa da configuração e do estado atual do schedule.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>

              <button
                type="button"
                onClick={() => navigate(`/schedules/${scheduleId}/edit`)}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>

              {schedule?.status === "paused" ? (
                <button
                  type="button"
                  onClick={() => reactivateMutation.mutate()}
                  className="inline-flex h-10 items-center gap-2 border border-emerald-300 bg-white px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                >
                  <PlayCircle className="h-4 w-4" />
                  Reativar
                </button>
              ) : schedule?.active ? (
                <button
                  type="button"
                  onClick={() => pauseMutation.mutate()}
                  className="inline-flex h-10 items-center gap-2 border border-amber-300 bg-white px-4 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                >
                  <PauseCircle className="h-4 w-4" />
                  Pausar
                </button>
              ) : null}

              {schedule?.active ? (
                <button
                  type="button"
                  onClick={() => deactivateMutation.mutate()}
                  className="inline-flex h-10 items-center gap-2 border border-red-300 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50"
                >
                  <Power className="h-4 w-4" />
                  Desativar
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {scheduleQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando agendamento...</p>
          ) : scheduleQuery.isError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados do agendamento.
            </div>
          ) : schedule ? (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="ID" value={String(schedule.id)} />
                  <InfoItem label="Nome" value={schedule.name} />
                  <InfoItem
                    label="Automação"
                    value={automationQuery.data?.name ?? `Automação #${schedule.automation_id}`}
                  />
                  <InfoItem label="Status" value={getStatusLabel(schedule)} />
                  <InfoItem
                    label="Ativo"
                    value={formatBoolean(schedule.active)}
                  />
                  <InfoItem label="Tipo" value={schedule.schedule_type === "cron" ? "Cron" : "Calendário"} />
                  <InfoItem label="Regra" value={ruleSummary} />
                  <InfoItem label="Timezone" value={schedule.timezone} />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Configuração
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="Prioridade" value={String(schedule.priority)} />
                  <InfoItem label="Policy" value={getPolicyLabel(schedule.policy)} />
                  <InfoItem
                    label="Calendar type"
                    value={getCalendarTypeLabel(schedule.calendar_type)}
                  />
                  <InfoItem
                    label="Cron expression"
                    value={schedule.cron_expression || "---"}
                  />
                  <InfoItem
                    label="Interval value"
                    value={
                      schedule.interval_value !== null &&
                      schedule.interval_value !== undefined
                        ? String(schedule.interval_value)
                        : "---"
                    }
                  />
                  <InfoItem
                    label="Interval unit"
                    value={schedule.interval_unit || "---"}
                  />
                  <InfoItem
                    label="Misfire policy"
                    value={schedule.misfire_policy || "---"}
                  />
                  <InfoItem
                    label="Próxima execução"
                    value={formatDateTime(schedule.next_run_at)}
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Runtime
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="Início" value={formatDateTime(schedule.start_at)} />
                  <InfoItem label="Fim" value={formatDateTime(schedule.end_at)} />
                  <InfoItem
                    label="Última execução"
                    value={formatDateTime(schedule.last_run_at)}
                  />
                  <InfoItem
                    label="Próxima execução"
                    value={formatDateTime(schedule.next_run_at)}
                  />
                  <InfoItem
                    label="Criado em"
                    value={formatDateTime(schedule.created_at)}
                  />
                  <InfoItem
                    label="Atualizado em"
                    value={formatDateTime(schedule.updated_at)}
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Parâmetros do robô
                  </h2>
                </div>

                <div className="px-5 py-5">
                  <pre className="overflow-x-auto border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                    {formatParameters(schedule.runtime_parameters_json)}
                  </pre>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Credenciais JSON
                  </h2>
                </div>

                <div className="px-5 py-5">
                  <pre className="overflow-x-auto border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                    {formatParameters(schedule.parameters_json)}
                  </pre>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}
