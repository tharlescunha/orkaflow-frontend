import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleHelp, Download, Loader2, RefreshCw, Save, TriangleAlert, X } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { TableSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { EMPTY, formatDateTime, formatRelative } from "@/lib/format";
import { badge, btn, card, input, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  cancelWorkerUpdate,
  checkWorkerLatest,
  getWorkerRelease,
  requestWorkerUpdate,
  saveWorkerRepoUrl,
  type WorkerReleaseRunner,
} from "@/services/api/settings";
import { toast } from "@/store/toast-store";

const QUERY_KEY = ["worker-release"];
const REFRESH_MS = 15_000;

function runnerSituation(runner: WorkerReleaseRunner): { text: string; className: string; icon: typeof CheckCircle2 } {
  if (runner.update_requested_at) {
    return runner.update_request_stale
      ? { text: "Pedido sem resposta", className: tone.danger, icon: TriangleAlert }
      : { text: "Atualização pedida", className: tone.info, icon: Loader2 };
  }
  if (runner.up_to_date === true) return { text: "Atualizada", className: tone.success, icon: CheckCircle2 };
  if (runner.up_to_date === false) return { text: "Desatualizada", className: tone.warning, icon: TriangleAlert };
  return { text: "Sem informação", className: tone.neutral, icon: CircleHelp };
}

/** Aba Works de Configurações: versão publicada do worker, versão de cada máquina e pedido de atualização. */
export function WorkersTab() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: getWorkerRelease, refetchInterval: REFRESH_MS });
  const data = query.data;

  const [repoUrl, setRepoUrl] = useState("");
  const [dirty, setDirty] = useState(false);

  // Enquanto a pessoa não digitou nada, o campo mostra o link salvo no servidor.
  const repoUrlValue = dirty ? repoUrl : (data?.repo_url ?? "");

  const setOverview = (overview: unknown) => queryClient.setQueryData(QUERY_KEY, overview);

  const saveMutation = useMutation({
    mutationFn: () => saveWorkerRepoUrl(repoUrlValue.trim() || null),
    onSuccess: (overview) => {
      setOverview(overview);
      setDirty(false);
      toast.success("Link do repositório salvo.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar o link.")),
  });

  const checkMutation = useMutation({
    mutationFn: checkWorkerLatest,
    onSuccess: (overview) => {
      setOverview(overview);
      if (overview.latest_error) toast.error(overview.latest_error);
      else toast.success("Versão publicada atualizada.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível consultar o repositório.")),
  });

  const updateMutation = useMutation({
    mutationFn: (ids?: number[]) => requestWorkerUpdate(ids),
    onSuccess: async (result) => {
      toast.success(
        result.requested === 1
          ? "Pedido enviado a 1 máquina. Ela reinicia quando estiver ociosa."
          : `Pedido enviado a ${result.requested} máquinas. Cada uma reinicia quando estiver ociosa.`
      );
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível pedir a atualização.")),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelWorkerUpdate(id),
    onSuccess: async () => {
      toast.success("Pedido cancelado.");
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível cancelar o pedido.")),
  });

  function handleSave(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate();
  }

  const runners = data?.runners ?? [];
  const outdated = runners.filter((r) => r.enabled && r.up_to_date === false && !r.update_requested_at);
  const busy = updateMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Versão publicada</h2>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-500">
            Link do repositório do worker. O token vem dos <strong>Ambientes</strong> (aba ao lado), nunca dentro do link. O Regente consulta a
            branch <code className="font-mono text-xs">{data?.branch ?? "main"}</code> e compara com o commit de cada máquina.
          </p>

          <form onSubmit={handleSave} className="flex flex-wrap gap-2">
            <input
              value={repoUrlValue}
              onChange={(e) => {
                setRepoUrl(e.target.value);
                setDirty(true);
              }}
              placeholder="https://github.com/tharlescunha/worker-url.git"
              className={cn(input, "min-w-[280px] flex-1 font-mono")}
              inputMode="url"
              maxLength={500}
            />
            <button type="submit" disabled={saveMutation.isPending || !dirty} className={btn.secondary}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar link
            </button>
            <button
              type="button"
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending || dirty || !data?.repo_url}
              className={btn.primary}
            >
              {checkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar versão
            </button>
          </form>

          {data?.latest_error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{data.latest_error}</p>
          ) : data?.latest_commit ? (
            <p className="text-sm text-slate-700">
              Publicada em <code className="font-mono text-xs">{data.branch}</code>:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{data.latest_commit.slice(0, 7)}</code>
              {data.latest_checked_at ? (
                <span className="ml-2 text-xs text-slate-400" title={formatDateTime(data.latest_checked_at)}>
                  verificada {formatRelative(data.latest_checked_at)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Ainda não verificada. Salve o link e clique em &ldquo;Verificar versão&rdquo;.</p>
          )}
        </div>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Máquinas</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || outdated.length === 0}
              onClick={() => updateMutation.mutate(outdated.map((r) => r.id))}
              className={cn(btn.primary, "h-9 px-3")}
            >
              Atualizar desatualizadas{outdated.length ? ` (${outdated.length})` : ""}
            </button>
            <button
              type="button"
              disabled={busy || runners.length === 0}
              onClick={() => updateMutation.mutate(undefined)}
              className={cn(btn.secondary, "h-9 px-3")}
            >
              Atualizar todas
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-sm text-slate-500">
            A máquina só reinicia quando estiver <strong>sem task rodando</strong>: ela para de pegar tasks novas, termina as atuais, sai, e o
            launcher baixa o código novo e reabre sozinho. Máquina desligada ou com o worker fechado só atualiza quando voltar.
          </p>

          {query.isLoading ? (
            <TableSkeleton rows={3} columns={6} />
          ) : query.isError ? (
            <QueryError error={query.error} what="as versões dos workers" onRetry={() => query.refetch()} retrying={query.isFetching} />
          ) : runners.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">Nenhuma máquina cadastrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Máquina</th>
                    <th className="py-2 pr-3 font-semibold">Versão</th>
                    <th className="py-2 pr-3 font-semibold">Commit</th>
                    <th className="py-2 pr-3 font-semibold">Situação</th>
                    <th className="py-2 pr-3 font-semibold">Último sinal</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {runners.map((runner) => {
                    const situation = runnerSituation(runner);
                    const Icon = situation.icon;
                    return (
                      <tr key={runner.id} className={cn("border-b border-slate-200/80 last:border-b-0", !runner.enabled && "opacity-60")}>
                        <td className="py-2 pr-3 font-medium text-slate-900">
                          {runner.label || runner.name}
                          {runner.label ? <span className="ml-1 text-xs font-normal text-slate-400">{runner.name}</span> : null}
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{runner.worker_version ?? EMPTY}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-slate-700">{runner.worker_commit ?? EMPTY}</td>
                        <td className="py-2 pr-3">
                          <span className={cn(badge, situation.className)}>
                            <Icon className={cn("h-3 w-3", Icon === Loader2 && "animate-spin")} />
                            {situation.text}
                          </span>
                          {runner.update_requested_at ? (
                            <span className="ml-2 text-xs text-slate-400" title={formatDateTime(runner.update_requested_at)}>
                              {formatRelative(runner.update_requested_at)}
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-600" title={formatDateTime(runner.last_heartbeat)}>
                          {runner.last_heartbeat ? formatRelative(runner.last_heartbeat) : EMPTY}
                        </td>
                        <td className="py-2 text-right">
                          {runner.update_requested_at ? (
                            <button type="button" disabled={busy} onClick={() => cancelMutation.mutate(runner.id)} className={cn(btn.secondary, "h-8 px-2.5")}>
                              <X className="h-3.5 w-3.5" />
                              Cancelar
                            </button>
                          ) : (
                            <button type="button" disabled={busy} onClick={() => updateMutation.mutate([runner.id])} className={cn(btn.secondary, "h-8 px-2.5")}>
                              Atualizar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
