import { Link } from "react-router-dom";
import type { UseQueryResult } from "@tanstack/react-query";
import { LockOpen, ShieldAlert, ShieldCheck } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { formatDateTime } from "@/lib/format";
import { badge, btn, card, cardHeader, cardTitle, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { BlockedCredential } from "@/types/credential";

import { useUnblockCredential } from "./use-unblock-credential";

/**
 * Credenciais que o robô marcou como não servem mais (senha errada/expirada, usuário bloqueado).
 * Enquanto estão aqui, os agendamentos delas ficam pausados e task nova é recusada. Quando a senha mora
 * em outro cofre (e não aqui), o painel não percebe a troca: é este botão que libera.
 */
export function BlockedCredentialsCard({ query }: { query: UseQueryResult<BlockedCredential[]> }) {
  const unblock = useUnblockCredential();
  const items = query.data ?? [];

  if (query.isError) {
    return (
      <section className={card}>
        <div className="p-5">
          <QueryError error={query.error} what="as credenciais bloqueadas" onRetry={() => query.refetch()} retrying={query.isFetching} />
        </div>
      </section>
    );
  }

  if (query.isLoading) return null;

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        Nenhuma credencial bloqueada. Os robôs estão liberados para usar todas as credenciais.
      </div>
    );
  }

  return (
    <section className={cn(card, "border-red-200")}>
      <div className={cn(cardHeader, "border-red-100 bg-red-50/60")}>
        <h2 className={cn(cardTitle, "flex items-center gap-2 text-red-800")}>
          <ShieldAlert className="h-4 w-4" />
          Credenciais bloqueadas ({items.length})
        </h2>
      </div>
      <p className="px-5 pt-3 text-sm text-slate-600">
        Um robô avisou que a senha não serve mais. Os agendamentos dessas credenciais estão pausados e tasks novas são
        recusadas, para o usuário de serviço não ser bloqueado no sistema de destino. Depois de corrigir a senha, desbloqueie aqui.
      </p>

      <div className={cn(table.wrap, "mt-3")}>
        <table className={table.table}>
          <thead className={table.thead}>
            <tr>
              <th className={table.th}>Credencial</th>
              <th className={table.th}>Motivo</th>
              <th className={table.th}>Bloqueada em</th>
              <th className={table.th}>Automações</th>
              <th className={table.th}>Agendamentos pausados</th>
              <th className={table.thRight}>Ação</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const names = item.automations.map((a) => a.name || `#${a.id}`);
              return (
                <tr key={item.id} className={table.tr}>
                  <td className={table.tdStrong}>
                    <Link to={`/credentials/${item.id}`} className="underline-offset-2 hover:underline">
                      {item.label}
                    </Link>
                    {item.repository_name && <p className="text-xs font-normal text-slate-500">{item.repository_name}</p>}
                  </td>
                  <td className={table.td}>
                    <span className={cn(badge, tone.danger, "whitespace-nowrap")}>{item.status_label}</span>
                    {item.status_reason && <p className="mt-1 max-w-xs text-xs text-slate-500">{item.status_reason}</p>}
                  </td>
                  <td className={cn(table.tdMuted, "whitespace-nowrap")}>
                    {formatDateTime(item.status_updated_at)}
                    {item.status_task_id ? (
                      <p className="text-xs">
                        <Link to={`/tasks/${item.status_task_id}`} className="underline underline-offset-2">
                          task #{item.status_task_id}
                        </Link>
                      </p>
                    ) : null}
                  </td>
                  <td className={table.td}>
                    {names.length === 0 ? (
                      <span className="text-slate-400">Nenhuma automação ativa</span>
                    ) : (
                      <span title={names.join(", ")}>
                        {names.slice(0, 2).join(", ")}
                        {names.length > 2 ? ` +${names.length - 2}` : ""}
                      </span>
                    )}
                  </td>
                  <td className={table.td}>{item.schedules_paused}</td>
                  <td className={table.tdRight}>
                    <button
                      type="button"
                      onClick={() => unblock.request({ id: item.id, label: item.label, schedulesPaused: item.schedules_paused })}
                      className={btn.secondary}
                    >
                      <LockOpen className="h-4 w-4" />
                      Desbloquear
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="h-1" />
      {unblock.dialog}
    </section>
  );
}
