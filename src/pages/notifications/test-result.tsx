import { CheckCircle2, XCircle } from "lucide-react";
import type { NotificationTestResult } from "@/services/api/notifications";
import { badge, chip, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

export function TestResult({ result }: { result: NotificationTestResult }) {
  const preview = result.request_preview;
  const steps = result.steps ?? [];
  const failedStep = steps.some((s) => !s.ok);
  return (
    <div
      className={cn("rounded-xl border px-4 py-4 text-sm", result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}
    >
      {steps.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Etapas anteriores
          </div>
          <ul className="space-y-1">
            {steps.map((s, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  {s.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
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
          {failedStep && (
            <p className="mt-2 text-xs font-semibold text-red-700">
              Uma etapa anterior falhou: o envio principal não foi executado.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {result.ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <span className="font-semibold text-slate-900">
          {result.ok
            ? "Teste enviado com sucesso"
            : failedStep
              ? "O teste falhou em uma etapa anterior"
              : "O teste falhou"}
        </span>
        {result.status_code != null && !failedStep && (
          <span className={cn(badge, tone.neutral)}>HTTP {result.status_code}</span>
        )}
      </div>

      {result.error && (
        <Block title="Erro">
          <span className="text-red-700">{result.error}</span>
        </Block>
      )}
      {result.response_snippet && <Block title="Trecho da resposta">{result.response_snippet}</Block>}

      {preview && !failedStep && (
        <Block title="Requisição enviada">
          <div className="font-semibold">
            {preview.method} {preview.url}
          </div>
          {Object.entries(preview.headers ?? {}).map(([k, v]) => (
            <div key={k}>
              {k}: {v}
            </div>
          ))}
          {preview.body && <div className="mt-2 border-t border-slate-200 pt-2">{preview.body}</div>}
        </Block>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</div>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800">
        {children}
      </pre>
    </div>
  );
}
