import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { badge, btn, chip, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getNotificationLog, type NotificationLogDetail } from "@/services/api/notifications";
import { CopyButton, JsonBlock } from "./json-block";

const KIND_LABEL: Record<string, string> = {
  failure_alert: "Alerta de falha",
  test: "Teste",
};

const TRUNCATE_LIMIT = 32_000;
const UNAVAILABLE = "Detalhes não disponíveis para envios anteriores a esta versão";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

function Unavailable() {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">{UNAVAILABLE}</p>
  );
}

function Summary({ log }: { log: NotificationLogDetail }) {
  const taskIds = (log.task_ids ?? "").split(/[^0-9]+/).filter(Boolean);
  return (
    <div className="space-y-2 text-sm">
      <dl className="grid grid-cols-[100px_1fr] items-center gap-x-3 gap-y-1">
        <dt className="text-slate-500">Data</dt>
        <dd className="text-slate-800">{formatDateTime(log.created_at)}</dd>
        <dt className="text-slate-500">Tipo</dt>
        <dd className="text-slate-800">{KIND_LABEL[log.kind] ?? log.kind}</dd>
        <dt className="text-slate-500">Agendamento</dt>
        <dd className="text-slate-800">{log.schedule_name ?? "---"}</dd>
        <dt className="text-slate-500">Automação</dt>
        <dd className="text-slate-800">{log.automation_name ?? "---"}</dd>
        <dt className="text-slate-500">Tasks</dt>
        <dd className="flex flex-wrap gap-x-2 text-slate-800">
          {taskIds.length === 0
            ? "---"
            : taskIds.map((id) => (
                <Link key={id} to={`/tasks/${id}`} className="font-mono text-xs text-blue-700 underline">
                  #{id}
                </Link>
              ))}
        </dd>
        <dt className="text-slate-500">Resultado</dt>
        <dd>
          <span
            className={cn(badge, log.ok ? tone.success : tone.danger)}
          >
            {log.ok ? "OK" : "Falhou"}
            {log.status_code != null && ` · HTTP ${log.status_code}`}
          </span>
        </dd>
        <dt className="text-slate-500">Pausou?</dt>
        <dd className="text-slate-800">{log.paused_schedule ? "Sim, o agendamento foi pausado" : "Não"}</dd>
      </dl>
      {log.error && (
        <pre className="whitespace-pre-wrap break-all rounded-lg border border-red-200 bg-red-50 p-3 font-mono text-xs text-red-700">
          {log.error}
        </pre>
      )}
    </div>
  );
}

function Steps({ steps }: { steps: NonNullable<NotificationLogDetail["steps"]> }) {
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
            {s.status_code != null && (
              <span className={chip}>HTTP {s.status_code}</span>
            )}
          </div>
          {s.error && <div className="mt-1 break-all text-xs text-red-700">{s.error}</div>}
          {(s.extracted?.length ?? 0) > 0 && (
            <div className="mt-1 text-xs text-slate-600">
              Variáveis guardadas:{" "}
              <span className="font-mono">{s.extracted.map((n) => `{{${n}}}`).join(", ")}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function RequestSection({ request }: { request: NonNullable<NotificationLogDetail["request"]> }) {
  const headers = Object.entries(request.headers ?? {});
  const full = [
    `${request.method} ${request.url}`,
    ...headers.map(([k, v]) => `${k}: ${v}`),
    "",
    request.body ?? "",
  ].join("\n");
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 break-all font-mono text-xs text-slate-800">
          <span className="mr-2 rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-semibold">
            {request.method}
          </span>
          {request.url}
        </div>
        <CopyButton value={full} label="Copiar requisição" />
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-slate-600">Cabeçalhos</div>
        {headers.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum cabeçalho.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <tbody>
                {headers.map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 last:border-0">
                    <th className="whitespace-nowrap bg-slate-50 px-2 py-1 font-mono font-medium text-slate-700">
                      {k}
                    </th>
                    <td className="break-all px-2 py-1 font-mono text-slate-800">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <JsonBlock title="Corpo" text={request.body} copyLabel="Copiar corpo da requisição" emptyText="Corpo vazio" />
    </div>
  );
}

function Detail({ log }: { log: NotificationLogDetail }) {
  const steps = log.steps ?? [];
  const truncated = (log.response_body?.length ?? 0) >= TRUNCATE_LIMIT;
  const legacy = !log.request && steps.length === 0 && !log.response_body;
  return (
    <div className="space-y-6 px-4 pb-6">
      <Section title="Resumo">
        <Summary log={log} />
      </Section>

      {(steps.length > 0 || legacy) && (
        <Section title="Etapas anteriores">{steps.length > 0 ? <Steps steps={steps} /> : <Unavailable />}</Section>
      )}

      <Section title="Requisição enviada">
        {log.request ? <RequestSection request={log.request} /> : <Unavailable />}
      </Section>

      <Section title="Resposta completa do sistema que recebeu">
        {log.response_body ? (
          <JsonBlock
            title="Corpo da resposta"
            text={log.response_body}
            formatJson
            copyLabel="Copiar resposta"
            note={truncated ? "Resposta truncada em 32.000 caracteres" : null}
          />
        ) : legacy ? (
          <div className="space-y-2">
            <Unavailable />
            {log.response_snippet && (
              <JsonBlock title="Trecho da resposta" text={log.response_snippet} copyLabel="Copiar trecho" />
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">Resposta vazia</p>
        )}
      </Section>
    </div>
  );
}

export function LogDetailDrawer({ logId, onClose }: { logId: number | null; onClose: () => void }) {
  const query = useQuery({
    queryKey: ["notification-log", logId],
    queryFn: () => getNotificationLog(logId as number),
    enabled: logId != null,
    staleTime: 60_000,
  });

  return (
    <Sheet open={logId != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-slate-200 bg-white text-slate-900 shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b border-slate-200">
          <SheetTitle className="text-slate-900">Detalhes do envio {logId != null && `#${logId}`}</SheetTitle>
          <SheetDescription className="text-slate-500">Tudo o que foi enviado e devolvido neste envio.</SheetDescription>
        </SheetHeader>
        {query.isLoading ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando detalhes...
          </div>
        ) : query.isError ? (
          <div className="space-y-3 px-4 py-8 text-sm" role="alert">
            <p className="text-red-600">
              {getApiErrorMessage(query.error, "Não foi possível carregar os detalhes do envio.")}
            </p>
            <button
              type="button"
              onClick={() => query.refetch()}
              className={cn(btn.secondary, btn.sm)}
            >
              Tentar de novo
            </button>
          </div>
        ) : query.data ? (
          <Detail log={query.data} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
