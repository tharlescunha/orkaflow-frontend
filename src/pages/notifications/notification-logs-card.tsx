import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, ChevronRight } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { listNotificationLogs } from "@/services/api/notifications";

const KIND_LABEL: Record<string, string> = {
  failure_alert: "Alerta de falha",
  test: "Teste",
};

export function NotificationLogsCard() {
  const [expanded, setExpanded] = useState<number | null>(null);

  const logsQuery = useQuery({
    queryKey: ["notification-logs"],
    queryFn: () => listNotificationLogs(50),
    refetchInterval: 15_000,
  });

  const logs = logsQuery.data ?? [];

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Histórico de envios
        </h2>
        <p className="text-xs text-slate-500">Últimos 50 envios, atualizado a cada 15 segundos.</p>
      </div>

      {logsQuery.isLoading ? (
        <div className="px-5 py-8 text-sm text-slate-500">Carregando histórico...</div>
      ) : logsQuery.isError ? (
        <div className="px-5 py-8 text-sm text-red-600">
          {getApiErrorMessage(logsQuery.error, "Não foi possível carregar o histórico.")}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-sm text-slate-500">
          <Bell className="h-6 w-6 text-slate-400" />
          Nenhum envio registrado ainda. Use "Enviar teste" para validar a configuração.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Agendamento / Automação</th>
                <th className="px-3 py-2">Tasks</th>
                <th className="px-3 py-2">Resultado</th>
                <th className="px-3 py-2">Pausou?</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const open = expanded === log.id;
                const hasDetail = Boolean(log.error || log.response_snippet);
                return (
                  <Fragment key={log.id}>
                    <tr
                      className={`border-b border-slate-100 ${hasDetail ? "cursor-pointer hover:bg-slate-50" : ""}`}
                      onClick={() => hasDetail && setExpanded(open ? null : log.id)}
                    >
                      <td className="px-3 py-2 text-slate-400">
                        {hasDetail &&
                          (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{KIND_LABEL[log.kind] ?? log.kind}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {log.schedule_name || log.automation_name ? (
                          <>
                            <div>{log.schedule_name ?? "---"}</div>
                            <div className="text-xs text-slate-500">{log.automation_name ?? "---"}</div>
                          </>
                        ) : (
                          "---"
                        )}
                      </td>
                      <td
                        className="max-w-[180px] truncate px-3 py-2 font-mono text-xs text-slate-600"
                        title={log.task_ids ?? ""}
                      >
                        {log.task_ids || "---"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-semibold ${
                            log.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {log.ok ? "OK" : "Falhou"}
                          {log.status_code != null && ` · ${log.status_code}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{log.paused_schedule ? "Sim" : "Não"}</td>
                    </tr>
                    {open && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td />
                        <td colSpan={6} className="space-y-2 px-3 py-3">
                          {log.error && (
                            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-red-700">
                              Erro: {log.error}
                            </pre>
                          )}
                          {log.response_snippet && (
                            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-slate-700">
                              Resposta: {log.response_snippet}
                            </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
