import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Eye } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { listNotificationLogs } from "@/services/api/notifications";
import { LogDetailDrawer } from "./log-detail-drawer";

const KIND_LABEL: Record<string, string> = {
  failure_alert: "Alerta de falha",
  test: "Teste",
};

export function NotificationLogsCard() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

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
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <span className="sr-only">Detalhes</span>
                </th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Agendamento / Automação</th>
                <th className="px-3 py-2">Tasks</th>
                <th className="px-3 py-2">Resultado</th>
                <th className="px-3 py-2">Pausou?</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                    selectedId === log.id ? "bg-slate-50" : ""
                  }`}
                  onClick={() => setSelectedId(log.id)}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-label={`Ver detalhes do envio ${log.id}`}
                      title="Ver detalhes"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(log.id);
                      }}
                      className="inline-flex items-center gap-1 whitespace-nowrap border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" /> Ver detalhes
                    </button>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LogDetailDrawer logId={selectedId} onClose={() => setSelectedId(null)} />
    </section>
  );
}
