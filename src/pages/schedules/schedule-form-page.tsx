import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Save,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { getAutomation, listAutomations } from "@/services/api/automations";
import {
  createSchedule,
  getSchedule,
  updateSchedule,
} from "@/services/api/schedules";
import type {
  CalendarType,
  CreateSchedulePayload,
  SchedulePolicy,
  ScheduleType,
  UpdateSchedulePayload,
} from "@/types/schedule";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type CronMode =
  | "every-x-minutes"
  | "every-x-hours"
  | "daily-at"
  | "weekly-at"
  | "monthly-at"
  | "custom";

type FormState = {
  name: string;
  automation_id: string;
  priority: string;
  schedule_type: ScheduleType;
  calendar_type: CalendarType;
  policy: SchedulePolicy;
  timezone: string;
  active: boolean;
  use_default_runtime_parameters: boolean;
  runtime_parameters_json: string;

  calendar_interval_value: string;

  cron_mode: CronMode;
  cron_expression: string;
  cron_every_minutes: string;
  cron_every_hours: string;
  cron_daily_hour: string;
  cron_daily_minute: string;
  cron_weekly_days: string[];
  cron_weekly_hour: string;
  cron_weekly_minute: string;
  cron_monthly_day: string;
  cron_monthly_hour: string;
  cron_monthly_minute: string;
};


const initialFormState: FormState = {
  name: "",
  automation_id: "",
  priority: "5",
  schedule_type: "calendar",
  calendar_type: "once",
  policy: "create_always",
  timezone: "America/Sao_Paulo",
  active: true,
  use_default_runtime_parameters: true,
  runtime_parameters_json: "",

  calendar_interval_value: "1",

  cron_mode: "every-x-minutes",
  cron_expression: "*/5 * * * *",
  cron_every_minutes: "5",
  cron_every_hours: "1",
  cron_daily_hour: "8",
  cron_daily_minute: "0",
  cron_weekly_days: ["1"],
  cron_weekly_hour: "8",
  cron_weekly_minute: "0",
  cron_monthly_day: "1",
  cron_monthly_hour: "8",
  cron_monthly_minute: "0",
};

function padCronNumber(value: string) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "0";
  return String(Math.max(0, numeric));
}

function buildCronExpression(form: FormState) {
  switch (form.cron_mode) {
    case "every-x-minutes": {
      const every = Math.max(1, Number(form.cron_every_minutes || 1));
      return `*/${every} * * * *`;
    }

    case "every-x-hours": {
      const every = Math.max(1, Number(form.cron_every_hours || 1));
      return `0 */${every} * * *`;
    }

    case "daily-at": {
      return `${padCronNumber(form.cron_daily_minute)} ${padCronNumber(
        form.cron_daily_hour
      )} * * *`;
    }

    case "weekly-at": {
      const days = form.cron_weekly_days.length
        ? form.cron_weekly_days.join(",")
        : "1";

      return `${padCronNumber(form.cron_weekly_minute)} ${padCronNumber(
        form.cron_weekly_hour
      )} * * ${days}`;
    }

    case "monthly-at": {
      const day = Math.min(31, Math.max(1, Number(form.cron_monthly_day || 1)));
      return `${padCronNumber(form.cron_monthly_minute)} ${padCronNumber(
        form.cron_monthly_hour
      )} ${day} * *`;
    }

    case "custom":
    default:
      return form.cron_expression.trim();
  }
}

function detectCronMode(expression?: string | null): CronMode {
  const value = (expression ?? "").trim();

  if (/^\*\/\d+\s\*\s\*\s\*\s\*$/.test(value)) return "every-x-minutes";
  if (/^0\s\*\/\d+\s\*\s\*\s\*$/.test(value)) return "every-x-hours";
  if (/^\d+\s\d+\s\*\s\*\s\*$/.test(value)) return "daily-at";
  if (/^\d+\s\d+\s\*\s\*\s[\d,]+$/.test(value)) return "weekly-at";
  if (/^\d+\s\d+\s\d+\s\*\s\*$/.test(value)) return "monthly-at";

  return "custom";
}

function parseCronToForm(expression?: string | null) {
  const cron = (expression ?? "").trim();
  const mode = detectCronMode(cron);

  const next = {
    cron_mode: mode as CronMode,
    cron_expression: cron || "*/5 * * * *",
    cron_every_minutes: "5",
    cron_every_hours: "1",
    cron_daily_hour: "8",
    cron_daily_minute: "0",
    cron_weekly_days: ["1"],
    cron_weekly_hour: "8",
    cron_weekly_minute: "0",
    cron_monthly_day: "1",
    cron_monthly_hour: "8",
    cron_monthly_minute: "0",
  };

  if (mode === "every-x-minutes") {
    next.cron_every_minutes = cron.split(" ")[0].replace("*/", "") || "5";
  }

  if (mode === "every-x-hours") {
    next.cron_every_hours = cron.split(" ")[1].replace("*/", "") || "1";
  }

  if (mode === "daily-at") {
    const [minute, hour] = cron.split(" ");
    next.cron_daily_minute = minute || "0";
    next.cron_daily_hour = hour || "8";
  }

  if (mode === "weekly-at") {
    const [minute, hour, , , days] = cron.split(" ");
    next.cron_weekly_minute = minute || "0";
    next.cron_weekly_hour = hour || "8";
    next.cron_weekly_days = days ? days.split(",") : ["1"];
  }

  if (mode === "monthly-at") {
    const [minute, hour, day] = cron.split(" ");
    next.cron_monthly_minute = minute || "0";
    next.cron_monthly_hour = hour || "8";
    next.cron_monthly_day = day || "1";
  }

  return next;
}

function formatCalendarPreview(type: CalendarType, intervalValue: string) {
  if (type === "once") return "Execução única";

  const interval = Math.max(1, Number(intervalValue || 1));

  const labels: Record<string, string> = {
    second: "segundo(s)",
    minute: "minuto(s)",
    hour: "hora(s)",
    day: "dia(s)",
    week: "semana(s)",
    month: "mês(es)",
  };

  return `A cada ${interval} ${labels[type] ?? "intervalo(s)"}`;
}

function prettyPolicy(value: SchedulePolicy) {
  const labels: Record<SchedulePolicy, string> = {
    create_always: "Criar sempre",
    ignore_if_running: "Ignorar se estiver em execução",
    enqueue_if_none_pending: "Enfileirar se não houver pendência",
    run_if_missed: "Executar se perdeu a janela",
    skip_if_missed: "Ignorar se perdeu a janela",
  };

  return labels[value];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


export function ScheduleFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ scheduleId: string }>();

  const scheduleId = Number(params.scheduleId);
  const isEditMode = Number.isFinite(scheduleId) && scheduleId > 0;

  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<FormState>(initialFormState);

  const automationsQuery = useQuery({
    queryKey: ["automations-options"],
    queryFn: () => listAutomations(),
  });

  const scheduleQuery = useQuery({
    queryKey: ["schedule-edit", scheduleId],
    queryFn: () => getSchedule(scheduleId),
    enabled: isEditMode,
  });

  const selectedAutomationId = Number(form.automation_id);

  const automationQuery = useQuery({
    queryKey: ["automation-form-selected", selectedAutomationId],
    queryFn: () => getAutomation(selectedAutomationId),
    enabled: Number.isFinite(selectedAutomationId) && selectedAutomationId > 0,
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!scheduleQuery.data) return;

    const cronData = parseCronToForm(scheduleQuery.data.cron_expression);

    setForm({
      name: scheduleQuery.data.name ?? "",
      automation_id: String(scheduleQuery.data.automation_id ?? ""),
      priority: String(scheduleQuery.data.priority ?? 5),
      schedule_type: scheduleQuery.data.schedule_type ?? "calendar",
      calendar_type: scheduleQuery.data.calendar_type ?? "once",
      policy: scheduleQuery.data.policy ?? "create_always",
      timezone: scheduleQuery.data.timezone ?? "America/Sao_Paulo",
      active: Boolean(scheduleQuery.data.active),
      use_default_runtime_parameters: scheduleQuery.data.use_default_runtime_parameters ?? true,
      runtime_parameters_json: scheduleQuery.data.runtime_parameters_json
        ? JSON.stringify(scheduleQuery.data.runtime_parameters_json, null, 2)
        : "",
      calendar_interval_value: String(scheduleQuery.data.interval_value ?? 1),

      ...cronData,
    });
  }, [scheduleQuery.data]);

  const cronPreview = useMemo(() => buildCronExpression(form), [form]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateSchedulePayload) => createSchedule(payload),
    onSuccess: async (created) => {
      setToast({
        type: "success",
        message: "Agendamento cadastrado com sucesso.",
      });

      await queryClient.invalidateQueries({ queryKey: ["schedules"] });

      setTimeout(() => {
        navigate(`/schedules/${created.id}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível cadastrar o agendamento.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateSchedulePayload) =>
      updateSchedule(scheduleId, payload),
    onSuccess: async () => {
      setToast({
        type: "success",
        message: "Agendamento atualizado com sucesso.",
      });

      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
      await queryClient.invalidateQueries({
        queryKey: ["schedule-edit", scheduleId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["schedule-detail", scheduleId],
      });

      setTimeout(() => {
        navigate(`/schedules/${scheduleId}`);
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível atualizar o agendamento.",
      });
    },
  });

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function toggleWeeklyDay(day: string) {
    setForm((prev) => {
      const exists = prev.cron_weekly_days.includes(day);

      return {
        ...prev,
        cron_weekly_days: exists
          ? prev.cron_weekly_days.filter((item) => item !== day)
          : [...prev.cron_weekly_days, day].sort(),
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    let parsedRuntimeParameters: Record<string, unknown> | null = null;

    if (!form.use_default_runtime_parameters && form.runtime_parameters_json.trim()) {
      try {
        const parsed = JSON.parse(form.runtime_parameters_json);
        if (!isObjectRecord(parsed)) {
          setToast({
            type: "error",
            message: "Parâmetros do robô precisam ser um objeto JSON.",
          });
          return;
        }
        parsedRuntimeParameters = parsed;
      } catch {
        setToast({
          type: "error",
          message: "Parâmetros do robô inválidos.",
        });
        return;
      }
    }

    const commonPayload = {
      name: form.name.trim(),
      automation_id: Number(form.automation_id),
      priority: Number(form.priority),
      schedule_type: form.schedule_type,
      policy: form.policy,
      timezone: form.timezone.trim() || "UTC",
      active: form.active,
      use_default_runtime_parameters: form.use_default_runtime_parameters,
      runtime_parameters_json: form.use_default_runtime_parameters ? null : parsedRuntimeParameters,
    };

    if (form.schedule_type === "calendar") {
      const unitMap: Record<CalendarType, string | null> = {
        once: null,
        second: "seconds",
        minute: "minutes",
        hour: "hours",
        day: "days",
        week: "weeks",
        month: "months",
      };

      const payload = {
        ...commonPayload,
        calendar_type: form.calendar_type,
        cron_expression: null,
        interval_value:
          form.calendar_type === "once"
            ? null
            : Math.max(1, Number(form.calendar_interval_value || 1)),
        interval_unit: unitMap[form.calendar_type],
      };

      if (isEditMode) {
        updateMutation.mutate(payload);
      } else {
        createMutation.mutate(payload);
      }

      return;
    }

    const payload = {
      ...commonPayload,
      calendar_type: null,
      cron_expression: cronPreview,
      interval_value: null,
      interval_unit: null,
    };

    if (isEditMode) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;


  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`fixed right-6 top-20 z-[80] flex items-start gap-3 border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="pr-4 text-sm font-medium">{toast.message}</div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 transition hover:text-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() =>
                  navigate(isEditMode ? `/schedules/${scheduleId}` : "/schedules")
                }
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                {isEditMode ? "Editar Agendamento" : "Novo Agendamento"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Cadastro assistido com builder visual para cron e modo calendário.
              </p>
            </div>
          </div>
        </div>

        {isEditMode && scheduleQuery.isLoading ? (
          <div className="px-6 py-10 text-sm text-slate-500">
            Carregando agendamento...
          </div>
        ) : isEditMode && scheduleQuery.isError ? (
          <div className="px-6 py-10 text-sm text-red-600">
            Erro ao carregar agendamento.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-6 px-6 py-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Dados principais
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <FormField label="Nome do agendamento">
                    <input
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="Ex.: Execução a cada 5 minutos"
                      required
                    />
                  </FormField>

                  <FormField label="Automação">
                    <select
                      value={form.automation_id}
                      onChange={(e) => handleChange("automation_id", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      required
                      disabled={automationsQuery.isLoading}
                    >
                      <option value="">Selecione</option>
                      {(automationsQuery.data ?? []).map((automation) => (
                        <option key={automation.id} value={automation.id}>
                          {automation.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Prioridade">
                    <input
                      value={form.priority}
                      onChange={(e) => handleChange("priority", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      type="number"
                      min={1}
                      max={10}
                      required
                    />
                  </FormField>

                  <FormField label="Timezone">
                    <input
                      value={form.timezone}
                      onChange={(e) => handleChange("timezone", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="America/Sao_Paulo"
                      required
                    />
                  </FormField>

                  <FormField label="Policy">
                    <select
                      value={form.policy}
                      onChange={(e) =>
                        handleChange("policy", e.target.value as SchedulePolicy)
                      }
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    >
                      <option value="create_always">Criar sempre</option>
                      <option value="ignore_if_running">
                        Ignorar se estiver em execução
                      </option>
                      <option value="enqueue_if_none_pending">
                        Enfileirar se não houver pendência
                      </option>
                      <option value="run_if_missed">
                        Executar se perdeu a janela
                      </option>
                      <option value="skip_if_missed">
                        Ignorar se perdeu a janela
                      </option>
                    </select>
                  </FormField>

                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                      <input
                        checked={form.active}
                        onChange={(e) => handleChange("active", e.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Agendamento ativo
                    </label>
                  </div>
                </div>

                {automationQuery.data ? (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3 border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-medium">Automação selecionada</p>
                        <p className="mt-1">
                          {automationQuery.data.name}
                          {automationQuery.data.label
                            ? ` · ${automationQuery.data.label}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Tipo de agendamento
                  </h2>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleChange("schedule_type", "calendar")}
                    className={`border px-4 py-4 text-left transition ${
                      form.schedule_type === "calendar"
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">Calendário assistido</p>
                    <p className="mt-1 text-xs opacity-80">
                      Interface simples para repetição controlada.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChange("schedule_type", "cron")}
                    className={`border px-4 py-4 text-left transition ${
                      form.schedule_type === "cron"
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <p className="text-sm font-semibold">Cron avançado assistido</p>
                    <p className="mt-1 text-xs opacity-80">
                      Builder visual que gera a expressão cron automaticamente.
                    </p>
                  </button>
                </div>
              </section>

              {form.schedule_type === "calendar" ? (
                <section className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Configuração de calendário
                    </h2>
                  </div>

                  <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                    <FormField label="Frequência">
                      <select
                        value={form.calendar_type}
                        onChange={(e) =>
                          handleChange("calendar_type", e.target.value as CalendarType)
                        }
                        className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      >
                        <option value="once">Execução única</option>
                        <option value="second">Repetição por segundo</option>
                        <option value="minute">Repetição por minuto</option>
                        <option value="hour">Repetição por hora</option>
                        <option value="day">Repetição por dia</option>
                        <option value="week">Repetição por semana</option>
                        <option value="month">Repetição por mês</option>
                      </select>
                    </FormField>

                    {form.calendar_type !== "once" ? (
                      <FormField label="Intervalo">
                        <input
                          value={form.calendar_interval_value}
                          onChange={(e) =>
                            handleChange("calendar_interval_value", e.target.value)
                          }
                          className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          type="number"
                          min={1}
                          required
                        />
                      </FormField>
                    ) : (
                      <div />
                    )}
                  </div>

                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Preview
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatCalendarPreview(
                          form.calendar_type,
                          form.calendar_interval_value
                        )}
                      </p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Builder de cron
                    </h2>
                  </div>

                  <div className="space-y-5 px-5 py-5">
                    <FormField label="Modelo de agendamento">
                      <select
                        value={form.cron_mode}
                        onChange={(e) =>
                          handleChange("cron_mode", e.target.value as CronMode)
                        }
                        className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      >
                        <option value="every-x-minutes">A cada X minutos</option>
                        <option value="every-x-hours">A cada X horas</option>
                        <option value="daily-at">Todos os dias em um horário</option>
                        <option value="weekly-at">Semanal em dias selecionados</option>
                        <option value="monthly-at">Mensal em dia fixo</option>
                        <option value="custom">Cron customizado</option>
                      </select>
                    </FormField>

                    {form.cron_mode === "every-x-minutes" ? (
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField label="Executar a cada quantos minutos">
                          <input
                            value={form.cron_every_minutes}
                            onChange={(e) =>
                              handleChange("cron_every_minutes", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={1}
                          />
                        </FormField>
                      </div>
                    ) : null}

                    {form.cron_mode === "every-x-hours" ? (
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField label="Executar a cada quantas horas">
                          <input
                            value={form.cron_every_hours}
                            onChange={(e) =>
                              handleChange("cron_every_hours", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={1}
                          />
                        </FormField>
                      </div>
                    ) : null}

                    {form.cron_mode === "daily-at" ? (
                      <div className="grid gap-5 md:grid-cols-2">
                        <FormField label="Hora">
                          <input
                            value={form.cron_daily_hour}
                            onChange={(e) =>
                              handleChange("cron_daily_hour", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={0}
                            max={23}
                          />
                        </FormField>

                        <FormField label="Minuto">
                          <input
                            value={form.cron_daily_minute}
                            onChange={(e) =>
                              handleChange("cron_daily_minute", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={0}
                            max={59}
                          />
                        </FormField>
                      </div>
                    ) : null}

                    {form.cron_mode === "weekly-at" ? (
                      <div className="space-y-5">
                        <div>
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Dias da semana
                          </span>

                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: "Dom", value: "0" },
                              { label: "Seg", value: "1" },
                              { label: "Ter", value: "2" },
                              { label: "Qua", value: "3" },
                              { label: "Qui", value: "4" },
                              { label: "Sex", value: "5" },
                              { label: "Sáb", value: "6" },
                            ].map((day) => {
                              const selected = form.cron_weekly_days.includes(day.value);

                              return (
                                <button
                                  key={day.value}
                                  type="button"
                                  onClick={() => toggleWeeklyDay(day.value)}
                                  className={`h-10 min-w-[52px] border px-3 text-sm font-medium transition ${
                                    selected
                                      ? "border-slate-950 bg-slate-950 text-white"
                                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                                  }`}
                                >
                                  {day.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <FormField label="Hora">
                            <input
                              value={form.cron_weekly_hour}
                              onChange={(e) =>
                                handleChange("cron_weekly_hour", e.target.value)
                              }
                              className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                              type="number"
                              min={0}
                              max={23}
                            />
                          </FormField>

                          <FormField label="Minuto">
                            <input
                              value={form.cron_weekly_minute}
                              onChange={(e) =>
                                handleChange("cron_weekly_minute", e.target.value)
                              }
                              className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                              type="number"
                              min={0}
                              max={59}
                            />
                          </FormField>
                        </div>
                      </div>
                    ) : null}

                    {form.cron_mode === "monthly-at" ? (
                      <div className="grid gap-5 md:grid-cols-3">
                        <FormField label="Dia do mês">
                          <input
                            value={form.cron_monthly_day}
                            onChange={(e) =>
                              handleChange("cron_monthly_day", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={1}
                            max={31}
                          />
                        </FormField>

                        <FormField label="Hora">
                          <input
                            value={form.cron_monthly_hour}
                            onChange={(e) =>
                              handleChange("cron_monthly_hour", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={0}
                            max={23}
                          />
                        </FormField>

                        <FormField label="Minuto">
                          <input
                            value={form.cron_monthly_minute}
                            onChange={(e) =>
                              handleChange("cron_monthly_minute", e.target.value)
                            }
                            className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                            type="number"
                            min={0}
                            max={59}
                          />
                        </FormField>
                      </div>
                    ) : null}

                    {form.cron_mode === "custom" ? (
                      <FormField label="Expressão cron">
                        <input
                          value={form.cron_expression}
                          onChange={(e) =>
                            handleChange("cron_expression", e.target.value)
                          }
                          className="h-10 w-full border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                          placeholder="*/5 * * * *"
                        />
                      </FormField>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Preview cron
                        </p>
                        <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-950">
                          {cronPreview}
                        </p>
                      </div>

                      <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Policy atual
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-950">
                          {prettyPolicy(form.policy)}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Parâmetros do robô
                  </h2>
                </div>

                <div className="space-y-4 px-5 py-5">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={form.use_default_runtime_parameters}
                      onChange={(e) =>
                        handleChange("use_default_runtime_parameters", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Usar parâmetros da automação
                    </span>
                  </label>

                  {form.use_default_runtime_parameters ? (
                    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Preview — parâmetros da automação
                      </p>
                      <pre className="font-mono text-xs text-slate-700">
                        {automationQuery.data?.default_runtime_parameters_json
                          ? JSON.stringify(automationQuery.data.default_runtime_parameters_json, null, 2)
                          : "Nenhum parâmetro padrão cadastrado na automação."}
                      </pre>
                    </div>
                  ) : (
                    <textarea
                      value={form.runtime_parameters_json}
                      onChange={(e) => handleChange("runtime_parameters_json", e.target.value)}
                      className="min-h-[160px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder='Ex.: { "filial": "001", "safra": "2026" }'
                    />
                  )}
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  navigate(isEditMode ? `/schedules/${scheduleId}` : "/schedules")
                }
                className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isPending}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isPending ? "Salvando..." : isEditMode ? "Salvar alterações" : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </section>

    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
