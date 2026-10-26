import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Copy, ListChecks, TerminalSquare } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { EMPTY, formatDateTime, formatDuration } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, link, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getTaskError } from "@/services/api/task-errors";
import { toast } from "@/store/toast-store";

const CATEGORY_LABEL: Record<string, string> = {
  business: "Negócio",
  application: "Aplicação",
  system: "Sistema",
  validation: "Validação",
  integration: "Integração",
  security: "Segurança",
};

const SOURCE_LABEL: Record<string, string> = {
  worker: "Worker",
  bot: "Bot",
  orchestrator: "Orquestrador",
  system: "Sistema",
  api: "API",
};

const STATUS_LABEL: Record<string, string> = {
  waiting: "Aguardando",
  scheduled: "Agendada",
  ready: "Pronta",
  running: "Executando",
  stop_requested: "Parada solicitada",
  forced_stop: "Parada forçada",
  finished: "Finalizada",
  error: "Erro",
  timeout: "Timeout",
  canceled: "Cancelada",
};

const CATEGORY_TONE: Record<string, string> = {
  validation: tone.warning,
  integration: tone.info,
  security: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  system: tone.danger,
  application: "border-violet-200 bg-violet-50 text-violet-700",
  business: tone.success,
};

function getCategoryLabel(value?: string | null) {
  return CATEGORY_LABEL[(value || "").toLowerCase()] ?? (value || EMPTY);
}

function getSourceLabel(value?: string | null) {
  return SOURCE_LABEL[(value || "").toLowerCase()] ?? (value || EMPTY);
}

function getStatusLabel(value?: string | null) {
  return STATUS_LABEL[(value || "").toLowerCase()] ?? (value || EMPTY);
}

function getCategoryTone(value?: string | null) {
  return CATEGORY_TONE[(value || "").toLowerCase()] ?? tone.neutral;
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado.`);
  } catch {
    toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
  }
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

export function TaskErrorDetailPage() {
  const { errorId } = useParams<{ errorId: string }>();
  const parsedErrorId = Number(errorId);
  const validId = Number.isFinite(parsedErrorId) && parsedErrorId > 0;

  const errorQuery = useQuery({
    queryKey: ["task-error-detail-page", parsedErrorId],
    queryFn: () => getTaskError(parsedErrorId),
    enabled: validId,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const header = (meta?: ReactNode, actions?: ReactNode) => (
    <PageHeader
      title={validId ? `Erro #${parsedErrorId}` : "Erro"}
      backTo="/errors"
      backLabel="Voltar para erros"
      meta={meta}
      actions={actions}
    />
  );

  if (!validId) {
    return (
      <section className={card}>
        {header()}
        <div className="p-5">
          <QueryError error={new Error("ID do erro inválido.")} what="o erro" />
        </div>
      </section>
    );
  }

  if (errorQuery.isLoading) {
    return (
      <section className={card}>
        {header()}
        <div className="p-5">
          <DetailSkeleton fields={6} />
        </div>
      </section>
    );
  }

  if (errorQuery.isError || !errorQuery.data) {
    return (
      <section className={card}>
        {header()}
        <div className="p-5">
          <QueryError error={errorQuery.error} what="o erro" onRetry={() => errorQuery.refetch()} retrying={errorQuery.isFetching} />
        </div>
      </section>
    );
  }

  const error = errorQuery.data;
  const automationName = error.automation_label?.trim() || error.automation_name || null;

  return (
    <section className={card}>
      {header(
        <>
          {error.error_category ? (
            <span className={cn(badge, getCategoryTone(error.error_category))}>{getCategoryLabel(error.error_category)}</span>
          ) : null}
          <span className={cn(badge, error.is_retryable ? tone.info : tone.warning)}>{error.is_retryable ? "Reprocessável" : "Sem retry"}</span>
        </>,
        <>
          <RefreshIndicator updatedAt={errorQuery.dataUpdatedAt} isFetching={errorQuery.isFetching} onRefresh={() => errorQuery.refetch()} />
          <Link to={`/tasks/${error.task_id}`} className={btn.primary}>
            <ListChecks className="h-4 w-4" />
            Ver task #{error.task_id}
          </Link>
        </>
      )}

      <div className="space-y-5 p-5 md:p-6">
        {/* Primeiro bloco: o que a pessoa veio ver (tipo, mensagem). */}
        <section className="rounded-xl border border-red-200 bg-red-50/50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-xl font-semibold text-slate-950">{error.error_type || "Erro sem tipo"}</h2>
                {error.code ? <span className={cn(badge, tone.neutral)}>Código: {error.code}</span> : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{error.message || EMPTY}</p>
              {automationName ? (
                <p className="mt-2 text-sm text-slate-600">
                  Automação{" "}
                  {error.automation_id ? (
                    <Link to={`/automations/${error.automation_id}`} className={link}>
                      {automationName}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-900">{automationName}</span>
                  )}
                  {" · "}
                  <Link to={`/tasks/${error.task_id}`} className={link}>
                    task #{error.task_id}
                  </Link>
                  {" · "}
                  {getSourceLabel(error.source)}
                </p>
              ) : null}
            </div>
            <button type="button" onClick={() => copyText(error.message || "", "Mensagem")} className={cn(btn.secondary, btn.sm, "shrink-0")}>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
        </section>

        <details className={cn(card, "group")} open={Boolean(error.stacktrace)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
            <span className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-slate-500 transition group-open:rotate-90" />
              <TerminalSquare className="h-4 w-4 text-slate-500" />
              <span className={cardTitle}>Stacktrace</span>
            </span>
            {error.stacktrace ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  copyText(error.stacktrace ?? "", "Stacktrace");
                }}
                className={cn(btn.secondary, btn.sm)}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar stacktrace
              </button>
            ) : null}
          </summary>
          <div className="border-t border-slate-200 px-5 py-4">
            {error.stacktrace ? (
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {error.stacktrace}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">Sem stacktrace registrado.</p>
            )}
          </div>
        </details>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Contexto</h2>
            </div>
            <div className={cn(cardBody, "grid gap-5 sm:grid-cols-2")}>
              <InfoItem
                label="Task"
                value={
                  <Link to={`/tasks/${error.task_id}`} className={link}>
                    #{error.task_id}
                  </Link>
                }
              />
              <InfoItem label="Status da task" value={getStatusLabel(error.task_status)} />
              <InfoItem
                label="Automação"
                value={
                  automationName && error.automation_id ? (
                    <Link to={`/automations/${error.automation_id}`} className={link}>
                      {automationName}
                    </Link>
                  ) : (
                    automationName || EMPTY
                  )
                }
              />
              <InfoItem label="Bot / versão" value={`${error.bot_name || EMPTY}${error.bot_version_label ? ` · ${error.bot_version_label}` : ""}`} />
              <InfoItem label="Repositório" value={error.repository_name || EMPTY} />
              <InfoItem
                label="Runner"
                value={
                  error.runner_id ? (
                    <Link to={`/runners/${error.runner_id}`} className={link}>
                      {error.runner_label?.trim() || error.runner_name || `#${error.runner_id}`}
                    </Link>
                  ) : (
                    error.runner_label?.trim() || error.runner_name || "Sem runner"
                  )
                }
              />
              <InfoItem label="Origem" value={getSourceLabel(error.source)} />
              <InfoItem label="Criado por" value={error.created_by_name || EMPTY} />
              <InfoItem label="Duração da task" value={formatDuration(error.execution_duration_seconds)} />
            </div>
          </section>

          <section className={card}>
            <div className={cardHeader}>
              <h2 className={cardTitle}>Mensagem final da task</h2>
            </div>
            <div className={cardBody}>
              <div className="min-h-[120px] whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                {error.final_message || "Sem mensagem final registrada."}
              </div>
            </div>
          </section>
        </div>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Datas</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 sm:grid-cols-2 xl:grid-cols-4")}>
            <InfoItem label="Erro registrado em" value={formatDateTime(error.created_at)} />
            <InfoItem label="Task criada em" value={formatDateTime(error.task_created_at)} />
            <InfoItem label="Task iniciada em" value={formatDateTime(error.task_started_at)} />
            <InfoItem label="Task finalizada em" value={formatDateTime(error.task_finished_at)} />
            {error.updated_at ? <InfoItem label="Erro atualizado em" value={formatDateTime(error.updated_at)} /> : null}
            <InfoItem label="ID do erro" value={String(error.id)} />
          </div>
        </section>
      </div>
    </section>
  );
}
