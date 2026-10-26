import { useMemo, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GitCommitHorizontal } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { formatDateTime } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getBotVersion } from "@/services/api/bot-versions";
import { listAllBots } from "@/services/api/bots";

export function BotVersionDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ botVersionId: string }>();

  const botVersionId = Number(params.botVersionId);
  const validId = Number.isFinite(botVersionId) && botVersionId > 0;

  const versionQuery = useQuery({
    queryKey: ["bot-version-detail", botVersionId],
    queryFn: () => getBotVersion(botVersionId),
    enabled: validId,
  });

  const botsQuery = useQuery({
    queryKey: ["bots-select-for-version-detail"],
    queryFn: () => listAllBots(),
  });

  const botName = useMemo(() => {
    if (!versionQuery.data?.bot_id) return "---";
    const bot = (botsQuery.data?.items ?? []).find((item) => item.id === versionQuery.data?.bot_id);
    return bot?.name ?? `Bot #${versionQuery.data.bot_id}`;
  }, [versionQuery.data, botsQuery.data]);

  function handleRefresh() {
    versionQuery.refetch();
    botsQuery.refetch();
  }

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Versão do bot" backTo="/bot-versions" backLabel="Voltar para versões" />
        <EmptyState
          icon={GitCommitHorizontal}
          title="ID de versão inválido"
          description="O endereço não aponta para uma versão existente."
          action={
            <button type="button" onClick={() => navigate("/bot-versions")} className={btn.secondary}>
              Ver versões
            </button>
          }
        />
      </section>
    );
  }

  const version = versionQuery.data;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/bot-versions"
          backLabel="Voltar para versões"
          title={version ? `${botName} · ${version.version}` : `Versão #${botVersionId}`}
          description="Commit, autor e changelog registrados para esta versão."
          meta={
            version ? (
              <>
                {version.in_use ? (
                  <span className={cn(badge, tone.success)} title={version.pinned ? "Fixada por Release" : "Versão mais nova"}>
                    {version.pinned ? "Em uso (Release)" : "Em uso"}
                  </span>
                ) : null}
                <span className={cn(badge, version.is_active ? tone.info : tone.neutral)}>
                  {version.is_active ? "Ativa" : "Inativa"}
                </span>
              </>
            ) : null
          }
          actions={
            <RefreshIndicator
              updatedAt={versionQuery.dataUpdatedAt}
              isFetching={versionQuery.isFetching}
              onRefresh={handleRefresh}
            />
          }
        />

        <div className={cn(cardBody, "space-y-5")}>
          {versionQuery.isLoading ? (
            <DetailSkeleton fields={8} />
          ) : versionQuery.isError ? (
            <QueryError
              error={versionQuery.error}
              what="a versão"
              onRetry={() => versionQuery.refetch()}
              retrying={versionQuery.isFetching}
            />
          ) : version ? (
            <>
              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Commit (Git)</h2>
                </div>
                <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
                  <InfoItem
                    label="Commit"
                    value={
                      version.commit_hash ? (
                        <span className="inline-flex items-center gap-2 font-mono">
                          <GitCommitHorizontal className="h-4 w-4 text-slate-400" />
                          {version.commit_hash.slice(0, 7)}
                        </span>
                      ) : (
                        "---"
                      )
                    }
                  />
                  <InfoItem label="Branch" value={version.branch || "---"} />
                  <InfoItem label="Autor do commit" value={version.commit_author || "---"} />
                  <InfoItem label="Data do commit" value={formatDateTime(version.committed_at)} />
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Changelog</h2>
                </div>
                <div className={cardBody}>
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-sans text-sm text-slate-700">
                    {version.changelog || "---"}
                  </pre>
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Detalhes técnicos</h2>
                </div>
                <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
                  <InfoItem label="ID" value={String(version.id)} />
                  <InfoItem label="Bot" value={botName} />
                  <InfoItem label="Storage" value={version.storage_type} />
                  <InfoItem label="Criado por" value={version.created_by ? String(version.created_by) : "---"} />
                  <InfoItem label="Criada em" value={formatDateTime(version.created_at)} />
                  <InfoItem label="Atualizada em" value={formatDateTime(version.updated_at)} />
                  <div className="md:col-span-2">
                    <InfoItem
                      label="Artifact path"
                      value={<span className="break-all font-mono text-xs">{version.artifact_path || "---"}</span>}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <InfoItem
                      label="Checksum"
                      value={<span className="break-all font-mono text-xs">{version.checksum || "---"}</span>}
                    />
                  </div>
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
