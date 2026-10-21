import { CheckCircle2, XCircle } from "lucide-react";
import type { NotificationTestResult } from "@/services/api/notifications";

export function TestResult({ result }: { result: NotificationTestResult }) {
  const preview = result.request_preview;
  return (
    <div
      className={`border px-4 py-4 text-sm ${
        result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {result.ok ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" />
        )}
        <span className="font-semibold text-slate-900">
          {result.ok ? "Teste enviado com sucesso" : "O teste falhou"}
        </span>
        {result.status_code != null && (
          <span className="border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
            HTTP {result.status_code}
          </span>
        )}
      </div>

      {result.error && (
        <Block title="Erro">
          <span className="text-red-700">{result.error}</span>
        </Block>
      )}
      {result.response_snippet && <Block title="Trecho da resposta">{result.response_snippet}</Block>}

      {preview && (
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
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all border border-slate-200 bg-white p-3 font-mono text-xs text-slate-800">
        {children}
      </pre>
    </div>
  );
}
