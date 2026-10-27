import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Send } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { toast } from "@/store/toast-store";
import { badge, btn, card, cardBody, cardHeader, cardTitle, fieldError, hint, input, label, select, textarea, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  getNotificationChannel,
  listNotificationVariables,
  testNotificationChannel,
  updateNotificationChannel,
  type HttpMethod,
  type NotificationChannel,
  type NotificationTestResult,
  type UpdateNotificationChannelPayload,
} from "@/services/api/notifications";
import { HeadersEditor } from "./headers-editor";
import { headersToRows, rowsToHeaders, validateHeaderRows, type HeaderRow } from "./header-utils";
import { VariableChips } from "./variable-chips";
import { StepsEditor } from "./steps-editor";
import { stepsFromApi, stepsToApi, stepVariableNames, validateSteps, type StepForm } from "./step-utils";
import { TestResult } from "./test-result";
import { NotificationLogsCard } from "./notification-logs-card";

type FormState = {
  enabled: boolean;
  name: string;
  url: string;
  method: HttpMethod;
  headers: HeaderRow[];
  pre_steps: StepForm[];
  body_template: string;
  failure_threshold: string;
  pause_schedule: boolean;
  deactivate_automation: boolean;
  timeout_seconds: string;
  panel_base_url: string;
};

function toForm(c: NotificationChannel): FormState {
  return {
    enabled: Boolean(c.enabled),
    name: c.name ?? "",
    url: c.url ?? "",
    method: c.method ?? "POST",
    headers: headersToRows(c.headers),
    pre_steps: stepsFromApi(c.pre_steps),
    body_template: c.body_template ?? "",
    failure_threshold: String(c.failure_threshold ?? 3),
    pause_schedule: Boolean(c.pause_schedule),
    deactivate_automation: Boolean(c.deactivate_automation),
    timeout_seconds: String(c.timeout_seconds ?? 15),
    panel_base_url: c.panel_base_url ?? "",
  };
}

/** Representação comparável (ignora ids das linhas e linhas vazias). */
function snapshot(f: FormState) {
  return JSON.stringify({
    ...f,
    headers: rowsToHeaders(f.headers),
    pre_steps: stepsToApi(f.pre_steps),
  });
}

const isHttpUrl = (v: string) => /^https?:\/\/\S+/i.test(v.trim());

function validate(f: FormState): string | null {
  const url = f.url.trim();
  if (f.enabled && !url) return "Informe a URL de destino para ativar as notificações.";
  if (url && !isHttpUrl(url)) return "A URL de destino deve começar com http:// ou https://.";
  const panel = f.panel_base_url.trim();
  if (panel && !isHttpUrl(panel)) return "A URL base do painel deve começar com http:// ou https://.";
  const headerError = validateHeaderRows(f.headers);
  if (headerError) return headerError;
  const stepsError = validateSteps(f.pre_steps);
  if (stepsError) return stepsError;
  const threshold = Number(f.failure_threshold);
  if (!Number.isInteger(threshold) || threshold < 1) return "Falhas seguidas para notificar deve ser um inteiro maior ou igual a 1.";
  const timeout = Number(f.timeout_seconds);
  if (!Number.isInteger(timeout) || timeout < 1) return "O timeout deve ser um inteiro maior ou igual a 1.";
  return null;
}

export function NotificationsPage() {
  const channelQuery = useQuery({
    queryKey: ["notification-channel"],
    queryFn: getNotificationChannel,
  });

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Chamado de erro"
          description="Quando um agendamento falha várias vezes seguidas, o sistema envia uma requisição HTTP configurável (ex.: abrir chamado no desk) e pode pausar o agendamento."
          meta={
            channelQuery.data ? (
              <span className={cn(badge, channelQuery.data.enabled ? tone.success : tone.neutral)}>
                {channelQuery.data.enabled ? "Ativadas" : "Desativadas"}
              </span>
            ) : null
          }
        />

        {channelQuery.isLoading ? (
          <div className={cardBody}>
            <DetailSkeleton fields={6} />
          </div>
        ) : channelQuery.isError || !channelQuery.data ? (
          <div className={cardBody}>
            <QueryError
              error={channelQuery.error}
              what="a configuração de notificações"
              onRetry={() => channelQuery.refetch()}
              retrying={channelQuery.isFetching}
            />
          </div>
        ) : (
          // O formulário só nasce com os dados em mãos: nada de re-hidratar por efeito depois.
          <NotificationsForm key={channelQuery.data.id} channel={channelQuery.data} />
        )}
      </section>

      <NotificationLogsCard />
    </div>
  );
}

function NotificationsForm({ channel }: { channel: NotificationChannel }) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState<FormState>(() => toForm(channel));
  const [saved, setSaved] = useState(() => snapshot(toForm(channel)));
  const [testResult, setTestResult] = useState<NotificationTestResult | null>(null);

  const variablesQuery = useQuery({
    queryKey: ["notification-variables"],
    queryFn: listNotificationVariables,
    staleTime: 5 * 60_000,
  });

  const dirty = snapshot(form) !== saved;
  const stepVariables = useMemo(() => stepVariableNames(form.pre_steps), [form.pre_steps]);
  const validationError = useMemo(() => validate(form), [form]);

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateNotificationChannelPayload) => updateNotificationChannel(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["notification-channel"], updated);
      const next = toForm(updated);
      setForm(next);
      setSaved(snapshot(next));
      toast.success("Configuração de notificações salva.");
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível salvar.", error)),
  });

  const testMutation = useMutation({
    mutationFn: testNotificationChannel,
    onSuccess: (result) => {
      setTestResult(result);
      queryClient.invalidateQueries({ queryKey: ["notification-logs"] });
      if (result.ok) toast.success("Teste enviado com sucesso.");
      else toast.error("O teste falhou. Veja os detalhes abaixo.");
    },
    onError: (error) => toast.error(withApiDetail("Não foi possível enviar o teste.", error)),
  });

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function insertVariable(token: string) {
    const el = bodyRef.current;
    const current = form.body_template;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    set("body_template", current.slice(0, start) + token + current.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validationError) return;
    saveMutation.mutate({
      enabled: form.enabled,
      name: form.name.trim(),
      url: form.url.trim(),
      method: form.method,
      headers: rowsToHeaders(form.headers),
      pre_steps: stepsToApi(form.pre_steps),
      body_template: form.body_template,
      failure_threshold: Number(form.failure_threshold),
      pause_schedule: form.pause_schedule,
      deactivate_automation: form.deactivate_automation,
      timeout_seconds: Number(form.timeout_seconds),
      panel_base_url: form.panel_base_url.trim() || null,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (dirty && !validationError) e.currentTarget.requestSubmit();
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="space-y-6 px-5 py-5">
        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Configuração</h2>
          </div>

          <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
            <CheckboxField
              className="md:col-span-2"
              checked={form.enabled}
              onChange={(value) => set("enabled", value)}
              label="Ativar notificações"
              description="Sem isso nada é enviado, mesmo com a configuração preenchida."
            />

            <div>
              <label htmlFor="notif-name" className={label}>
                Nome
              </label>
              <input id="notif-name" className={input} value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>

            <div>
              <label htmlFor="notif-method" className={label}>
                Método
              </label>
              <select id="notif-method" className={select} value={form.method} onChange={(e) => set("method", e.target.value as HttpMethod)}>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notif-url" className={label}>
                URL de destino
              </label>
              <input
                id="notif-url"
                className={input}
                value={form.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://desk.exemplo.com/api/chamados"
                inputMode="url"
              />
            </div>

            <div className="md:col-span-2">
              <span className={label}>Cabeçalhos</span>
              <HeadersEditor rows={form.headers} onChange={(rows) => set("headers", rows)} />
            </div>
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Etapas antes do envio (ex.: login)</h2>
          </div>
          <div className="px-5 py-5">
            <StepsEditor steps={form.pre_steps} onChange={(steps) => set("pre_steps", steps)} />
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Corpo e regras</h2>
          </div>

          <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="notif-body" className={label}>
                Corpo da requisição
              </label>
              <textarea
                id="notif-body"
                ref={bodyRef}
                value={form.body_template}
                onChange={(e) => set("body_template", e.target.value)}
                spellCheck={false}
                className={cn(textarea, "min-h-[260px] font-mono")}
                placeholder={'{\n  "titulo": "Falha em {{automacao}}",\n  "descricao": "{{erro}}"\n}'}
              />
              <p className={hint}>
                Use {"{{erro}}"} e {"{{automacao}}"} no corpo. Em JSON, os valores são escapados automaticamente: escreva "descricao": "{"{{erro}}"}".
              </p>
              <div className="mt-3">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">Variáveis disponíveis (clique para inserir)</span>
                <VariableChips
                  variables={variablesQuery.data ?? []}
                  stepVariables={stepVariables}
                  loading={variablesQuery.isLoading}
                  error={variablesQuery.isError}
                  onInsert={insertVariable}
                />
              </div>
            </div>

            <div>
              <label htmlFor="notif-threshold" className={label}>
                Falhas seguidas para notificar
              </label>
              <input
                id="notif-threshold"
                className={input}
                type="number"
                min={1}
                step={1}
                value={form.failure_threshold}
                onChange={(e) => set("failure_threshold", e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="notif-timeout" className={label}>
                Timeout (segundos)
              </label>
              <input
                id="notif-timeout"
                className={input}
                type="number"
                min={1}
                step={1}
                value={form.timeout_seconds}
                onChange={(e) => set("timeout_seconds", e.target.value)}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notif-panel" className={label}>
                URL base do painel (opcional, usada em {"{{link_task}}"})
              </label>
              <input
                id="notif-panel"
                className={input}
                value={form.panel_base_url}
                onChange={(e) => set("panel_base_url", e.target.value)}
                placeholder="https://orkaflow.exemplo.com"
                inputMode="url"
              />
            </div>

            <div className="grid gap-3 md:col-span-2">
              <CheckboxField
                checked={form.pause_schedule}
                onChange={(value) => set("pause_schedule", value)}
                label="Pausar o agendamento depois de notificar"
              />
              <CheckboxField
                checked={form.deactivate_automation}
                onChange={(value) => set("deactivate_automation", value)}
                label="Desativar também a automação"
              />
            </div>
          </div>
        </section>

        {testResult && <TestResult result={testResult} />}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-slate-500">
          <p>
            {dirty
              ? "Há alterações não salvas. O teste usa a configuração salva; salve antes de testar."
              : "O teste usa a configuração salva, com dados de exemplo, e não pausa nada."}
          </p>
          {validationError && dirty && <p className={fieldError}>{validationError}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => testMutation.mutate()}
            disabled={dirty || testMutation.isPending}
            title={dirty ? "Salve as alterações para testar" : undefined}
            className={btn.secondary}
          >
            <Send className="h-4 w-4" />
            {testMutation.isPending ? "Enviando..." : "Enviar teste"}
          </button>
          <button
            type="submit"
            disabled={saveMutation.isPending || !dirty || Boolean(validationError)}
            title={validationError ?? "Ctrl+S"}
            className={btn.primary}
          >
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </form>
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
