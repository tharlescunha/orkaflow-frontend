import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { badge, btn, chip, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getEventRun, listEventRuns, type EventRun, type EventRunDetail, type EventRunStatus } from "@/services/api/events";
import { CopyButton, JsonBlock } from "@/pages/notifications/json-block";
import type { NotificationTestStep } from "@/services/api/notifications";
import { readRequest, readResponseBody, readSteps, type DetailRequest } from "./event-utils";

const STATUS_LABEL: Record<EventRunStatus, string> = {
  pending: "Na fila",
  running: "Enviando",
  success: "OK",
  error: "Falhou",
  test: "Teste",
};

function statusTone(run: EventRun) {
  if (run.status === "pending" || run.status === "running") return tone.info;
  if (run.status === "test") return run.ok ? tone.success : tone.warning;
  return run.ok ? tone.success : tone.danger;
}

export function EventRunStatusBadge({ run }: { run: EventRun }) {
  return (
    <span className={cn(badge, statusTone(run))}>
      {STATUS_LABEL[run.status] ?? run.status}
      {run.status_code != null && ` · HTTP ${run.status_code}`}
    </span>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">{text}</p>;
}

// ----- Componentes -----

function RunRow({ run, onOpen }: { run: EventRun; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <EventRunStatusBadge run={run} />
        <span className="font-medium text-slate-900">{run.trigger_label || run.trigger_type}</span>
        <span className="ml-auto text-xs text-slate-500">{formatDateTime(run.created_at)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="text-slate-500">#{run.id}</span>
        {run.task_id != null ? (
          <Link
            to={`/tasks/${run.task_id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono text-blue-700 underline"
          >
            task #{run.task_id}
          </Link>
        ) : (
          <span className="text-slate-500">sem task</span>
        )}
        {run.automation_name && <span className="truncate">{run.automation_name}</span>}
      </div>
      {run.error && <div className="break-all text-xs text-red-700">{run.error}</div>}
    </button>
  );
}

function RunsList({ ruleId, onOpen }: { ruleId: number; onOpen: (id: number) => void }) {
  const query = useQuery({
    queryKey: ["event-runs", { rule_id: ruleId }],
    queryFn: () => listEventRuns({ rule_id: ruleId, limit: 50 }),
    staleTime: 15_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="space-y-3 px-4 py-8 text-sm" role="alert">
        <p className="text-red-600">{getApiErrorMessage(query.error, "Não foi possível carregar o histórico.")}</p>
        <button type="button" onClick={() => query.refetch()} className={cn(btn.secondary, btn.sm)}>
          Tentar de novo
        </button>
      </div>
    );
  }
  const runs = query.data ?? [];
  return (
    <div className="space-y-2 px-4 pb-6">
      {runs.length === 0 ? (
        <Empty text="Este evento ainda não disparou. Use “Testar” para enviar uma requisição de exemplo." />
      ) : (
        runs.map((run) => <RunRow key={run.id} run={run} onOpen={() => onOpen(run.id)} />)
      )}
    </div>
  );
}

function Summary({ run }: { run: EventRunDetail }) {
  return (
    <div className="space-y-2 text-sm">
      <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-1">
        <dt className="text-slate-500">Data</dt>
        <dd className="text-slate-800">{formatDateTime(run.created_at)}</dd>
        <dt className="text-slate-500">Evento</dt>
        <dd className="text-slate-800">{run.rule_name}</dd>
        <dt className="text-slate-500">Gatilho</dt>
        <dd className="text-slate-800">{run.trigger_label || run.trigger_type}</dd>
        <dt className="text-slate-500">Automação</dt>
        <dd className="text-slate-800">{run.automation_name ?? "---"}</dd>
        <dt className="text-slate-500">Task</dt>
        <dd className="text-slate-800">
          {run.task_id != null ? (
            <Link to={`/tasks/${run.task_id}`} className="font-mono text-xs text-blue-700 underline">
              #{run.task_id}
            </Link>
          ) : (
            "---"
          )}
        </dd>
        <dt className="text-slate-500">Resultado</dt>
        <dd>
          <EventRunStatusBadge run={run} />
        </dd>
        {run.finished_at && (
          <>
            <dt className="text-slate-500">Terminou em</dt>
            <dd className="text-slate-800">{formatDateTime(run.finished_at)}</dd>
          </>
        )}
      </dl>
      {run.error && (
        <pre className="whitespace-pre-wrap break-all rounded-lg border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-700">
          {run.error}
        </pre>
      )}
    </div>
  );
}

function Steps({ steps }: { steps: NotificationTestStep[] }) {
  return (
    <ul className="space-y-1">
      {steps.map((s, i) => (
        <li key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {s.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Sucesso" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" aria-label="Falhou" />
            )}
            <span className="font-medium text-slate-900">
              {i + 1}. {s.name || "Etapa sem nome"}
            </span>
            {s.status_code != null && <span className={chip}>HTTP {s.status_code}</span>}
          </div>
          {s.error && <div className="mt-1 break-all text-xs text-red-700">{s.error}</div>}
          {(s.extracted?.length ?? 0) > 0 && (
            <div className="mt-1 text-xs text-slate-600">
              Variáveis guardadas: <span className="font-mono">{s.extracted.map((n) => `{{${n}}}`).join(", ")}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function KeyValueTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-left text-xs">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-200/80 last:border-0">
              <th className="whitespace-nowrap bg-slate-50 px-2 py-1 align-top font-mono font-medium text-slate-700">{k}</th>
              <td className="break-all px-2 py-1 font-mono text-slate-800">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestSection({ request }: { request: DetailRequest }) {
  const headers = Object.entries(request.headers);
  const full = [`${request.method} ${request.url}`, ...headers.map(([k, v]) => `${k}: ${v}`), "", request.body].join("\n");
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-all font-mono text-xs text-slate-800">
          <span className="mr-2 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-semibold">{request.method}</span>
          {request.url}
        </div>
        <CopyButton value={full} label="Copiar requisição" />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-600">Cabeçalhos</div>
        {headers.length === 0 ? <p className="text-xs text-slate-500">Nenhum cabeçalho.</p> : <KeyValueTable rows={headers} />}
      </div>
      <JsonBlock title="Corpo" text={request.body} formatJson copyLabel="Copiar corpo da requisição" emptyText="Corpo vazio" />
    </div>
  );
}

function RunDetail({ runId }: { runId: number }) {
  const query = useQuery({
    queryKey: ["event-run", runId],
    queryFn: () => getEventRun(runId),
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes...
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className="space-y-3 px-4 py-8 text-sm" role="alert">
        <p className="text-red-600">{getApiErrorMessage(query.error, "Não foi possível carregar os detalhes do disparo.")}</p>
        <button type="button" onClick={() => query.refetch()} className={cn(btn.secondary, btn.sm)}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const run = query.data;
  const steps = readSteps(run.details);
  const request = readRequest(run.details);
  const responseBody = readResponseBody(run.details);
  const variables = Object.entries(run.variables ?? {});

  return (
    <div className="space-y-6 px-4 pb-6">
      <Section title="Resumo">
        <Summary run={run} />
      </Section>

      <Section title="Variáveis usadas">
        {variables.length === 0 ? <Empty text="Nenhuma variável registrada." /> : <KeyValueTable rows={variables} />}
      </Section>

      {steps.length > 0 && (
        <Section title="Etapas anteriores">
          <Steps steps={steps} />
        </Section>
      )}

      <Section title="Requisição enviada">
        {request ? <RequestSection request={request} /> : <Empty text="A requisição não chegou a ser montada." />}
      </Section>

      <Section title="Resposta do sistema que recebeu">
        {responseBody ? (
          <JsonBlock title="Corpo da resposta" text={responseBody} formatJson copyLabel="Copiar resposta" />
        ) : run.response_snippet ? (
          <JsonBlock title="Trecho da resposta" text={run.response_snippet} copyLabel="Copiar trecho" />
        ) : (
          <Empty text="Resposta vazia." />
        )}
      </Section>
    </div>
  );
}

type Props = {
  // Regra cujo histórico abre; null fecha o drawer.
  rule: { id: number; name: string } | null;
  onClose: () => void;
};

// Gaveta à direita (portal, como o LogDetailDrawer): lista os disparos da regra e abre cada um.
export function EventRunsDrawer({ rule, onClose }: Props) {
  const [runId, setRunId] = useState<number | null>(null);
  const open = rule != null;

  function handleOpenChange(next: boolean) {
    if (next) return;
    setRunId(null);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-slate-200 bg-white text-slate-900 shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b border-slate-200">
          {runId != null ? (
            <>
              <button
                type="button"
                onClick={() => setRunId(null)}
                className="mb-1 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao histórico
              </button>
              <SheetTitle className="text-slate-900">Disparo #{runId}</SheetTitle>
              <SheetDescription className="text-slate-500">Tudo o que foi enviado e devolvido neste disparo.</SheetDescription>
            </>
          ) : (
            <>
              <SheetTitle className="text-slate-900">Histórico{rule ? ` · ${rule.name}` : ""}</SheetTitle>
              <SheetDescription className="text-slate-500">Últimos 50 disparos deste evento. Clique em um para ver os detalhes.</SheetDescription>
            </>
          )}
        </SheetHeader>
        {rule && (runId != null ? <RunDetail runId={runId} /> : <RunsList ruleId={rule.id} onOpen={setRunId} />)}
      </SheetContent>
    </Sheet>
  );
}
