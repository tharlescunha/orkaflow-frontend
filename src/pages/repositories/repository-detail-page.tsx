import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, RefreshCcw } from "lucide-react";

import { getRepository } from "@/services/api/repositories";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getActiveClass(active: boolean) {
  return active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-600";
}

export function RepositoryDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ repositoryId: string }>();
  const repositoryId = Number(params.repositoryId);

  const repositoryQuery = useQuery({
    queryKey: ["repository-detail", repositoryId],
    queryFn: () => getRepository(repositoryId),
    enabled: Number.isFinite(repositoryId) && repositoryId > 0,
    refetchInterval: 10000,
  });

  function handleRefresh() {
    repositoryQuery.refetch();
  }

  if (!Number.isFinite(repositoryId) || repositoryId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de repositório inválido.
          </div>
        </section>
      </div>
    );
  }

  const repository = repositoryQuery.data;

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/repositories")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para repositórios
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes do Repositório #{repositoryId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Informações cadastrais do repositório.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/repositories/${repositoryId}/edit`)}
                className="inline-flex h-10 items-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {repositoryQuery.isLoading ? (
            <p className="text-sm text-slate-500">
              Carregando repositório...
            </p>
          ) : repositoryQuery.isError || !repository ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados do repositório.
            </div>
          ) : (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Resumo do repositório
                </h2>
              </div>

              <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                <InfoItem label="ID" value={repository.id} />
                <InfoItem label="Nome" value={repository.name} />
                <InfoItem
                  label="Ativo"
                  value={
                    <span
                      className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getActiveClass(
                        repository.active
                      )}`}
                    >
                      {repository.active ? "Ativo" : "Inativo"}
                    </span>
                  }
                />
                <InfoItem
                  label="Criado em"
                  value={formatDateTime(repository.created_at)}
                />
                <InfoItem
                  label="Atualizado em"
                  value={formatDateTime(repository.updated_at)}
                />
                <div className="md:col-span-2 xl:col-span-4">
                  <InfoItem
                    label="Descrição"
                    value={
                      <div className="whitespace-pre-wrap break-words">
                        {repository.description || "---"}
                      </div>
                    }
                  />
                </div>
              </div>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}

