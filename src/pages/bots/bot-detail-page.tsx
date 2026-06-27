import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Monitor, Pencil, RefreshCcw, Server } from "lucide-react";

import { getBot } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";

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

function formatExecutionMode(value?: string | null) {
  if (!value) return "---";

  const normalized = value.trim().toLowerCase();

  if (normalized === "background") return "Background";
  if (normalized === "foreground") return "Foreground";

  return value;
}

function getExecutionModeDescription(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "background") {
    return {
      title: "Execução em background",
      description:
        "Este bot executa em segundo plano, sem depender de interação visual com a tela do usuário. É o modo mais indicado para rotinas de API, processamento interno, integrações, leitura e escrita de arquivos, banco de dados e execuções silenciosas no worker.",
      icon: Server,
      badgeClassName:
        "border border-emerald-200 bg-emerald-50 text-emerald-700",
      panelClassName: "border border-emerald-200 bg-emerald-50/50",
    };
  }

  if (normalized === "foreground") {
    return {
      title: "Execução em foreground",
      description:
        "Este bot executa com interação na área de trabalho da máquina, podendo depender de tela ativa, sessão de usuário logada, foco de janela, cliques, digitação e automações visuais. É o modo indicado para bots RPA que precisam abrir e operar sistemas locais ou aplicações com interface gráfica.",
      icon: Monitor,
      badgeClassName: "border border-amber-200 bg-amber-50 text-amber-700",
      panelClassName: "border border-amber-200 bg-amber-50/50",
    };
  }

  return {
    title: "Tipo de execução não identificado",
    description:
      "O tipo de execução foi retornado pela API, mas não possui uma descrição configurada na tela. Verifique o valor recebido e padronize os modos suportados no frontend.",
    icon: Server,
    badgeClassName: "border border-slate-200 bg-slate-100 text-slate-700",
    panelClassName: "border border-slate-200 bg-slate-50",
  };
}

export function BotDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ botId: string }>();

  const botId = Number(params.botId);

  const botQuery = useQuery({
    queryKey: ["bot-detail", botId],
    queryFn: () => getBot(botId),
    enabled: Number.isFinite(botId) && botId > 0,
  });

  const repositoriesQuery = useQuery({
    queryKey: ["repositories-options"],
    queryFn: () => listRepositories(true),
  });

  const repositoryName = useMemo(() => {
    if (botQuery.data?.repository_name) return botQuery.data.repository_name;

    if (!botQuery.data?.repository_id) return "---";

    const repo = (repositoriesQuery.data ?? []).find(
      (item) => item.id === botQuery.data?.repository_id
    );

    return repo?.name ?? `Repositório #${botQuery.data.repository_id}`;
  }, [botQuery.data, repositoriesQuery.data]);

  const executionModeInfo = useMemo(
    () => getExecutionModeDescription(botQuery.data?.execution_mode),
    [botQuery.data?.execution_mode]
  );

  function handleRefresh() {
    botQuery.refetch();
    repositoriesQuery.refetch();
  }

  if (!Number.isFinite(botId) || botId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de bot inválido.
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
                onClick={() => navigate("/bots")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para bots
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes do Bot #{botId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Visualização completa do cadastro e da configuração do bot.
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
                onClick={() => navigate(`/bots/${botId}/edit`)}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-6">
          {botQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando bot...</p>
          ) : botQuery.isError ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados do bot.
            </div>
          ) : botQuery.data ? (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="ID" value={String(botQuery.data.id)} />
                  <InfoItem label="Nome" value={botQuery.data.name} />
                  <InfoItem label="Repositório" value={repositoryName} />
                  <InfoItem label="Tecnologia" value={botQuery.data.technology} />
                  <InfoItem
                    label="Versão atual"
                    value={botQuery.data.current_version || "---"}
                  />
                  <InfoItem
                    label="Versão lançamento"
                    value={botQuery.data.release_version || "---"}
                  />
                  <InfoItem
                    label="Status"
                    value={formatActive(botQuery.data.active)}
                  />
                  <InfoItem
                    label="Criado em"
                    value={formatDateTime(botQuery.data.created_at)}
                  />
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Descrição
                  </h2>
                </div>

                <div className="px-5 py-5">
                  <div className="whitespace-pre-wrap break-words border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {botQuery.data.description || "---"}
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Configuração
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem
                    label="Tipo de origem"
                    value={botQuery.data.source_type}
                  />
                  <InfoItem
                    label="Entrypoint"
                    value={botQuery.data.entrypoint}
                  />
                  <InfoItem
                    label="Requirements"
                    value={botQuery.data.requirements_file || "---"}
                  />
                  <InfoItem
                    label="Timeout padrão"
                    value={`${botQuery.data.timeout_default}s`}
                  />
                </div>

                <div className="px-5">
                  <InfoItem
                    label="Tipo de execução"
                    value={
                      <span
                        className={`inline-flex items-center rounded-sm px-2.5 py-1 text-xs font-semibold ${executionModeInfo.badgeClassName}`}
                      >
                        {formatExecutionMode(botQuery.data.execution_mode)}
                      </span>
                    }
                  />
                </div>

                <div className="px-5 py-5">
                  <div
                    className={`flex gap-3 px-4 py-3 text-sm text-slate-700 ${executionModeInfo.panelClassName}`}
                  >
                    <executionModeInfo.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">
                        {executionModeInfo.title}
                      </p>
                      <p className="mt-1 leading-6 text-slate-700">
                        {executionModeInfo.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <InfoBlock
                    label="URL de origem"
                    value={botQuery.data.source_url || "---"}
                  />
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
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
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
      <div className="mt-1 break-words border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        {value}
      </div>
    </div>
  );
}
