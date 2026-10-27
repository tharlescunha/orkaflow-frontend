import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Info, Save, Terminal } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableSelect, type SearchableOption } from "@/components/common/searchable-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getAutomation, listAutomations } from "@/services/api/automations";
import { createSchedule, getSchedule, updateSchedule } from "@/services/api/schedules";
import type {
  CalendarType,
  CreateSchedulePayload,
  SchedulePolicy,
  ScheduleRead,
  ScheduleType,
  UpdateSchedulePayload,
} from "@/types/schedule";
import { toast } from "@/store/toast-store";

type CronMode = "every-x-minutes" | "every-x-hours" | "daily-at" | "weekly-at" | "monthly-at" | "custom";

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
  retry_max: string;
  retry_delay_seconds: string;
  retry_on: string[];

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

type FormErrors = Partial<Record<keyof FormState, string>>;

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
  retry_max: "0",
  retry_delay_seconds: "300",
  retry_on: ["erro", "timeout"],

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

const WEEK_DAYS = [
  { label: "Dom", value: "0" },
  { label: "Seg", value: "1" },
  { label: "Ter", value: "2" },
  { label: "Qua", value: "3" },
  { label: "Qui", value: "4" },
  { label: "Sex", value: "5" },
  { label: "Sáb", value: "6" },
];

const POLICY_LABELS: Record<SchedulePolicy, string> = {
  create_always: "Criar sempre",
  ignore_if_running: "Ignorar se estiver em execução",
  enqueue_if_none_pending: "Enfileirar se não houver pendência",
  run_if_missed: "Executar se perdeu a janela",
  skip_if_missed: "Ignorar se perdeu a janela",
};

const POLICY_HINTS: Record<SchedulePolicy, string> = {
  create_always: "Cria uma task em todo horário, mesmo que a anterior ainda esteja rodando.",
  ignore_if_running: "Se a task anterior ainda estiver em execução, este horário é ignorado.",
  enqueue_if_none_pending: "Só cria uma task se não houver outra aguardando na fila.",
  run_if_missed: "Se o horário passou com o sistema parado, executa assim que voltar.",
  skip_if_missed: "Se o horário passou com o sistema parado, pula e espera o próximo.",
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
      return `${padCronNumber(form.cron_daily_minute)} ${padCronNumber(form.cron_daily_hour)} * * *`;
    }

    case "weekly-at": {
      const days = form.cron_weekly_days.length ? form.cron_weekly_days.join(",") : "1";
      return `${padCronNumber(form.cron_weekly_minute)} ${padCronNumber(form.cron_weekly_hour)} * * ${days}`;
    }

    case "monthly-at": {
      const day = Math.min(31, Math.max(1, Number(form.cron_monthly_day || 1)));
      return `${padCronNumber(form.cron_monthly_minute)} ${padCronNumber(form.cron_monthly_hour)} ${day} * *`;
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
    cron_mode: mode,
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

function scheduleToForm(schedule: ScheduleRead): FormState {
  return {
    name: schedule.name ?? "",
    automation_id: String(schedule.automation_id ?? ""),
    priority: String(schedule.priority ?? 5),
    schedule_type: schedule.schedule_type ?? "calendar",
    calendar_type: schedule.calendar_type ?? "once",
    policy: schedule.policy ?? "create_always",
    timezone: schedule.timezone ?? "America/Sao_Paulo",
    active: Boolean(schedule.active),
    use_default_runtime_parameters: schedule.use_default_runtime_parameters ?? true,
    runtime_parameters_json: schedule.runtime_parameters_json
      ? JSON.stringify(schedule.runtime_parameters_json, null, 2)
      : "",
    calendar_interval_value: String(schedule.interval_value ?? 1),
    retry_max: String(schedule.retry_max ?? 0),
    retry_delay_seconds: String(schedule.retry_delay_seconds ?? 300),
    retry_on: schedule.retry_on ?? ["erro", "timeout"],
    ...parseCronToForm(schedule.cron_expression),
  };
}

function formatCalendarPreview(type: CalendarType, intervalValue: string) {
  if (type === "once") return "Roda uma única vez, assim que for ativado e o scheduler passar por ele.";

  const interval = Math.max(1, Number(intervalValue || 1));

  const labels: Record<string, [string, string]> = {
    second: ["segundo", "segundos"],
    minute: ["minuto", "minutos"],
    hour: ["hora", "horas"],
    day: ["dia", "dias"],
    week: ["semana", "semanas"],
    month: ["mês", "meses"],
  };

  const [singular, plural] = labels[type] ?? ["intervalo", "intervalos"];
  return interval === 1 ? `Roda a cada ${singular}.` : `Roda a cada ${interval} ${plural}.`;
}

function pad2(value: string) {
  return value.padStart(2, "0");
}

function describeWeekDays(field: string) {
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const parts = field.split(",").map((d) => names[Number(d)] ?? d);
  return parts.join(", ");
}

// Tradução simples da expressão para quem não lê cron. Cobre os padrões do builder e,
// para o resto, mostra campo a campo.
function describeCron(expression: string): { ok: boolean; text: string } {
  const fields = expression.trim().split(/\s+/).filter(Boolean);
  if (fields.length !== 5) {
    return { ok: false, text: "A expressão precisa ter 5 campos separados por espaço: minuto, hora, dia do mês, mês e dia da semana." };
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  const everyMinute = minute.match(/^\*\/(\d+)$/);
  const everyHour = hour.match(/^\*\/(\d+)$/);
  const isNum = (v: string) => /^\d+$/.test(v);

  if (everyMinute && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { ok: true, text: `Roda a cada ${everyMinute[1]} minuto(s), o dia todo.` };
  }
  if (isNum(minute) && everyHour && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { ok: true, text: `Roda a cada ${everyHour[1]} hora(s), sempre no minuto ${pad2(minute)}.` };
  }
  if (isNum(minute) && isNum(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return { ok: true, text: `Roda todos os dias às ${pad2(hour)}:${pad2(minute)}.` };
  }
  if (isNum(minute) && isNum(hour) && dayOfMonth === "*" && month === "*" && /^[\d,]+$/.test(dayOfWeek)) {
    return { ok: true, text: `Roda às ${pad2(hour)}:${pad2(minute)} em: ${describeWeekDays(dayOfWeek)}.` };
  }
  if (isNum(minute) && isNum(hour) && dayOfMonth === "*" && month === "*" && /^(\d)-(\d)$/.test(dayOfWeek)) {
    const [, a, b] = dayOfWeek.match(/^(\d)-(\d)$/) ?? [];
    return { ok: true, text: `Roda às ${pad2(hour)}:${pad2(minute)}, de ${describeWeekDays(a)} a ${describeWeekDays(b)}.` };
  }
  if (isNum(minute) && isNum(hour) && isNum(dayOfMonth) && month === "*" && dayOfWeek === "*") {
    return { ok: true, text: `Roda no dia ${dayOfMonth} de cada mês às ${pad2(hour)}:${pad2(minute)}.` };
  }

  const any = (v: string) => (v === "*" ? "qualquer" : v);
  return {
    ok: true,
    text: `Minuto: ${any(minute)} · Hora: ${any(hour)} · Dia do mês: ${any(dayOfMonth)} · Mês: ${any(month)} · Dia da semana: ${any(dayOfWeek)}.`,
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPriority(value: string) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10;
}

export function ScheduleFormPage() {
  const params = useParams<{ scheduleId: string }>();

  const scheduleId = Number(params.scheduleId);
  const isEditMode = Number.isFinite(scheduleId) && scheduleId > 0;

  const automationsQuery = useQuery({
    queryKey: ["automations-options"],
    queryFn: () => listAutomations(),
  });

  const scheduleQuery = useQuery({
    queryKey: ["schedule-edit", scheduleId],
    queryFn: () => getSchedule(scheduleId),
    enabled: isEditMode,
  });

  const title = isEditMode ? "Editar agendamento" : "Novo agendamento";
  const backTo = isEditMode ? `/schedules/${scheduleId}` : "/schedules";
  const backLabel = isEditMode ? "Voltar para o agendamento" : "Voltar para agendamentos";

  if (isEditMode && scheduleQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo={backTo} backLabel={backLabel} />
        <div className="p-5">
          <DetailSkeleton fields={8} />
        </div>
      </section>
    );
  }

  if (isEditMode && (scheduleQuery.isError || !scheduleQuery.data)) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo={backTo} backLabel={backLabel} />
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

  // O formulário só nasce quando os dados chegaram: nada de re-hidratar por efeito depois.
  const initial = isEditMode && scheduleQuery.data ? scheduleToForm(scheduleQuery.data) : initialFormState;

  return (
    <ScheduleForm
      key={isEditMode ? `edit-${scheduleId}` : "new"}
      initial={initial}
      scheduleId={isEditMode ? scheduleId : null}
      title={title}
      backTo={backTo}
      backLabel={backLabel}
      automations={automationsQuery.data ?? []}
      automationsLoading={automationsQuery.isLoading}
    />
  );
}

type ScheduleFormProps = {
  initial: FormState;
  scheduleId: number | null;
  title: string;
  backTo: string;
  backLabel: string;
  automations: Awaited<ReturnType<typeof listAutomations>>;
  automationsLoading: boolean;
};

function ScheduleForm({ initial, scheduleId, title, backTo, backLabel, automations, automationsLoading }: ScheduleFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = scheduleId !== null;

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const selectedAutomationId = Number(form.automation_id);

  // Só automações ativas por padrão; a já vinculada (edição) continua na lista mesmo se inativa.
  const automationOptions = useMemo<SearchableOption<number>[]>(() => {
    return automations
      .filter((automation) => automation.active || automation.id === selectedAutomationId)
      .map((automation) => ({
        value: automation.id,
        label: automation.name,
        description:
          [automation.active ? null : "Inativa", automation.repository_name, automation.bot_name]
            .filter(Boolean)
            .join(" · ") || null,
      }));
  }, [automations, selectedAutomationId]);

  const automationQuery = useQuery({
    queryKey: ["automation-form-selected", selectedAutomationId],
    queryFn: () => getAutomation(selectedAutomationId),
    enabled: Number.isFinite(selectedAutomationId) && selectedAutomationId > 0,
  });

  const cronPreview = useMemo(() => buildCronExpression(form), [form]);
  const cronDescription = useMemo(() => describeCron(cronPreview), [cronPreview]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateSchedulePayload) => createSchedule(payload),
    onSuccess: async (created) => {
      toast.success("Agendamento cadastrado.");
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
      navigate(`/schedules/${created.id}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cadastrar o agendamento.", error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateSchedulePayload) => updateSchedule(scheduleId as number, payload),
    onSuccess: async () => {
      toast.success("Agendamento atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["schedules"] });
      await queryClient.invalidateQueries({ queryKey: ["schedule-edit", scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ["schedule-detail", scheduleId] });
      navigate(`/schedules/${scheduleId}`);
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar o agendamento.", error));
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function toggleWeeklyDay(day: string) {
    setForm((prev) => {
      const exists = prev.cron_weekly_days.includes(day);
      return {
        ...prev,
        cron_weekly_days: exists ? prev.cron_weekly_days.filter((item) => item !== day) : [...prev.cron_weekly_days, day].sort(),
      };
    });
    if (errors.cron_weekly_days) {
      setErrors((prev) => ({ ...prev, cron_weekly_days: undefined }));
    }
  }

  function validate(): { errors: FormErrors; runtimeParameters: Record<string, unknown> | null } {
    const next: FormErrors = {};
    let runtimeParameters: Record<string, unknown> | null = null;

    if (!form.name.trim()) next.name = "Informe um nome para o agendamento.";
    if (!form.automation_id) next.automation_id = "Escolha a automação que vai rodar.";
    if (!isValidPriority(form.priority)) next.priority = "Use um número inteiro de 1 a 10.";
    if (!form.timezone.trim()) next.timezone = "Informe o fuso horário (ex.: America/Sao_Paulo).";
    const retryDelay = Number(form.retry_delay_seconds);
    if (!Number.isInteger(retryDelay) || retryDelay < 0 || retryDelay > 86400) {
      next.retry_delay_seconds = "Use um número inteiro de segundos (0 a 86400).";
    }
    if (form.retry_max !== "0" && form.retry_on.length === 0) {
      next.retry_on = "Escolha ao menos um tipo de falha para tentar de novo.";
    }

    if (form.schedule_type === "calendar") {
      if (form.calendar_type !== "once") {
        const interval = Number(form.calendar_interval_value);
        if (!Number.isInteger(interval) || interval < 1) {
          next.calendar_interval_value = "O intervalo precisa ser um número inteiro maior que zero.";
        }
      }
    } else {
      if (form.cron_mode === "custom" && !cronDescription.ok) {
        next.cron_expression = cronDescription.text;
      }
      if (form.cron_mode === "weekly-at" && form.cron_weekly_days.length === 0) {
        next.cron_weekly_days = "Escolha pelo menos um dia da semana.";
      }
    }

    if (!form.use_default_runtime_parameters && form.runtime_parameters_json.trim()) {
      try {
        const parsed: unknown = JSON.parse(form.runtime_parameters_json);
        if (!isObjectRecord(parsed)) {
          next.runtime_parameters_json = "Os parâmetros precisam ser um objeto JSON, ex.: { \"filial\": \"001\" }.";
        } else {
          runtimeParameters = parsed;
        }
      } catch {
        next.runtime_parameters_json = "JSON inválido. Confira vírgulas, aspas e chaves.";
      }
    }

    return { errors: next, runtimeParameters };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const { errors: validationErrors, runtimeParameters } = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const commonPayload = {
      name: form.name.trim(),
      automation_id: Number(form.automation_id),
      priority: Number(form.priority),
      schedule_type: form.schedule_type,
      policy: form.policy,
      timezone: form.timezone.trim() || "UTC",
      active: form.active,
      use_default_runtime_parameters: form.use_default_runtime_parameters,
      runtime_parameters_json: form.use_default_runtime_parameters ? null : runtimeParameters,
      retry_max: Number(form.retry_max),
      retry_delay_seconds: Number(form.retry_delay_seconds),
      retry_on: form.retry_on,
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
        interval_value: form.calendar_type === "once" ? null : Math.max(1, Number(form.calendar_interval_value || 1)),
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  }

  const timeInputs = (hourField: keyof FormState, minuteField: keyof FormState) => (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Hora" error={errors[hourField]}>
        <input
          value={String(form[hourField])}
          onChange={(e) => handleChange(hourField, e.target.value as FormState[typeof hourField])}
          className={input}
          type="number"
          min={0}
          max={23}
        />
      </Field>
      <Field label="Minuto" error={errors[minuteField]}>
        <input
          value={String(form[minuteField])}
          onChange={(e) => handleChange(minuteField, e.target.value as FormState[typeof minuteField])}
          className={input}
          type="number"
          min={0}
          max={59}
        />
      </Field>
    </div>
  );

  return (
    <section className={card}>
      <PageHeader
        title={title}
        description="Escolha a automação, quando ela roda e com quais parâmetros."
        backTo={backTo}
        backLabel={backLabel}
      />

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="space-y-5 p-5">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Dados principais</h2>
            </div>

            <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
              <Field label="Nome do agendamento" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={input}
                  placeholder="Ex.: Conciliação diária às 6h"
                  autoFocus={!isEditMode}
                />
              </Field>

              <Field label="Automação" error={errors.automation_id}>
                <SearchableSelect
                  value={form.automation_id ? Number(form.automation_id) : ""}
                  onChange={(value) => handleChange("automation_id", value === "" ? "" : String(value))}
                  options={automationOptions}
                  placeholder="Selecione a automação"
                  searchPlaceholder="Buscar automação, repositório, bot..."
                  emptyText="Nenhuma automação ativa encontrada."
                  disabled={automationsLoading}
                  loading={automationsLoading}
                />
                {automationQuery.data ? (
                  <p className={cn(hint, "flex items-start gap-1.5")}>
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="[overflow-wrap:anywhere]">
                      {automationQuery.data.name}
                      {automationQuery.data.label ? ` · ${automationQuery.data.label}` : ""}
                    </span>
                  </p>
                ) : null}
              </Field>

              <Field label="Prioridade" error={errors.priority} hintText="De 1 (mais urgente) a 10 (menos urgente).">
                <input
                  value={form.priority}
                  onChange={(e) => handleChange("priority", e.target.value)}
                  className={input}
                  type="number"
                  min={1}
                  max={10}
                />
              </Field>

              <Field label="Fuso horário" error={errors.timezone} hintText="Os horários da regra seguem este fuso.">
                <input
                  value={form.timezone}
                  onChange={(e) => handleChange("timezone", e.target.value)}
                  className={input}
                  placeholder="America/Sao_Paulo"
                />
              </Field>

              <Field label="Política de execução" hintText={POLICY_HINTS[form.policy]}>
                <select
                  value={form.policy}
                  onChange={(e) => handleChange("policy", e.target.value as SchedulePolicy)}
                  className={select}
                >
                  {(Object.keys(POLICY_LABELS) as SchedulePolicy[]).map((value) => (
                    <option key={value} value={value}>
                      {POLICY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex items-end pb-1">
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.active}
                    onChange={(e) => handleChange("active", e.target.checked)}
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Agendamento ativo
                </label>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Retentativa automática</h2>
              <span className="text-xs text-slate-500">Se a task deste agendamento falhar, o orquestrador tenta de novo sozinho.</span>
            </div>

            <div className="grid gap-5 px-5 py-5 md:grid-cols-3">
              <Field label="Tentativas extras" hintText="0 = não tenta de novo. Máximo 5.">
                <select value={form.retry_max} onChange={(e) => handleChange("retry_max", e.target.value)} className={select}>
                  {["0", "1", "2", "3", "4", "5"].map((n) => (
                    <option key={n} value={n}>
                      {n === "0" ? "Nenhuma" : `${n} tentativa${n === "1" ? "" : "s"}`}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Espera entre tentativas (segundos)"
                error={errors.retry_delay_seconds}
                hintText="300 = 5 minutos. Tentativas × espera precisa caber no intervalo do agendamento."
              >
                <input
                  value={form.retry_delay_seconds}
                  onChange={(e) => handleChange("retry_delay_seconds", e.target.value)}
                  className={input}
                  type="number"
                  min={0}
                  max={86400}
                  disabled={form.retry_max === "0"}
                />
              </Field>

              <Field label="Tentar de novo quando" error={errors.retry_on} hintText="Cancelada, parada forçada e credencial inválida nunca repetem.">
                <div className="flex flex-col gap-2 pt-1">
                  {[
                    ["erro", "Terminou com erro"],
                    ["timeout", "Estourou o tempo"],
                  ].map(([value, text]) => (
                    <label key={value} className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.retry_on.includes(value)}
                        disabled={form.retry_max === "0"}
                        onChange={(e) =>
                          handleChange(
                            "retry_on",
                            e.target.checked ? [...form.retry_on, value] : form.retry_on.filter((v) => v !== value)
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {text}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Quando roda</h2>
            </div>

            <div className={cn(cardBody, "space-y-5")}>
              <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Tipo de agendamento">
                <TypeOption
                  selected={form.schedule_type === "calendar"}
                  onSelect={() => handleChange("schedule_type", "calendar")}
                  icon={<CalendarDays className="h-4 w-4" />}
                  title="Calendário"
                  description="Uma vez ou a cada X minutos, horas, dias..."
                />
                <TypeOption
                  selected={form.schedule_type === "cron"}
                  onSelect={() => handleChange("schedule_type", "cron")}
                  icon={<Terminal className="h-4 w-4" />}
                  title="Cron"
                  description="Horários fixos: todo dia às 6h, segunda a sexta, dia 1 do mês..."
                />
              </div>

              {form.schedule_type === "calendar" ? (
                <div className="space-y-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <Field label="Frequência">
                      <select
                        value={form.calendar_type}
                        onChange={(e) => handleChange("calendar_type", e.target.value as CalendarType)}
                        className={select}
                      >
                        <option value="once">Execução única</option>
                        <option value="second">A cada X segundos</option>
                        <option value="minute">A cada X minutos</option>
                        <option value="hour">A cada X horas</option>
                        <option value="day">A cada X dias</option>
                        <option value="week">A cada X semanas</option>
                        <option value="month">A cada X meses</option>
                      </select>
                    </Field>

                    {form.calendar_type !== "once" ? (
                      <Field label="Intervalo" error={errors.calendar_interval_value}>
                        <input
                          value={form.calendar_interval_value}
                          onChange={(e) => handleChange("calendar_interval_value", e.target.value)}
                          className={input}
                          type="number"
                          min={1}
                        />
                      </Field>
                    ) : null}
                  </div>

                  <Preview label="Resumo">{formatCalendarPreview(form.calendar_type, form.calendar_interval_value)}</Preview>
                </div>
              ) : (
                <div className="space-y-5">
                  <Field label="Modelo">
                    <select
                      value={form.cron_mode}
                      onChange={(e) => handleChange("cron_mode", e.target.value as CronMode)}
                      className={select}
                    >
                      <option value="every-x-minutes">A cada X minutos</option>
                      <option value="every-x-hours">A cada X horas</option>
                      <option value="daily-at">Todos os dias em um horário</option>
                      <option value="weekly-at">Dias da semana em um horário</option>
                      <option value="monthly-at">Dia fixo do mês em um horário</option>
                      <option value="custom">Expressão cron manual</option>
                    </select>
                  </Field>

                  {form.cron_mode === "every-x-minutes" ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="A cada quantos minutos">
                        <input
                          value={form.cron_every_minutes}
                          onChange={(e) => handleChange("cron_every_minutes", e.target.value)}
                          className={input}
                          type="number"
                          min={1}
                          max={59}
                        />
                      </Field>
                    </div>
                  ) : null}

                  {form.cron_mode === "every-x-hours" ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <Field label="A cada quantas horas">
                        <input
                          value={form.cron_every_hours}
                          onChange={(e) => handleChange("cron_every_hours", e.target.value)}
                          className={input}
                          type="number"
                          min={1}
                          max={23}
                        />
                      </Field>
                    </div>
                  ) : null}

                  {form.cron_mode === "daily-at" ? timeInputs("cron_daily_hour", "cron_daily_minute") : null}

                  {form.cron_mode === "weekly-at" ? (
                    <div className="space-y-5">
                      <div>
                        <span className={labelClass}>Dias da semana</span>
                        <div className="flex flex-wrap gap-2">
                          {WEEK_DAYS.map((day) => {
                            const selected = form.cron_weekly_days.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleWeeklyDay(day.value)}
                                className={cn(
                                  btn.secondary,
                                  "min-w-[56px] px-3",
                                  selected && "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                                )}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                        {errors.cron_weekly_days ? <p className={fieldError}>{errors.cron_weekly_days}</p> : null}
                      </div>

                      {timeInputs("cron_weekly_hour", "cron_weekly_minute")}
                    </div>
                  ) : null}

                  {form.cron_mode === "monthly-at" ? (
                    <div className="grid gap-5 md:grid-cols-3">
                      <Field label="Dia do mês" hintText="Dias 29 a 31 não existem em todo mês.">
                        <input
                          value={form.cron_monthly_day}
                          onChange={(e) => handleChange("cron_monthly_day", e.target.value)}
                          className={input}
                          type="number"
                          min={1}
                          max={31}
                        />
                      </Field>
                      <Field label="Hora">
                        <input
                          value={form.cron_monthly_hour}
                          onChange={(e) => handleChange("cron_monthly_hour", e.target.value)}
                          className={input}
                          type="number"
                          min={0}
                          max={23}
                        />
                      </Field>
                      <Field label="Minuto">
                        <input
                          value={form.cron_monthly_minute}
                          onChange={(e) => handleChange("cron_monthly_minute", e.target.value)}
                          className={input}
                          type="number"
                          min={0}
                          max={59}
                        />
                      </Field>
                    </div>
                  ) : null}

                  {form.cron_mode === "custom" ? (
                    <Field
                      label="Expressão cron"
                      error={errors.cron_expression}
                      hintText="5 campos: minuto (0-59), hora (0-23), dia do mês (1-31), mês (1-12), dia da semana (0=domingo a 6=sábado). Use * para qualquer, */N para a cada N, 1-5 para intervalo, 1,3 para lista. Ex.: 0 6 * * 1-5 = 06:00 de segunda a sexta."
                    >
                      <input
                        value={form.cron_expression}
                        onChange={(e) => handleChange("cron_expression", e.target.value)}
                        className={cn(input, "font-mono")}
                        placeholder="*/5 * * * *"
                        spellCheck={false}
                      />
                    </Field>
                  ) : null}

                  <Preview label={`Cron: ${cronPreview || "—"}`} tone={cronDescription.ok ? "default" : "danger"}>
                    {cronDescription.text}
                  </Preview>
                </div>
              )}
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Parâmetros do robô</h2>
            </div>

            <div className={cn(cardBody, "space-y-4")}>
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.use_default_runtime_parameters}
                  onChange={(e) => handleChange("use_default_runtime_parameters", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Usar os parâmetros padrão da automação
              </label>

              {form.use_default_runtime_parameters ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Parâmetros da automação</p>
                  <pre className="overflow-x-auto font-mono text-xs text-slate-700">
                    {automationQuery.data?.default_runtime_parameters_json
                      ? JSON.stringify(automationQuery.data.default_runtime_parameters_json, null, 2)
                      : selectedAutomationId > 0
                        ? "Nenhum parâmetro padrão cadastrado na automação."
                        : "Escolha uma automação para ver os parâmetros."}
                  </pre>
                </div>
              ) : (
                <Field label="Parâmetros (JSON)" error={errors.runtime_parameters_json} hintText="Um objeto JSON com os valores que o robô recebe nesta execução.">
                  <textarea
                    value={form.runtime_parameters_json}
                    onChange={(e) => handleChange("runtime_parameters_json", e.target.value)}
                    className={cn(textarea, "min-h-[160px] font-mono")}
                    placeholder='Ex.: { "filial": "001", "safra": "2026" }'
                    spellCheck={false}
                  />
                </Field>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={() => navigate(backTo)} className={btn.secondary} disabled={isPending}>
            Cancelar
          </button>

          <button type="submit" disabled={isPending} className={btn.primary}>
            <Save className="h-4 w-4" />
            {isPending ? "Salvando..." : isEditMode ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, error, hintText, children }: { label: string; error?: string; hintText?: string; children: ReactNode }) {
  return (
    // min-w-0: impede que conteúdo longo (ex.: nome de automação) alargue a coluna do grid.
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <p className={fieldError}>{error}</p> : hintText ? <p className={hint}>{hintText}</p> : null}
    </label>
  );
}

function Preview({ label, tone = "default", children }: { label: string; tone?: "default" | "danger"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3",
        tone === "danger" ? "border-red-200 bg-red-50" : "border-blue-200 bg-blue-50"
      )}
    >
      <p className={cn("font-mono text-xs font-semibold", tone === "danger" ? "text-red-700" : "text-blue-800")}>{label}</p>
      <p className={cn("mt-1 text-sm", tone === "danger" ? "text-red-800" : "text-blue-900")}>{children}</p>
    </div>
  );
}

function TypeOption({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        selected ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
      )}
    >
      <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={cn("mt-0.5 block text-xs", selected ? "text-blue-800/80" : "text-slate-500")}>{description}</span>
      </span>
    </button>
  );
}
