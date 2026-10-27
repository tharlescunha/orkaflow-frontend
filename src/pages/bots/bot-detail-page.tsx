import { useMemo, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Monitor, Pencil, Server } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { formatDateTime, formatDuration } from "@/lib/format";
import { badge, btn, card, cardBody, cardHeader, cardTitle, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getBot } from "@/services/api/bots";
import { listRepositories } from "@/services/api/repositories";

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
      badgeClassName: tone.success,
      panelClassName: "border-emerald-200 bg-emerald-50/50",
    };
  }

  if (normalized === "foreground") {
    return {
      title: "Execução em foreground",
      description:
        "Este bot executa com interação na área de trabalho da máquina, podendo depender de tela ativa, sessão de usuário logada, foco de janela, cliques, digitação e automações visuais. É o modo indicado para bots RPA que precisam abrir e operar sistemas locais ou aplicações com interface gráfica.",
      icon: Monitor,
      badgeClassName: tone.warning,
      panelClassName: "border-amber-200 bg-amber-50/50",
    };
  }

  return {
    title: "Tipo de execução não identificado",
    description:
      "O tipo de execução foi retornado pela API, mas não possui uma descrição configurada na tela. Verifique o valor recebido e padronize os modos suportados no frontend.",
    icon: Server,
    badgeClassName: tone.neutral,
    panelClassName: "border-slate-200 bg-slate-50",
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
        <section className={card}>
          <PageHeader title="Bot" backTo="/bots" backLabel="Voltar para bots" />
          <div className={cardBody}>
            <EmptyState title="ID de bot inválido" description="Confira o endereço e tente de novo." />
          </div>
        </section>
      </div>
    );
  }

  const bot = botQuery.data;
  const ExecutionModeIcon = executionModeInfo.icon;

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          backTo="/bots"
          backLabel="Voltar para bots"
          title={bot ? bot.name : `Bot #${botId}`}
          description="Cadastro e configuração técnica do bot."
          meta={
            bot ? (
              <>
                <span className={cn(badge, bot.active ? tone.success : tone.neutral)}>
                  {bot.active ? "Ativo" : "Inativo"}
                </span>
                <span className={cn(badge, executionModeInfo.badgeClassName)}>
                  {formatExecutionMode(bot.execution_mode)}
                </span>
              </>
            ) : null
          }
          actions={
            <>
              <RefreshIndicator updatedAt={botQuery.dataUpdatedAt} isFetching={botQuery.isFetching} onRefresh={handleRefresh} />
              <button type="button" onClick={() => navigate(`/bots/${botId}/edit`)} className={btn.primary}>
                <Pencil className="h-4 w-4" />
                Editar
              </button>
            </>
          }
        />

        <div className={cardBody}>
          {botQuery.isLoading ? (
            <DetailSkeleton fields={8} />
          ) : botQuery.isError ? (
            <QueryError error={botQuery.error} what="o bot" onRetry={() => botQuery.refetch()} retrying={botQuery.isFetching} />
          ) : bot ? (
            <div className="space-y-6">
              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Resumo</h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem
                    label="Status"
                    value={
                      <span className={cn(badge, bot.active ? tone.success : tone.neutral)}>
                        {bot.active ? "Ativo" : "Inativo"}
                      </span>
                    }
                  />
                  <InfoItem label="Repositório" value={repositoryName} />
                  <InfoItem label="Versão atual" value={<span className="font-mono">{bot.current_version || "---"}</span>} />
                  <InfoItem label="Versão lançamento" value={<span className="font-mono">{bot.release_version || "---"}</span>} />
                  <InfoItem label="Tecnologia" value={bot.technology} />
                  <InfoItem label="Timeout padrão" value={`${formatDuration(bot.timeout_default)} (${bot.timeout_default}s)`} />
                  <InfoItem
                    label="Atualização automática"
                    value={
                      <span className={cn(badge, bot.auto_update ? tone.info : tone.neutral)}>
                        {bot.auto_update ? "Ligada" : "Desligada"}
                      </span>
                    }
                  />
                  <InfoItem
                    label="Arquivo da task por argumento"
                    value={
                      <span className={cn(badge, bot.reads_task_file_arg === false ? tone.info : tone.neutral)}>
                        {bot.reads_task_file_arg === false ? "Não (usa maestro)" : "Sim (robô antigo)"}
                      </span>
                    }
                  />
                  <InfoItem label="Nome" value={bot.name} />
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Descrição</h2>
                </div>

                <div className={cardBody}>
                  <div className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {bot.description || "---"}
                  </div>
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Configuração</h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="Tipo de origem" value={bot.source_type} />
                  <InfoItem label="Entrypoint" value={<span className="font-mono">{bot.entrypoint}</span>} />
                  <InfoItem label="Requirements" value={<span className="font-mono">{bot.requirements_file || "---"}</span>} />
                  <InfoItem
                    label="Tipo de execução"
                    value={
                      <span className={cn(badge, executionModeInfo.badgeClassName)}>
                        {formatExecutionMode(bot.execution_mode)}
                      </span>
                    }
                  />
                </div>

                <div className="px-5 pb-5">
                  <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm text-slate-700", executionModeInfo.panelClassName)}>
                    <ExecutionModeIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900">{executionModeInfo.title}</p>
                      <p className="mt-1 leading-6 text-slate-700">{executionModeInfo.description}</p>
                    </div>
                  </div>
                </div>

                <div className="px-5 pb-5">
                  <InfoBlock label="URL de origem" value={bot.source_url || "---"} />
                </div>
              </section>

              <section className={card}>
                <div className={cardHeader}>
                  <h2 className={cardTitle}>Detalhes técnicos</h2>
                </div>
                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="ID do bot" value={bot.id} />
                  <InfoItem label="ID do repositório" value={bot.repository_id} />
                  <InfoItem label="Criado em" value={formatDateTime(bot.created_at)} />
                  <InfoItem label="Atualizado em" value={formatDateTime(bot.updated_at)} />
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>
    </div>
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

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800">
        {value}
      </div>
    </div>
  );
}
