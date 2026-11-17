import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { TableSkeleton } from "@/components/common/skeleton";
import { withApiDetail } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, input, label, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { createAccessRelease, listAccessReleases } from "@/services/api/access-releases";
import { toast } from "@/store/toast-store";

export function AccessReleasesPage() {
  const queryClient = useQueryClient();

  const [login, setLogin] = useState("");
  const [system, setSystem] = useState("SAP");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const releasesQuery = useQuery({
    queryKey: ["access-releases"],
    queryFn: listAccessReleases,
  });

  const releaseMutation = useMutation({
    mutationFn: createAccessRelease,
    onSuccess: async (item) => {
      toast.success(`Acesso de ${item.login} liberado. Os robôs recebem o aviso nas próximas execuções.`);
      setConfirmOpen(false);
      setLogin("");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["access-releases"] });
    },
    onError: (error) => {
      setConfirmOpen(false);
      toast.error(withApiDetail("Não foi possível liberar o acesso.", error));
    },
  });

  const cleanLogin = login.trim();
  const items = releasesQuery.data ?? [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (cleanLogin) setConfirmOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Liberar acesso"
          description="Avise os robôs que um usuário bloqueado já foi corrigido (senha trocada, usuário desbloqueado no SAP) e pode voltar a ser usado, sem esperar as 24 horas."
          actions={
            <RefreshIndicator
              updatedAt={releasesQuery.dataUpdatedAt}
              isFetching={releasesQuery.isFetching}
              onRefresh={() => releasesQuery.refetch()}
            />
          }
        />

        <form onSubmit={handleSubmit} className={cn(cardBody, "grid gap-4 md:grid-cols-[1fr_12rem_1.5fr_auto] md:items-end")}>
          <div>
            <label htmlFor="release-login" className={label}>
              Usuário a liberar
            </label>
            <input
              id="release-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Ex.: LEZANATTA"
              autoComplete="off"
              maxLength={80}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="release-system" className={label}>
              Sistema
            </label>
            <input
              id="release-system"
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              placeholder="SAP"
              maxLength={60}
              className={input}
            />
          </div>
          <div>
            <label htmlFor="release-note" className={label}>
              Observação (opcional)
            </label>
            <input
              id="release-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: o próprio usuário trocou a senha"
              maxLength={300}
              className={input}
            />
          </div>
          <button type="submit" disabled={!cleanLogin || releaseMutation.isPending} className={cn(btn.primary, "disabled:opacity-60")}>
            <UserCheck className="h-4 w-4" />
            Liberar usuário
          </button>
        </form>

        <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          A liberação não faz login em nada: só avisa. Os robôs que se protegem contra bloqueio (como a aprovação de insumos)
          passam a ignorar as recusas desse usuário anteriores ao horário da liberação. Ela vale por 48 horas.
        </p>
      </section>

      <section className={card}>
        <div className={cardHeader}>
          <h2 className={cardTitle}>Liberações feitas</h2>
          <span className="text-xs text-slate-500">
            {items.length} registro{items.length === 1 ? "" : "s"}
          </span>
        </div>

        {releasesQuery.isLoading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : releasesQuery.isError ? (
          <div className="p-5">
            <QueryError
              error={releasesQuery.error}
              what="as liberações"
              onRetry={() => releasesQuery.refetch()}
              retrying={releasesQuery.isFetching}
            />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon={UserCheck}
            title="Nenhuma liberação ainda"
            description="Quando você liberar um usuário, ele aparece aqui com quem liberou e quando."
          />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead className={table.thead}>
                <tr>
                  <th className={table.th}>Usuário</th>
                  <th className={table.th}>Sistema</th>
                  <th className={table.th}>Liberado em</th>
                  <th className={table.th}>Por</th>
                  <th className={table.th}>Observação</th>
                  <th className={table.th}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={`${item.login}-${item.released_at}`} className={table.tr}>
                    <td className={cn(table.tdStrong, "font-mono")}>{item.login}</td>
                    <td className={table.td}>{item.system || "---"}</td>
                    <td className={cn(table.tdMuted, "whitespace-nowrap")}>{formatDateTime(item.released_at)}</td>
                    <td className={table.td}>{item.released_by_name || "---"}</td>
                    <td className={table.td}>{item.note || "---"}</td>
                    <td className={table.td}>
                      <span className={cn(badge, item.active ? tone.success : tone.neutral)}>
                        {item.active ? "Valendo" : "Antiga"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Liberar usuário"
        description={`Confirme que ${cleanLogin.toUpperCase()} já foi corrigido (senha trocada ou usuário desbloqueado no ${system.trim() || "sistema"}).\n\nSe a senha ainda estiver errada, o robô tenta de novo e pode bloquear o usuário outra vez.`}
        confirmLabel="Liberar"
        tone="warning"
        isPending={releaseMutation.isPending}
        onConfirm={() => releaseMutation.mutate({ login: cleanLogin, system: system.trim() || null, note: note.trim() || null })}
        onCancel={() => {
          if (!releaseMutation.isPending) setConfirmOpen(false);
        }}
      />
    </div>
  );
}
