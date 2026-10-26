import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Eye } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { TableSkeleton } from "@/components/common/skeleton";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { EMPTY, formatDateTime } from "@/lib/format";
import { badge, btn, card, cardHeader, cardTitle, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listNotificationLogs } from "@/services/api/notifications";
import { LogDetailDrawer } from "./log-detail-drawer";

const KIND_LABEL: Record<string, string> = {
  failure_alert: "Alerta de falha",
  test: "Teste",
};

const REFRESH_MS = 15_000;

export function NotificationLogsCard() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const logsQuery = useQuery({
    queryKey: ["notification-logs"],
    queryFn: () => listNotificationLogs(50),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  const logs = logsQuery.data ?? [];

  return (
    <section className={card}>
      <div className={cardHeader}>
        <div>
          <h2 className={cardTitle}>Histórico de envios</h2>
          <p className="mt-0.5 text-xs text-slate-500">Últimos 50 envios.</p>
        </div>
        <RefreshIndicator
          updatedAt={logsQuery.dataUpdatedAt}
          isFetching={logsQuery.isFetching}
          onRefresh={() => logsQuery.refetch()}
          intervalMs={REFRESH_MS}
        />
      </div>

      {logsQuery.isLoading ? (
        <TableSkeleton rows={5} columns={6} />
      ) : logsQuery.isError ? (
        <div className="p-5">
          <QueryError error={logsQuery.error} what="o histórico de envios" onRetry={() => logsQuery.refetch()} retrying={logsQuery.isFetching} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhum envio registrado" description='Use "Enviar teste" para validar a configuração.' />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead className={table.thead}>
              <tr>
                <th className={table.th}>Data</th>
                <th className={table.th}>Tipo</th>
                <th className={table.th}>Agendamento / automação</th>
                <th className={table.th}>Tasks</th>
                <th className={table.th}>Resultado</th>
                <th className={table.th}>Pausou?</th>
                <th className={table.thRight}>
                  <span className="sr-only">Detalhes</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={cn(table.trClickable, selectedId === log.id && "bg-blue-50/60")}
                  onClick={() => setSelectedId(log.id)}
                >
                  <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(log.created_at)}</td>
                  <td className={table.td}>{KIND_LABEL[log.kind] ?? log.kind}</td>
                  <td className={table.td}>
                    {log.schedule_name || log.automation_name ? (
                      <>
                        <div className="font-medium text-slate-900">{log.schedule_name ?? EMPTY}</div>
                        <div className="text-xs text-slate-500">{log.automation_name ?? EMPTY}</div>
                      </>
                    ) : (
                      EMPTY
                    )}
                  </td>
                  <td className={cn(table.tdMuted, "max-w-[180px] truncate font-mono text-xs")} title={log.task_ids ?? ""}>
                    {log.task_ids || EMPTY}
                  </td>
                  <td className={cn(table.td, "whitespace-nowrap")}>
                    <span className={cn(badge, log.ok ? tone.success : tone.danger)}>
                      {log.ok ? "OK" : "Falhou"}
                      {log.status_code != null && ` · ${log.status_code}`}
                    </span>
                  </td>
                  <td className={table.td}>{log.paused_schedule ? "Sim" : "Não"}</td>
                  <td className={table.tdRight}>
                    <button
                      type="button"
                      aria-label={`Ver detalhes do envio ${log.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(log.id);
                      }}
                      className={cn(btn.secondary, btn.sm)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Detalhes
                    </button>
                  </td>
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
