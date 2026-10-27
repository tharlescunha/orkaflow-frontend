import { useMemo, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Pencil, ShieldCheck } from "lucide-react";

import { CredentialStatusBadge } from "@/components/common/credential-status";
import { credentialStatusLabel, isCredentialInvalid } from "@/lib/credential-status";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { formatDateTime } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, table, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getCredential } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";

export function CredentialDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ credentialId: string }>();

  const credentialId = Number(params.credentialId);
  const validId = Number.isFinite(credentialId) && credentialId > 0;

  const credentialQuery = useQuery({
    queryKey: ["credential-detail", credentialId],
    queryFn: () => getCredential(credentialId),
    enabled: validId,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  const repositoryName = useMemo(() => {
    if (!credentialQuery.data?.repository_id) return "---";
    const repo = (repositoriesQuery.data ?? []).find((item) => item.id === credentialQuery.data?.repository_id);
    return repo?.name ?? `Repositório #${credentialQuery.data.repository_id}`;
  }, [credentialQuery.data, repositoriesQuery.data]);

  function handleRefresh() {
    credentialQuery.refetch();
    repositoriesQuery.refetch();
  }

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Credencial" backTo="/credentials" backLabel="Voltar para credenciais" />
        <EmptyState
          icon={ShieldCheck}
          title="ID de credencial inválido"
          description="O endereço não aponta para uma credencial existente."
          action={
            <button type="button" onClick={() => navigate("/credentials")} className={btn.secondary}>
              Ver credenciais
            </button>
          }
        />
      </section>
    );
  }

  const credential = credentialQuery.data;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/credentials"
          backLabel="Voltar para credenciais"
          title={credential ? credential.label : `Credencial #${credentialId}`}
          description="Cadastro da credencial e as chaves dos segredos protegidos. Os valores nunca aparecem aqui."
          meta={
            credential ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={cn(badge, credential.active ? tone.success : tone.neutral)}>
                  {credential.active ? "Ativa" : "Inativa"}
                </span>
                <CredentialStatusBadge status={credential.status} reason={credential.status_reason} updatedAt={credential.status_updated_at} />
              </span>
            ) : null
          }
          actions={
            <>
              <RefreshIndicator
                updatedAt={credentialQuery.dataUpdatedAt}
                isFetching={credentialQuery.isFetching}
                onRefresh={handleRefresh}
              />
              <button
                type="button"
                onClick={() => navigate(`/credentials/${credentialId}/edit`)}
                className={btn.primary}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </>
          }
        />

        <div className={cn(cardBody, "space-y-5")}>
          {credentialQuery.isLoading ? (
            <DetailSkeleton fields={6} />
          ) : credentialQuery.isError ? (
            <QueryError
              error={credentialQuery.error}
              what="a credencial"
              onRetry={() => credentialQuery.refetch()}
              retrying={credentialQuery.isFetching}
            />
          ) : credential ? (
            <>
              {isCredentialInvalid(credential.status) && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div>
                    <p className="font-medium">
                      Um robô avisou: {credentialStatusLabel(credential.status).toLowerCase()}
                      {credential.status_reason ? ` (${credential.status_reason})` : ""}.
                    </p>
                    <p className="mt-0.5 text-red-800/80">
                      Os agendamentos das automações que usam esta credencial foram pausados e novas tasks estão bloqueadas.
                      Ao salvar um valor novo em Segredos, a credencial volta para "não verificada" e os agendamentos reativam sozinhos.
                      {credential.status_task_id ? (
                        <>
                          {" "}
                          Detectado na{" "}
                          <Link to={`/tasks/${credential.status_task_id}`} className="underline underline-offset-2">
                            task #{credential.status_task_id}
                          </Link>
                          .
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              )}

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Segredos cadastrados</h2>
                  <span className="text-xs text-slate-500">
                    {credential.items?.length ?? 0} chave{(credential.items?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>

                {credential.items?.length ? (
                  <div className={table.wrap}>
                    <table className={table.table}>
                      <thead className={table.thead}>
                        <tr>
                          <th className={table.th}>Chave</th>
                          <th className={table.th}>Tipo</th>
                          <th className={table.th}>Valor</th>
                          <th className={table.th}>Criado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credential.items.map((item) => (
                          <tr key={item.id} className={table.tr}>
                            <td className={table.tdStrong}>
                              <span className="inline-flex items-center gap-2 font-mono">
                                <KeyRound className="h-4 w-4 shrink-0 text-slate-400" />
                                {item.key ?? "---"}
                              </span>
                            </td>
                            <td className={table.td}>{item.value_type}</td>
                            <td className={cn(table.tdMuted, "font-mono")}>
                              {item.masked_preview || "••••••••"}
                            </td>
                            <td className={cn(table.tdMuted, "whitespace-nowrap")}>
                              {formatDateTime(item.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    compact
                    icon={KeyRound}
                    title="Nenhum segredo cadastrado"
                    description="Adicione chaves e valores na edição da credencial."
                    action={
                      <button
                        type="button"
                        onClick={() => navigate(`/credentials/${credentialId}/edit`)}
                        className={btn.secondary}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar credencial
                      </button>
                    }
                  />
                )}
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Detalhes técnicos</h2>
                </div>
                <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
                  <InfoItem label="ID" value={String(credential.id)} />
                  <InfoItem label="Repositório" value={repositoryName} />
                  <InfoItem label="Criada em" value={formatDateTime(credential.created_at)} />
                  <InfoItem label="Atualizada em" value={formatDateTime(credential.updated_at)} />
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}
