import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCcw } from "lucide-react";

import { getBotVersion } from "@/services/api/bot-versions";
import { listBots } from "@/services/api/bots";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatActive(value: boolean) {
  return value ? "Ativo" : "Inativo";
}

export function BotVersionDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ botVersionId: string }>();

  const botVersionId = Number(params.botVersionId);

  const versionQuery = useQuery({
    queryKey: ["bot-version-detail", botVersionId],
    queryFn: () => getBotVersion(botVersionId),
    enabled: Number.isFinite(botVersionId) && botVersionId > 0,
  });

  const botsQuery = useQuery({
    queryKey: ["bots-select-for-version-detail"],
    queryFn: () => listBots({ skip: 0, limit: 1000 }),
  });

  const botName = useMemo(() => {
    if (!versionQuery.data?.bot_id) return "---";

    const bot = (botsQuery.data?.items ?? []).find(
      (item) => item.id === versionQuery.data?.bot_id
    );

    return bot?.name ?? `Bot #${versionQuery.data.bot_id}`;
  }, [versionQuery.data, botsQuery.data]);

  function handleRefresh() {
    versionQuery.refetch();
    botsQuery.refetch();
  }

  if (!Number.isFinite(botVersionId) || botVersionId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de versão inválido.
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
                onClick={() => navigate("/bot-versions")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para versões
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes da Versão #{botVersionId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualização completa do cadastro da versão do bot.
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
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {versionQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando versão...</p>
          ) : versionQuery.isError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados da versão.
            </div>
          ) : versionQuery.data ? (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="ID" value={String(versionQuery.data.id)} />
                  <InfoItem label="Bot" value={botName} />
                  <InfoItem label="Versão" value={versionQuery.data.version} />
                  <InfoItem label="Storage" value={versionQuery.data.storage_type} />
                  <InfoItem
                    label="Status"
                    value={formatActive(versionQuery.data.is_active)}
                  />
                  <InfoItem
                    label="Criado por"
                    value={
                      versionQuery.data.created_by
                        ? String(versionQuery.data.created_by)
                        : "---"
                    }
                  />
                  <InfoItem
                    label="Criado em"
                    value={formatDateTime(versionQuery.data.created_at)}
                  />
                  <InfoItem
                    label="Atualizado em"
                    value={formatDateTime(versionQuery.data.updated_at)}
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Configuração
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                  <InfoBlock
                    label="Artifact path"
                    value={versionQuery.data.artifact_path || "---"}
                  />
                  <InfoBlock
                    label="Checksum"
                    value={versionQuery.data.checksum || "---"}
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Changelog
                  </h2>
                </div>

                <div className="px-5 py-5">
                  <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {versionQuery.data.changelog || "---"}
                  </div>
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

function InfoBlock({
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
      <div className="mt-1 border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 break-words">
        {value}
      </div>
    </div>
  );
}
