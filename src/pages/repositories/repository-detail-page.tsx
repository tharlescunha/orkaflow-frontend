import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { EMPTY, formatDateTime } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getRepository } from "@/services/api/repositories";

const REFETCH_MS = 10000;
const BACK_TO = "/repositories";
const BACK_LABEL = "Voltar para repositórios";

export function RepositoryDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ repositoryId: string }>();
  const repositoryId = Number(params.repositoryId);
  const validId = Number.isFinite(repositoryId) && repositoryId > 0;

  const repositoryQuery = useQuery({
    queryKey: ["repository-detail", repositoryId],
    queryFn: () => getRepository(repositoryId),
    enabled: validId,
    refetchInterval: REFETCH_MS,
  });

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Repositório" backTo={BACK_TO} backLabel={BACK_LABEL} />
        <div className="p-5">
          <QueryError error={new Error("ID de repositório inválido.")} what="o repositório" />
        </div>
      </section>
    );
  }

  if (repositoryQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Repositório" backTo={BACK_TO} backLabel={BACK_LABEL} />
        <div className="p-5">
          <DetailSkeleton fields={4} />
        </div>
      </section>
    );
  }

  if (repositoryQuery.isError || !repositoryQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Repositório" backTo={BACK_TO} backLabel={BACK_LABEL} />
        <div className="p-5">
          <QueryError
            error={repositoryQuery.error}
            what="o repositório"
            onRetry={() => repositoryQuery.refetch()}
            retrying={repositoryQuery.isFetching}
          />
        </div>
      </section>
    );
  }

  const repository = repositoryQuery.data;

  return (
    <section className={card}>
      <PageHeader
        title={repository.name}
        description={`Repositório #${repository.id}`}
        backTo={BACK_TO}
        backLabel={BACK_LABEL}
        meta={
          <span className={cn(badge, repository.active ? tone.success : tone.neutral)}>
            {repository.active ? "Ativo" : "Inativo"}
          </span>
        }
        actions={
          <>
            <RefreshIndicator
              updatedAt={repositoryQuery.dataUpdatedAt}
              isFetching={repositoryQuery.isFetching}
              onRefresh={() => repositoryQuery.refetch()}
              intervalMs={REFETCH_MS}
            />
            <button type="button" onClick={() => navigate(`/repositories/${repositoryId}/edit`)} className={btn.primary}>
              <Pencil className="h-4 w-4" />
              Editar
            </button>
          </>
        }
      />

      <div className="space-y-5 p-5">
        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Descrição</h2>
          </div>
          <div className={cardBody}>
            {repository.description ? (
              <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{repository.description}</p>
            ) : (
              <p className="text-sm text-slate-500">Sem descrição.</p>
            )}
          </div>
        </section>

        <section className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Detalhes técnicos</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2 xl:grid-cols-4")}>
            <InfoItem label="ID" value={String(repository.id)} />
            <InfoItem label="Status" value={repository.active ? "Ativo" : "Inativo"} />
            <InfoItem label="Criado em" value={formatDateTime(repository.created_at)} />
            <InfoItem label="Atualizado em" value={repository.updated_at ? formatDateTime(repository.updated_at) : EMPTY} />
          </div>
        </section>
      </div>
    </section>
  );
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}
