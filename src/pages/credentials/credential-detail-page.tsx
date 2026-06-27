import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, Pencil, RefreshCcw, ShieldCheck } from "lucide-react";

import { getCredential } from "@/services/api/credentials";
import { listRepositories } from "@/services/api/repositories";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatActive(value: boolean) {
  return value ? "Ativa" : "Inativa";
}

export function CredentialDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ credentialId: string }>();

  const credentialId = Number(params.credentialId);

  const credentialQuery = useQuery({
    queryKey: ["credential-detail", credentialId],
    queryFn: () => getCredential(credentialId),
    enabled: Number.isFinite(credentialId) && credentialId > 0,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories({ active: true }),
  });

  const repositoryName = useMemo(() => {
    if (!credentialQuery.data?.repository_id) return "---";

    const repo = (repositoriesQuery.data ?? []).find(
      (item) => item.id === credentialQuery.data?.repository_id
    );

    return repo?.name ?? `Repositório #${credentialQuery.data.repository_id}`;
  }, [credentialQuery.data, repositoriesQuery.data]);

  function handleRefresh() {
    credentialQuery.refetch();
    repositoriesQuery.refetch();
  }

  if (!Number.isFinite(credentialId) || credentialId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de credencial inválido.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/credentials")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para credenciais
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes da Credencial #{credentialId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualização completa do cadastro e dos segredos protegidos.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>

              <button
                type="button"
                onClick={() => navigate(`/credentials/${credentialId}/edit`)}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {credentialQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando credencial...</p>
          ) : credentialQuery.isError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados da credencial.
            </div>
          ) : credentialQuery.data ? (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="ID" value={String(credentialQuery.data.id)} />
                  <InfoItem
                    label="Label"
                    value={
                      <span className="inline-flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-slate-500" />
                        {credentialQuery.data.label}
                      </span>
                    }
                  />
                  <InfoItem label="Repositório" value={repositoryName} />
                  <InfoItem
                    label="Status"
                    value={formatActive(credentialQuery.data.active)}
                  />
                  <InfoItem
                    label="Criado em"
                    value={formatDateTime(credentialQuery.data.created_at)}
                  />
                  <InfoItem
                    label="Atualizado em"
                    value={formatDateTime(credentialQuery.data.updated_at)}
                  />
                  <InfoItem
                    label="Quantidade de segredos"
                    value={String(credentialQuery.data.items?.length ?? 0)}
                  />
                </div>
              </section>

                <section className="border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Segredos cadastrados
                    </h2>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-slate-50">
                        <tr className="text-left">
                          <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Chave
                          </th>
                          <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Tipo
                          </th>
                          <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Criado em
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {credentialQuery.data.items?.length ? (
                          credentialQuery.data.items.map((item: any) => {
                            const resolvedKey = item.key ?? item.key_name ?? "---";

                            return (
                              <tr
                                key={item.id}
                                className="border-b border-slate-200 hover:bg-slate-50/70"
                              >
                                <td className="px-4 py-3 text-sm text-slate-800">
                                  <span className="inline-flex items-center gap-2 font-medium">
                                    <KeyRound className="h-4 w-4 text-slate-500" />
                                    {resolvedKey}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {item.value_type}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {formatDateTime(item.created_at)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-10 text-center text-sm text-slate-500"
                            >
                              Nenhum segredo cadastrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

            </div>
          ) : null}
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
      <div className="mt-1 text-sm text-slate-800 break-words">{value}</div>
    </div>
  );
}
