import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Eye,
  PauseCircle,
  PlayCircle,
  Plus,
  Power,
  RefreshCcw,
  Search,
} from "lucide-react";

import { listAutomations } from "@/services/api/automations";
import {
  deactivateSchedule,
  listSchedules,
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

function normalizeText(value?: string | null) {
  return (value ?? "").toLowerCase().trim();
}

function getStatusLabel(schedule: ScheduleRead) {
  if (schedule.status === "paused") return "Pausado";
  if (schedule.status === "error") return "Erro";
  if (schedule.status === "inactive") return "Inativo";
  if (schedule.status === "active") return schedule.active ? "Ativo" : "Inativo";
  return schedule.active ? "Ativo" : "Inativo";
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
    return schedule.cron_expression || "---";
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

function StatusBadge({ schedule }: { schedule: ScheduleRead }) {
  const label = getStatusLabel(schedule);

  const classes =
    label === "Ativo"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : label === "Pausado"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : label === "Erro"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

export function SchedulesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [automationFilter, setAutomationFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

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
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (scheduleId: number) => reactivateSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (scheduleId: number) => deactivateSchedule(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  const automationMap = useMemo(() => {
    const map = new Map<number, string>();

    for (const automation of automationsQuery.data ?? []) {
      map.set(automation.id, automation.name);
    }

    return map;
  }, [automationsQuery.data]);

  const filteredSchedules = useMemo(() => {
    const term = normalizeText(search);

    return (schedulesQuery.data ?? []).filter((schedule) => {
      const automationName = automationMap.get(schedule.automation_id) ?? "";
      const status = getStatusLabel(schedule);

      const matchesText =
        !term ||
        normalizeText(schedule.name).includes(term) ||
        normalizeText(automationName).includes(term) ||
        normalizeText(schedule.cron_expression).includes(term) ||
        normalizeText(status).includes(term);

      const matchesAutomation =
        !automationFilter || String(schedule.automation_id) === automationFilter;

      const matchesActive =
        !activeFilter ||
        (activeFilter === "active" && schedule.active) ||
        (activeFilter === "inactive" && !schedule.active);

      return matchesText && matchesAutomation && matchesActive;
    });
  }, [schedulesQuery.data, automationMap, search, automationFilter, activeFilter]);

  function handleRefresh() {
    schedulesQuery.refetch();
    automationsQuery.refetch();
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                Agendamentos
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Listagem dos schedules com automação vinculada, regra de execução e status.
              </p>
            </div>

            <div className="flex items-center gap-3">
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
                onClick={() => navigate("/schedules/new")}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Novo agendamento
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <section className="border border-slate-200 bg-slate-50">
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Buscar
                </span>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nome do schedule, automação, cron..."
                    className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Automação
                </span>
                <select
                  value={automationFilter}
                  onChange={(e) => setAutomationFilter(e.target.value)}
                  className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">Todas</option>
                  {(automationsQuery.data ?? []).map((automation) => (
                    <option key={automation.id} value={automation.id}>
                      {automation.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Ativo
                </span>
                <select
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
              </label>

              <div className="flex items-end">
                <div className="w-full border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Total listado
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-950">
                    {filteredSchedules.length}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Schedule
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Automação
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Regra
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Próxima execução
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {schedulesQuery.isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        Carregando agendamentos...
                      </td>
                    </tr>
                  ) : schedulesQuery.isError ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-red-600">
                        Não foi possível carregar os agendamentos.
                      </td>
                    </tr>
                  ) : filteredSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        Nenhum agendamento encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredSchedules.map((schedule) => {
                      const automationName =
                        automationMap.get(schedule.automation_id) ??
                        `Automação #${schedule.automation_id}`;

                      return (
                        <tr
                          key={schedule.id}
                          className="border-b border-slate-200 last:border-b-0"
                        >
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 items-center justify-center border border-slate-200 bg-slate-50">
                                <CalendarClock className="h-4 w-4 text-slate-700" />
                              </div>

                              <div>
                                <p className="text-sm font-semibold text-slate-900">
                                  {schedule.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  ID #{schedule.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-700">
                            {automationName}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-700">
                            {getTypeLabel(schedule)}
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-700">
                            <div className="max-w-[260px] break-words">
                              {getRuleLabel(schedule)}
                            </div>
                          </td>

                          <td className="px-4 py-4 align-top text-sm text-slate-700">
                            {formatDateTime(schedule.next_run_at)}
                          </td>

                          <td className="px-4 py-4 align-top">
                            <StatusBadge schedule={schedule} />
                          </td>

                          <td className="px-4 py-4 align-top">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => navigate(`/schedules/${schedule.id}`)}
                                className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                <Eye className="h-4 w-4" />
                                Ver
                              </button>

                              {schedule.status === "paused" ? (
                                <button
                                  type="button"
                                  onClick={() => reactivateMutation.mutate(schedule.id)}
                                  className="inline-flex h-9 items-center gap-2 border border-emerald-300 bg-white px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
                                >
                                  <PlayCircle className="h-4 w-4" />
                                  Reativar
                                </button>
                              ) : schedule.active ? (
                                <button
                                  type="button"
                                  onClick={() => pauseMutation.mutate(schedule.id)}
                                  className="inline-flex h-9 items-center gap-2 border border-amber-300 bg-white px-3 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
                                >
                                  <PauseCircle className="h-4 w-4" />
                                  Pausar
                                </button>
                              ) : null}

                              {schedule.active ? (
                                <button
                                  type="button"
                                  onClick={() => deactivateMutation.mutate(schedule.id)}
                                  className="inline-flex h-9 items-center gap-2 border border-red-300 bg-white px-3 text-sm font-medium text-red-700 transition hover:bg-red-50"
                                >
                                  <Power className="h-4 w-4" />
                                  Desativar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
