import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Save, Send, X } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { SearchableMultiSelect } from "@/components/common/searchable-multi-select";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { btn, card, cardHeader, cardTitle, fieldError, focusRing, hint, input, label as labelClass, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listAutomations } from "@/services/api/automations";
import { listAllBots } from "@/services/api/bots";
import {
  createEventRule,
  getEventRule,
  listEventTriggers,
  listEventVariables,
  testEventRule,
  updateEventRule,
  type EventHttpMethod,
  type EventRule,
  type EventRulePayload,
  type EventScopeType,
  type EventTrigger,
} from "@/services/api/events";
import type { NotificationTestResult } from "@/services/api/notifications";
import { toast } from "@/store/toast-store";
import { HeadersEditor } from "@/pages/notifications/headers-editor";
import { headersToRows, rowsToHeaders, validateHeaderRows, type HeaderRow } from "@/pages/notifications/header-utils";
import { StepsEditor } from "@/pages/notifications/steps-editor";
import { stepsFromApi, stepsToApi, stepVariableNames, validateSteps, type StepForm } from "@/pages/notifications/step-utils";
import { TestResult } from "@/pages/notifications/test-result";
import { VariableChips } from "@/pages/notifications/variable-chips";
import { SCOPE_LABEL, runToTestResult } from "./event-utils";

const METHODS: EventHttpMethod[] = ["POST", "PUT", "PATCH", "GET"];
const SCOPES: EventScopeType[] = ["automation", "bot", "all"];
const NAME_MAX = 120;

type FormState = {
  name: string;
  description: string;
  active: boolean;
  scope_type: EventScopeType;
  // Alvos da regra (ids de bots ou de automações). Vários de uma vez: a mesma regra para o projeto inteiro.
  scope_ids: number[];
  trigger_type: string;
  trigger_key: string;
  trigger_value: string;
  trigger_code: string;
  pre_steps: StepForm[];
  method: EventHttpMethod;
  url: string;
  headers: HeaderRow[];
  body_template: string;
  timeout_seconds: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const emptyForm: FormState = {
  name: "",
  description: "",
  active: true,
  scope_type: "automation",
  scope_ids: [],
  trigger_type: "task_error",
  trigger_key: "",
  trigger_value: "",
  trigger_code: "",
  pre_steps: [],
  method: "POST",
  url: "",
  headers: [],
  body_template: "",
  timeout_seconds: "15",
};

function ruleToForm(rule: EventRule): FormState {
  const cfg = rule.trigger_config ?? {};
  return {
    name: rule.name ?? "",
    description: rule.description ?? "",
    active: Boolean(rule.active),
    scope_type: rule.scope_type ?? "all",
    scope_ids: rule.scope_ids?.length ? rule.scope_ids : rule.scope_id != null ? [rule.scope_id] : [],
    trigger_type: rule.trigger_type ?? "task_error",
    trigger_key: cfg.key ?? "",
    trigger_value: cfg.value ?? "",
    trigger_code: cfg.code != null ? String(cfg.code) : "",
    pre_steps: stepsFromApi(rule.pre_steps),
    method: rule.method ?? "POST",
    url: rule.url ?? "",
    headers: headersToRows(rule.headers),
    body_template: rule.body_template ?? "",
    timeout_seconds: String(rule.timeout_seconds ?? 15),
  };
}

/** Representação comparável (ignora ids das linhas e linhas vazias). */
function snapshot(f: FormState) {
  return JSON.stringify({ ...f, headers: rowsToHeaders(f.headers), pre_steps: stepsToApi(f.pre_steps) });
}

const isHttpUrl = (v: string) => /^https?:\/\/\S+/i.test(v.trim());

function validate(f: FormState): FormErrors {
  const next: FormErrors = {};
  const name = f.name.trim();
  if (!name) next.name = "Dê um nome ao evento.";
  else if (name.length > NAME_MAX) next.name = `Máximo de ${NAME_MAX} caracteres.`;

  if (f.scope_type !== "all" && f.scope_ids.length === 0)
    next.scope_ids = f.scope_type === "bot" ? "Escolha pelo menos um bot." : "Escolha pelo menos uma automação.";
  if (!f.trigger_type) next.trigger_type = "Escolha o que dispara o evento.";
  if (f.trigger_type === "result_contains" && !f.trigger_key.trim()) next.trigger_key = "Informe a chave do retorno (ex.: status).";
  if (f.trigger_type === "exit_code") {
    const code = Number(f.trigger_code);
    if (f.trigger_code.trim() === "" || !Number.isInteger(code)) next.trigger_code = "Informe o código de saída (inteiro).";
  }

  const stepsError = validateSteps(f.pre_steps);
  if (stepsError) next.pre_steps = stepsError;

  const url = f.url.trim();
  if (!url) next.url = "Informe a URL de destino.";
  else if (!isHttpUrl(url)) next.url = "A URL deve começar com http:// ou https://.";
  const headerError = validateHeaderRows(f.headers);
  if (headerError) next.headers = headerError;
  const timeout = Number(f.timeout_seconds);
  if (!Number.isInteger(timeout) || timeout < 1) next.timeout_seconds = "O timeout deve ser um inteiro maior ou igual a 1.";
  return next;
}

function toPayload(f: FormState): EventRulePayload {
  const trigger_config: EventRulePayload["trigger_config"] = {};
  if (f.trigger_type === "result_contains") {
    trigger_config.key = f.trigger_key.trim();
    trigger_config.value = f.trigger_value.trim() || null;
  } else if (f.trigger_type === "exit_code") {
    trigger_config.code = Number(f.trigger_code);
  }
  return {
    name: f.name.trim(),
    description: f.description.trim() || null,
    active: f.active,
    scope_type: f.scope_type,
    scope_id: f.scope_type === "all" || f.scope_ids.length === 0 ? null : f.scope_ids[0],
    scope_ids: f.scope_type === "all" ? [] : f.scope_ids,
    trigger_type: f.trigger_type,
    trigger_config,
    pre_steps: stepsToApi(f.pre_steps),
    url: f.url.trim(),
    method: f.method,
    headers: rowsToHeaders(f.headers),
    body_template: f.body_template,
    timeout_seconds: Number(f.timeout_seconds),
  };
}

export function EventFormPage() {
  const params = useParams<{ id?: string }>();
  const ruleId = params.id ? Number(params.id) : null;
  const isEdit = ruleId !== null && Number.isFinite(ruleId) && ruleId > 0;
  const invalidId = params.id !== undefined && !isEdit;

  const ruleQuery = useQuery({
    queryKey: ["event-rule", ruleId],
    queryFn: () => getEventRule(ruleId as number),
    enabled: isEdit,
  });

  const title = isEdit ? "Editar evento" : "Novo evento";

  if (invalidId) {
    return (
      <section className={card}>
        <PageHeader title="Evento" backTo="/events" backLabel="Voltar para eventos" />
        <div className="p-5">
          <QueryError error={new Error("ID de evento inválido.")} what="o evento" />
        </div>
      </section>
    );
  }

  if (isEdit && ruleQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo="/events" backLabel="Voltar para eventos" />
        <div className="p-5">
          <DetailSkeleton fields={8} />
        </div>
      </section>
    );
  }

  if (isEdit && (ruleQuery.isError || !ruleQuery.data)) {
    return (
      <section className={card}>
        <PageHeader title={title} backTo="/events" backLabel="Voltar para eventos" />
        <div className="p-5">
          <QueryError error={ruleQuery.error} what="o evento" onRetry={() => ruleQuery.refetch()} retrying={ruleQuery.isFetching} />
        </div>
      </section>
    );
  }

  // O formulário só nasce com os dados em mãos: nada de re-hidratar por efeito depois.
  const initial = isEdit && ruleQuery.data ? ruleToForm(ruleQuery.data) : emptyForm;
  return <EventForm key={isEdit ? `edit-${ruleId}` : "new"} initial={initial} ruleId={isEdit ? (ruleId as number) : null} title={title} />;
}

type EventFormProps = { initial: FormState; ruleId: number | null; title: string };

function EventForm({ initial, ruleId, title }: EventFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = ruleId !== null;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState(() => snapshot(initial));
  const [testResult, setTestResult] = useState<{ result: NotificationTestResult; taskId: number | null } | null>(null);

  const triggersQuery = useQuery({ queryKey: ["event-triggers"], queryFn: listEventTriggers, staleTime: 5 * 60_000 });
  const variablesQuery = useQuery({ queryKey: ["event-variables"], queryFn: listEventVariables, staleTime: 5 * 60_000 });
  const automationsQuery = useQuery({
    queryKey: ["automations-options", { active: true }],
    queryFn: () => listAutomations({ active: true }),
    enabled: form.scope_type === "automation",
    staleTime: 60_000,
  });
  const botsQuery = useQuery({
    queryKey: ["bots-all-options"],
    queryFn: () => listAllBots(),
    enabled: form.scope_type === "bot",
    staleTime: 60_000,
  });

  const dirty = snapshot(form) !== saved;
  const stepVariables = useMemo(() => stepVariableNames(form.pre_steps), [form.pre_steps]);
  const triggers: EventTrigger[] = triggersQuery.data ?? [];
  const currentTrigger = triggers.find((t) => t.type === form.trigger_type);

  const automationOptions = useMemo(
    () =>
      (automationsQuery.data ?? []).map((a) => ({
        value: a.id,
        label: a.label || a.name,
        description: a.repository_name ?? null,
      })),
    [automationsQuery.data]
  );
  const botOptions = useMemo(
    () => (botsQuery.data?.items ?? []).map((b) => ({ value: b.id, label: b.name, description: b.repository_name ?? null })),
    [botsQuery.data]
  );

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: ["event-rules"] });
    if (isEdit) queryClient.invalidateQueries({ queryKey: ["event-rule", ruleId] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: EventRulePayload) => createEventRule(payload),
    onSuccess: () => {
      invalidateLists();
      toast.success("Evento criado.");
      navigate("/events");
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível criar o evento.", error)),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: EventRulePayload) => updateEventRule(ruleId as number, payload),
    onSuccess: () => {
      invalidateLists();
      setSaved(snapshot(form));
      toast.success("Evento atualizado.");
      navigate("/events");
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível atualizar o evento.", error)),
  });

  const testMutation = useMutation({
    mutationFn: () => testEventRule(ruleId as number),
    onSuccess: (run) => {
      setTestResult({ result: runToTestResult(run), taskId: run.task_id });
      queryClient.invalidateQueries({ queryKey: ["event-runs"] });
      queryClient.invalidateQueries({ queryKey: ["event-rules"] });
      if (run.ok) toast.success("Teste enviado com sucesso.");
      else toast.error("O teste falhou. Veja os detalhes abaixo.");
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível testar o evento.", error)),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function setScope(scope: EventScopeType) {
    setForm((prev) => ({ ...prev, scope_type: scope, scope_ids: scope === prev.scope_type ? prev.scope_ids : [] }));
    setErrors((prev) => ({ ...prev, scope_ids: undefined }));
  }

  function insertVariable(token: string) {
    const el = bodyRef.current;
    const current = form.body_template;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    setField("body_template", current.slice(0, start) + token + current.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    const payload = toPayload(form);
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (!isSubmitting) e.currentTarget.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} noValidate>
      <section className={card}>
        <PageHeader
          title={title}
          description="Quando acontece o que está em “Quando”, o orquestrador executa o que está em “Então”."
          backTo="/events"
          backLabel="Voltar para eventos"
        />

        <div className="space-y-6 px-5 py-5">
          {/* Evento */}
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Evento</h2>
            </div>
            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <div>
                <label htmlFor="ev-name" className={labelClass}>
                  Nome
                </label>
                <input
                  id="ev-name"
                  className={input}
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Ex.: Avisar o time no Teams quando o faturamento falhar"
                  maxLength={NAME_MAX}
                />
                {errors.name && <p className={fieldError}>{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="ev-description" className={labelClass}>
                  Descrição (opcional)
                </label>
                <input
                  id="ev-description"
                  className={input}
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  placeholder="Para quem vai ler a lista depois"
                />
              </div>
              <CheckboxField
                className="md:col-span-2"
                checked={form.active}
                onChange={(value) => setField("active", value)}
                label="Evento ativo"
                description="Desativado, o evento fica guardado mas não dispara."
              />
            </div>
          </section>

          {/* Quando */}
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Quando</h2>
            </div>
            <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <span className={labelClass}>Vale para</span>
                <div role="radiogroup" aria-label="Escopo do evento" className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {SCOPES.map((scope) => {
                    const active = form.scope_type === scope;
                    return (
                      <button
                        key={scope}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setScope(scope)}
                        className={cn(
                          "h-8 rounded-lg px-3 text-sm font-medium transition",
                          focusRing,
                          active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        {SCOPE_LABEL[scope]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.scope_type === "automation" && (
                <div className="md:col-span-2">
                  <span className={labelClass}>Automações</span>
                  <SearchableMultiSelect<number>
                    label="Escolha as automações"
                    selectedValues={form.scope_ids}
                    onChange={(values) => setField("scope_ids", values)}
                    options={automationOptions}
                    searchPlaceholder="Buscar automação..."
                    emptyText={automationsQuery.isError ? "Não foi possível carregar as automações." : automationsQuery.isLoading ? "Carregando..." : "Nenhuma automação ativa."}
                    className="w-full"
                  />
                  <ScopeChips options={automationOptions} selected={form.scope_ids} onRemove={(id) => setField("scope_ids", form.scope_ids.filter((v) => v !== id))} />
                  <p className={hint}>Pode marcar mais de uma: a mesma regra vale para todas.</p>
                  {errors.scope_ids && <p className={fieldError}>{errors.scope_ids}</p>}
                </div>
              )}

              {form.scope_type === "bot" && (
                <div className="md:col-span-2">
                  <span className={labelClass}>Bots</span>
                  <SearchableMultiSelect<number>
                    label="Escolha os bots"
                    selectedValues={form.scope_ids}
                    onChange={(values) => setField("scope_ids", values)}
                    options={botOptions}
                    searchPlaceholder="Buscar bot..."
                    emptyText={botsQuery.isError ? "Não foi possível carregar os bots." : botsQuery.isLoading ? "Carregando..." : "Nenhum bot cadastrado."}
                    className="w-full"
                  />
                  <ScopeChips options={botOptions} selected={form.scope_ids} onRemove={(id) => setField("scope_ids", form.scope_ids.filter((v) => v !== id))} />
                  <p className={hint}>Pode marcar mais de um (ex.: os 4 bots do projeto Insumos). Vale para todas as automações desses bots.</p>
                  {errors.scope_ids && <p className={fieldError}>{errors.scope_ids}</p>}
                </div>
              )}

              <div className="md:col-span-2">
                <label htmlFor="ev-trigger" className={labelClass}>
                  O que dispara
                </label>
                <select
                  id="ev-trigger"
                  className={select}
                  value={form.trigger_type}
                  onChange={(e) => setField("trigger_type", e.target.value)}
                  disabled={triggersQuery.isLoading}
                >
                  {triggersQuery.isLoading && <option value={form.trigger_type}>Carregando...</option>}
                  {!triggersQuery.isLoading && !triggers.some((t) => t.type === form.trigger_type) && form.trigger_type && (
                    <option value={form.trigger_type}>{form.trigger_type}</option>
                  )}
                  {triggers.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {triggersQuery.isError ? (
                  <p className={fieldError}>Não foi possível carregar a lista de gatilhos.</p>
                ) : currentTrigger?.description ? (
                  <p className={hint}>{currentTrigger.description}</p>
                ) : null}
                {errors.trigger_type && <p className={fieldError}>{errors.trigger_type}</p>}
              </div>

              {form.trigger_type === "result_contains" && (
                <>
                  <div>
                    <label htmlFor="ev-trigger-key" className={labelClass}>
                      Chave do retorno
                    </label>
                    <input
                      id="ev-trigger-key"
                      className={cn(input, "font-mono")}
                      value={form.trigger_key}
                      onChange={(e) => setField("trigger_key", e.target.value)}
                      placeholder="ex.: status"
                    />
                    <p className={hint}>Campo do JSON que o robô devolve ao terminar.</p>
                    {errors.trigger_key && <p className={fieldError}>{errors.trigger_key}</p>}
                  </div>
                  <div>
                    <label htmlFor="ev-trigger-value" className={labelClass}>
                      Valor esperado (opcional)
                    </label>
                    <input
                      id="ev-trigger-value"
                      className={cn(input, "font-mono")}
                      value={form.trigger_value}
                      onChange={(e) => setField("trigger_value", e.target.value)}
                      placeholder="ex.: pendente"
                    />
                    <p className={hint}>Vazio: dispara sempre que a chave existir no retorno.</p>
                  </div>
                </>
              )}

              {form.trigger_type === "exit_code" && (
                <div>
                  <label htmlFor="ev-trigger-code" className={labelClass}>
                    Código de saída
                  </label>
                  <input
                    id="ev-trigger-code"
                    className={input}
                    type="number"
                    step={1}
                    value={form.trigger_code}
                    onChange={(e) => setField("trigger_code", e.target.value)}
                    placeholder="ex.: 3"
                  />
                  <p className={hint}>Dispara quando o processo do robô termina com este código.</p>
                  {errors.trigger_code && <p className={fieldError}>{errors.trigger_code}</p>}
                </div>
              )}
            </div>
          </section>

          {/* Então · etapas */}
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Então · etapas antes do envio (opcional)</h2>
            </div>
            <div className="px-5 py-5">
              <StepsEditor steps={form.pre_steps} onChange={(steps) => setField("pre_steps", steps)} />
              {errors.pre_steps && <p className={fieldError}>{errors.pre_steps}</p>}
            </div>
          </section>

          {/* Então · envio principal */}
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Então · envio principal</h2>
            </div>
            <div className="grid gap-5 px-5 py-5 md:grid-cols-[160px_1fr]">
              <div>
                <label htmlFor="ev-method" className={labelClass}>
                  Método
                </label>
                <select id="ev-method" className={select} value={form.method} onChange={(e) => setField("method", e.target.value as EventHttpMethod)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ev-url" className={labelClass}>
                  URL de destino
                </label>
                <input
                  id="ev-url"
                  className={input}
                  value={form.url}
                  onChange={(e) => setField("url", e.target.value)}
                  placeholder="https://exemplo.webhook.office.com/webhookb2/..."
                  inputMode="url"
                />
                <p className={hint}>Aceita variáveis, ex.: https://api.exemplo.com/chamados/{"{{task_id}}"}.</p>
                {errors.url && <p className={fieldError}>{errors.url}</p>}
              </div>

              <div className="md:col-span-2">
                <span className={labelClass}>Cabeçalhos</span>
                <HeadersEditor rows={form.headers} onChange={(rows) => setField("headers", rows)} />
                {errors.headers && <p className={fieldError}>{errors.headers}</p>}
              </div>

              <div className="md:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Variáveis disponíveis (clique para inserir)</span>
                <VariableChips
                  variables={variablesQuery.data ?? []}
                  stepVariables={stepVariables}
                  loading={variablesQuery.isLoading}
                  error={variablesQuery.isError}
                  onInsert={insertVariable}
                />
                <label htmlFor="ev-body" className={cn(labelClass, "mt-4")}>
                  Corpo da requisição
                </label>
                <textarea
                  id="ev-body"
                  ref={bodyRef}
                  value={form.body_template}
                  onChange={(e) => setField("body_template", e.target.value)}
                  spellCheck={false}
                  className={cn(textarea, "min-h-[240px] font-mono")}
                  placeholder={'{\n  "text": "{{automacao}} terminou com erro: {{erro}}"\n}'}
                />
                <p className={hint}>Em JSON, os valores das variáveis são escapados automaticamente: escreva "descricao": "{"{{erro}}"}".</p>
              </div>

              <div>
                <label htmlFor="ev-timeout" className={labelClass}>
                  Timeout (segundos)
                </label>
                <input
                  id="ev-timeout"
                  className={input}
                  type="number"
                  min={1}
                  step={1}
                  value={form.timeout_seconds}
                  onChange={(e) => setField("timeout_seconds", e.target.value)}
                />
                {errors.timeout_seconds && <p className={fieldError}>{errors.timeout_seconds}</p>}
              </div>
            </div>
          </section>

          {testResult && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                {testResult.taskId != null ? `Testado com a task #${testResult.taskId}.` : "Testado com dados de exemplo."}
              </p>
              <TestResult result={testResult.result} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {isEdit
              ? dirty
                ? "Há alterações não salvas. O teste usa a versão salva do evento."
                : "O teste faz a requisição de verdade, usando a última task do escopo (ou dados de exemplo)."
              : "Salve o evento para poder testá-lo."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => navigate("/events")} className={btn.secondary} disabled={isSubmitting}>
              Cancelar
            </button>
            {isEdit && (
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={dirty || testMutation.isPending || isSubmitting}
                title={dirty ? "Salve as alterações para testar" : undefined}
                className={btn.secondary}
              >
                <Send className="h-4 w-4" />
                {testMutation.isPending ? "Enviando..." : "Testar agora"}
              </button>
            )}
            <button type="submit" disabled={isSubmitting} title="Ctrl+S" className={btn.primary}>
              <Save className="h-4 w-4" />
              {isSubmitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </section>
    </form>
  );
}

/** Alvos escolhidos, em chips com X: dá para ver a lista inteira sem abrir o seletor. */
function ScopeChips({
  options,
  selected,
  onRemove,
}: {
  options: { value: number; label: string; description?: string | null }[];
  selected: number[];
  onRemove: (id: number) => void;
}) {
  if (selected.length === 0) return null;
  const byId = new Map(options.map((o) => [o.value, o]));
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {selected.map((id) => {
        const option = byId.get(id);
        return (
          <span key={id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-blue-800">
            {option?.label ?? `#${id}`}
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-blue-700 hover:bg-blue-200"
              aria-label={`Tirar ${option?.label ?? id}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}
    </div>
  );
}

function CheckboxField({
  checked,
  onChange,
  label: text,
  description,
  className,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <span>
        <span className="block font-medium text-slate-900">{text}</span>
        {description ? <span className="block text-xs text-slate-500">{description}</span> : null}
      </span>
    </label>
  );
}
