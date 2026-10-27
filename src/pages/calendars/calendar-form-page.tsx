import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarCheck, Download, Plus, Save, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label as labelClass, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  checkCalendar,
  createCalendar,
  getCalendar,
  importHolidays,
  updateCalendar,
  type CalendarBlackout,
  type CalendarPayload,
  type CalendarRead,
} from "@/services/api/calendars";
import { toast } from "@/store/toast-store";

import {
  DEFAULT_WEEKDAYS,
  WEEKDAYS,
  describeWeekdays,
  fixedHolidaysOfYear,
  formatHoliday,
  isValidIsoDate,
  isValidTime,
  sortUniqueDates,
} from "./calendar-utils";

// Cada janela ganha uma chave local só para o React (não vai para a API).
type BlackoutRow = CalendarBlackout & { key: string };

type FormState = {
  name: string;
  description: string;
  active: boolean;
  weekdays: number[];
  holidays: string[];
  blackouts: BlackoutRow[];
};

type FormErrors = {
  name?: string;
  weekdays?: string;
  holidays?: string;
  blackouts?: Record<string, string>;
};

let rowSeq = 0;
function nextKey() {
  rowSeq += 1;
  return `row-${rowSeq}`;
}

const initialFormState: FormState = {
  name: "",
  description: "",
  active: true,
  weekdays: DEFAULT_WEEKDAYS,
  holidays: [],
  blackouts: [],
};

function calendarToForm(calendar: CalendarRead): FormState {
  return {
    name: calendar.name ?? "",
    description: calendar.description ?? "",
    active: Boolean(calendar.active),
    weekdays: [...(calendar.weekdays ?? [])].sort((a, b) => a - b),
    holidays: sortUniqueDates(calendar.holidays ?? []),
    blackouts: (calendar.blackouts ?? []).map((b) => ({ ...b, weekdays: [...(b.weekdays ?? [])], key: nextKey() })),
  };
}

export function CalendarFormPage() {
  const params = useParams<{ calendarId: string }>();
  const calendarId = Number(params.calendarId);
  const isEditMode = Number.isFinite(calendarId) && calendarId > 0;

  const calendarQuery = useQuery({
    queryKey: ["calendar-edit", calendarId],
    queryFn: () => getCalendar(calendarId),
    enabled: isEditMode,
  });

  const title = isEditMode ? "Editar calendário" : "Novo calendário";

  if (isEditMode && calendarQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo="/calendars" backLabel="Voltar para calendários" />
        <div className="p-5">
          <DetailSkeleton fields={6} />
        </div>
      </section>
    );
  }

  if (isEditMode && (calendarQuery.isError || !calendarQuery.data)) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo="/calendars" backLabel="Voltar para calendários" />
        <div className="p-5">
          <QueryError
            error={calendarQuery.error}
            what="o calendário"
            onRetry={() => calendarQuery.refetch()}
            retrying={calendarQuery.isFetching}
          />
        </div>
      </section>
    );
  }

  // O formulário só nasce quando os dados chegaram: nada de re-hidratar por efeito depois.
  const initial = isEditMode && calendarQuery.data ? calendarToForm(calendarQuery.data) : initialFormState;

  return (
    <CalendarForm
      key={isEditMode ? `edit-${calendarId}` : "new"}
      initial={initial}
      calendarId={isEditMode ? calendarId : null}
      title={title}
    />
  );
}

type CalendarFormProps = {
  initial: FormState;
  calendarId: number | null;
  title: string;
};

function CalendarForm({ initial, calendarId, title }: CalendarFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = calendarId !== null;

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [newHoliday, setNewHoliday] = useState("");
  const [newHolidayError, setNewHolidayError] = useState<string | null>(null);
  const [importYear, setImportYear] = useState(String(currentYear));
  const [importedLocally, setImportedLocally] = useState<number[]>([]);
  const [checkAt, setCheckAt] = useState("");

  async function invalidateLists() {
    await queryClient.invalidateQueries({ queryKey: ["calendars"] });
    await queryClient.invalidateQueries({ queryKey: ["calendars-options"] });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CalendarPayload) => createCalendar(payload),
    onSuccess: async () => {
      toast.success("Calendário cadastrado.");
      await invalidateLists();
      navigate("/calendars");
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível cadastrar o calendário.", error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CalendarPayload) => updateCalendar(calendarId as number, payload),
    onSuccess: async () => {
      toast.success("Calendário atualizado.");
      await invalidateLists();
      await queryClient.invalidateQueries({ queryKey: ["calendar-edit", calendarId] });
      navigate("/calendars");
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível atualizar o calendário.", error));
    },
  });

  const importMutation = useMutation({
    mutationFn: (year: number) => importHolidays(calendarId as number, year),
    onSuccess: async (calendar, year) => {
      // Junta com o que está na tela: não perde datas adicionadas e ainda não salvas.
      setForm((prev) => ({ ...prev, holidays: sortUniqueDates([...prev.holidays, ...calendar.holidays]) }));
      toast.success(`Feriados nacionais de ${year} importados.`);
      await queryClient.invalidateQueries({ queryKey: ["calendar-edit", calendarId] });
      await invalidateLists();
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível importar os feriados.", error));
    },
  });

  const checkMutation = useMutation({
    mutationFn: (atIso: string) => checkCalendar(calendarId as number, atIso),
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível testar a data.", error));
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleChange<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "name" || field === "weekdays" || field === "holidays") {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function toggleWeekday(day: number) {
    const exists = form.weekdays.includes(day);
    handleChange(
      "weekdays",
      exists ? form.weekdays.filter((d) => d !== day) : [...form.weekdays, day].sort((a, b) => a - b)
    );
  }

  function addHoliday() {
    const value = newHoliday.trim();
    if (!isValidIsoDate(value)) {
      setNewHolidayError("Escolha uma data válida.");
      return;
    }
    if (form.holidays.includes(value)) {
      setNewHolidayError("Essa data já está na lista.");
      return;
    }
    handleChange("holidays", sortUniqueDates([...form.holidays, value]));
    setNewHoliday("");
    setNewHolidayError(null);
  }

  function removeHoliday(value: string) {
    handleChange(
      "holidays",
      form.holidays.filter((d) => d !== value)
    );
  }

  function handleImport() {
    const year = Number(importYear);
    if (isEditMode) {
      importMutation.mutate(year);
      return;
    }
    // Sem id ainda: adiciona os de data fixa na hora; os móveis vêm do servidor depois de salvar.
    handleChange("holidays", sortUniqueDates([...form.holidays, ...fixedHolidaysOfYear(year)]));
    setImportedLocally((prev) => (prev.includes(year) ? prev : [...prev, year]));
  }

  function addBlackout() {
    setForm((prev) => ({
      ...prev,
      blackouts: [...prev.blackouts, { key: nextKey(), label: "", start: "12:00", end: "13:00", weekdays: [] }],
    }));
  }

  function updateBlackout(key: string, patch: Partial<CalendarBlackout>) {
    setForm((prev) => ({
      ...prev,
      blackouts: prev.blackouts.map((b) => (b.key === key ? { ...b, ...patch } : b)),
    }));
    if (errors.blackouts?.[key]) {
      setErrors((prev) => {
        const next = { ...(prev.blackouts ?? {}) };
        delete next[key];
        return { ...prev, blackouts: next };
      });
    }
  }

  function removeBlackout(key: string) {
    setForm((prev) => ({ ...prev, blackouts: prev.blackouts.filter((b) => b.key !== key) }));
  }

  function toggleBlackoutWeekday(row: BlackoutRow, day: number) {
    const exists = row.weekdays.includes(day);
    updateBlackout(row.key, {
      weekdays: exists ? row.weekdays.filter((d) => d !== day) : [...row.weekdays, day].sort((a, b) => a - b),
    });
  }

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!form.name.trim()) next.name = "Informe um nome para o calendário.";
    if (form.weekdays.length === 0) next.weekdays = "Escolha pelo menos um dia útil.";

    const invalidHoliday = form.holidays.find((d) => !isValidIsoDate(d));
    if (invalidHoliday) next.holidays = `A data "${invalidHoliday}" não é válida.`;

    const blackoutErrors: Record<string, string> = {};
    for (const row of form.blackouts) {
      if (!isValidTime(row.start) || !isValidTime(row.end)) {
        blackoutErrors[row.key] = "Informe o início e o fim da janela (HH:MM).";
      } else if (row.start >= row.end) {
        blackoutErrors[row.key] = "O início precisa ser antes do fim.";
      }
    }
    if (Object.keys(blackoutErrors).length > 0) next.blackouts = blackoutErrors;

    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending) return;

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const payload: CalendarPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      weekdays: [...form.weekdays].sort((a, b) => a - b),
      holidays: sortUniqueDates(form.holidays),
      blackouts: form.blackouts.map(({ label, start, end, weekdays }) => ({
        label: label.trim(),
        start,
        end,
        weekdays: [...weekdays].sort((a, b) => a - b),
      })),
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

  function handleCheck() {
    if (!checkAt) return;
    // datetime-local é hora local; o Date converte para ISO (UTC) que a API entende.
    const date = new Date(checkAt);
    if (Number.isNaN(date.getTime())) return;
    checkMutation.mutate(date.toISOString());
  }

  const checkboxClass = "h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500";
  const importBusy = importMutation.isPending;

  return (
    <section className={card}>
      <PageHeader
        title={title}
        description="Defina os dias úteis, os feriados e as janelas de horário em que os robôs não devem rodar."
        backTo="/calendars"
        backLabel="Voltar para calendários"
      />

      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
        <div className="space-y-5 p-5">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Calendário</h2>
            </div>

            <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
              <Field label="Nome" error={errors.name}>
                <input
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={input}
                  placeholder="Ex.: Dias úteis Brasil"
                  autoFocus={!isEditMode}
                />
              </Field>

              <div className="flex items-end pb-1">
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-slate-700">
                  <input
                    checked={form.active}
                    onChange={(e) => handleChange("active", e.target.checked)}
                    type="checkbox"
                    className={checkboxClass}
                  />
                  Calendário ativo
                </label>
              </div>

              <div className="md:col-span-2">
                <Field label="Descrição" hintText="Opcional. Para quem for escolher o calendário no agendamento.">
                  <textarea
                    value={form.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    className={cn(textarea, "min-h-[80px]")}
                    placeholder="Ex.: Segunda a sexta, sem feriados nacionais e sem a janela do fechamento contábil."
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Dias úteis</h2>
              <span className="text-xs text-slate-500">Os robôs só rodam nestes dias da semana.</span>
            </div>

            <div className={cardBody}>
              <div className="flex flex-wrap gap-x-5 gap-y-3">
                {WEEKDAYS.map((day) => (
                  <label key={day.value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.weekdays.includes(day.value)}
                      onChange={() => toggleWeekday(day.value)}
                      className={checkboxClass}
                    />
                    {capitalize(day.long)}
                  </label>
                ))}
              </div>
              {errors.weekdays ? (
                <p className={fieldError}>{errors.weekdays}</p>
              ) : (
                <p className={hint}>Resumo: {describeWeekdays(form.weekdays)}.</p>
              )}
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Feriados</h2>
              <span className="text-xs text-slate-500">
                {form.holidays.length === 0
                  ? "Nenhum feriado"
                  : `${form.holidays.length} data${form.holidays.length === 1 ? "" : "s"}`}
              </span>
            </div>

            <div className={cn(cardBody, "space-y-5")}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Field label="Adicionar data" error={newHolidayError ?? undefined} className="md:w-56">
                  <input
                    type="date"
                    value={newHoliday}
                    onChange={(e) => {
                      setNewHoliday(e.target.value);
                      setNewHolidayError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addHoliday();
                      }
                    }}
                    className={input}
                  />
                </Field>
                <button type="button" onClick={addHoliday} className={cn(btn.secondary, newHolidayError && "mb-5")}>
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                  <select
                    value={importYear}
                    onChange={(e) => setImportYear(e.target.value)}
                    className={cn(select, "w-28")}
                    aria-label="Ano dos feriados"
                  >
                    {[currentYear, currentYear + 1].map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={handleImport} disabled={importBusy} className={btn.secondary}>
                    <Download className="h-4 w-4" />
                    {importBusy ? "Importando..." : `Importar feriados nacionais de ${importYear}`}
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  {isEditMode
                    ? "Adiciona os feriados nacionais do ano (fixos e móveis) e mantém os que já estão na lista."
                    : "Adiciona agora os feriados de data fixa. Os móveis (Carnaval, Sexta-feira Santa, Corpus Christi) entram ao salvar, pela importação do servidor."}
                </p>
              </div>

              {importedLocally.length > 0 && !isEditMode ? (
                <p className={cn(hint, "mt-0")}>
                  Feriados fixos de {importedLocally.join(" e ")} adicionados. Depois de salvar, abra o calendário e importe de novo para
                  trazer os feriados móveis.
                </p>
              ) : null}

              {errors.holidays ? <p className={fieldError}>{errors.holidays}</p> : null}

              {form.holidays.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma data na lista. Adicione uma data ou importe os feriados nacionais.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {form.holidays.map((date) => (
                    <li
                      key={date}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <span className={cn(!isValidIsoDate(date) && "text-red-700")}>{formatHoliday(date)}</span>
                      <button
                        type="button"
                        onClick={() => removeHoliday(date)}
                        className={cn(btn.icon, "h-7 w-7 border-0 text-slate-400 hover:text-red-700")}
                        aria-label={`Remover ${formatHoliday(date)}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Janelas proibidas</h2>
              <span className="text-xs text-slate-500">Faixas de horário em que os robôs não rodam (ex.: fechamento das 12h às 13h).</span>
            </div>

            <div className={cn(cardBody, "space-y-4")}>
              {form.blackouts.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma janela. Sem janelas, o calendário só considera dias úteis e feriados.</p>
              ) : (
                <div className="space-y-3">
                  {form.blackouts.map((row) => {
                    const rowError = errors.blackouts?.[row.key];
                    return (
                      <div key={row.key} className={cn("rounded-lg border px-4 py-3", rowError ? "border-red-200 bg-red-50/40" : "border-slate-200")}>
                        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
                          <Field label="Rótulo">
                            <input
                              value={row.label}
                              onChange={(e) => updateBlackout(row.key, { label: e.target.value })}
                              className={input}
                              placeholder="Ex.: Fechamento contábil"
                            />
                          </Field>
                          <Field label="Início" className="md:w-32">
                            <input
                              type="time"
                              value={row.start}
                              onChange={(e) => updateBlackout(row.key, { start: e.target.value })}
                              className={input}
                            />
                          </Field>
                          <Field label="Fim" className="md:w-32">
                            <input
                              type="time"
                              value={row.end}
                              onChange={(e) => updateBlackout(row.key, { end: e.target.value })}
                              className={input}
                            />
                          </Field>
                          <button
                            type="button"
                            onClick={() => removeBlackout(row.key)}
                            className={cn(btn.icon, "mb-0.5")}
                            aria-label="Remover janela"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3">
                          <span className={labelClass}>Dias da semana</span>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAYS.map((day) => {
                              const selected = row.weekdays.includes(day.value);
                              return (
                                <button
                                  key={day.value}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => toggleBlackoutWeekday(row, day.value)}
                                  className={cn(
                                    btn.secondary,
                                    btn.sm,
                                    "min-w-[52px]",
                                    selected && "border-blue-600 bg-blue-600 text-white hover:bg-blue-700"
                                  )}
                                >
                                  {capitalize(day.short)}
                                </button>
                              );
                            })}
                          </div>
                          <p className={hint}>
                            {row.weekdays.length === 0
                              ? "Nenhum dia marcado = vale todos os dias."
                              : `Vale em: ${describeWeekdays(row.weekdays)}.`}
                          </p>
                        </div>

                        {rowError ? <p className={fieldError}>{rowError}</p> : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <button type="button" onClick={addBlackout} className={btn.secondary}>
                <Plus className="h-4 w-4" />
                Adicionar janela
              </button>
            </div>
          </section>

          {isEditMode ? (
            <section className={card}>
              <div className={cardHeader}>
                <h2 className={cardTitle}>Testar uma data</h2>
                <span className="text-xs text-slate-500">Usa o calendário salvo no servidor, não as alterações ainda não salvas.</span>
              </div>

              <div className={cn(cardBody, "space-y-3")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <Field label="Data e hora" className="md:w-64">
                    <input type="datetime-local" value={checkAt} onChange={(e) => setCheckAt(e.target.value)} className={input} />
                  </Field>
                  <button
                    type="button"
                    onClick={handleCheck}
                    disabled={!checkAt || checkMutation.isPending}
                    className={btn.secondary}
                  >
                    <CalendarCheck className="h-4 w-4" />
                    {checkMutation.isPending ? "Testando..." : "Testar"}
                  </button>
                </div>

                {checkMutation.data ? (
                  <div
                    className={cn(
                      "rounded-lg border px-4 py-3 text-sm",
                      checkMutation.data.allowed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
                    )}
                  >
                    <p className="font-medium">
                      {checkMutation.data.allowed ? "Permitido: o robô pode rodar neste horário." : "Não permitido neste horário."}
                    </p>
                    {checkMutation.data.reason ? <p className="mt-0.5">{checkMutation.data.reason}</p> : null}
                    {!checkMutation.data.allowed && checkMutation.data.next_allowed_at ? (
                      <p className="mt-0.5">Próximo horário permitido: {formatDateTime(checkMutation.data.next_allowed_at)}.</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" onClick={() => navigate("/calendars")} className={btn.secondary} disabled={isPending}>
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Field({
  label,
  error,
  hintText,
  className,
  children,
}: {
  label: string;
  error?: string;
  hintText?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {error ? <p className={fieldError}>{error}</p> : hintText ? <p className={hint}>{hintText}</p> : null}
    </label>
  );
}
