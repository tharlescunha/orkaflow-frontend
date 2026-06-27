import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Link2,
  RefreshCcw,
  Server,
  Unlink,
  X,
  XCircle,
} from "lucide-react";

import {
  getAutomation,
  linkRunnerToAutomation,
  listAutomationRunners,
  unlinkRunnerFromAutomation,
  type AutomationRunnerRead,
} from "@/services/api/automations";
import { listRunners, type RunnerRead } from "@/services/api/runners";

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatRunnerStatus(status?: string | null) {
  switch ((status || "").toLowerCase()) {
    case "online":
      return "Online";
    case "offline":
      return "Offline";
    case "busy":
      return "Ocupado";
    case "maintenance":
      return "Manutenção";
    case "blocked":
      return "Bloqueado";
    default:
      return status || "---";
  }
}

function getEnabledClass(enabled: boolean) {
  return enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-red-200 bg-red-50 text-red-600";
}

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

export function AutomationDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ automationId: string }>();
  const automationId = Number(params.automationId);
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<ToastState>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedRunnerId, setSelectedRunnerId] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<AutomationRunnerRead | null>(null);

  const automationQuery = useQuery({
    queryKey: ["automation-detail", automationId],
    queryFn: () => getAutomation(automationId),
    enabled: Number.isFinite(automationId) && automationId > 0,
  });

  const linkedRunnersQuery = useQuery({
    queryKey: ["automation-runners", automationId],
    queryFn: () => listAutomationRunners(automationId),
    enabled: Number.isFinite(automationId) && automationId > 0,
  });

  const runnersQuery = useQuery({
    queryKey: ["automation-runners-all"],
    queryFn: () => listRunners({ limit: 500, skip: 0 }),
  });

  const linkMutation = useMutation({
    mutationFn: (runnerId: number) => linkRunnerToAutomation(automationId, runnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-runners", automationId] });
      setIsLinkModalOpen(false);
      setSelectedRunnerId("");
      setToast({
        type: "success",
        message: "Runner vinculado com sucesso.",
      });
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível vincular o runner.",
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (linkId: number) => unlinkRunnerFromAutomation(automationId, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-runners", automationId] });
      setUnlinkTarget(null);
      setToast({
        type: "success",
        message: "Runner desvinculado com sucesso.",
      });
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível desvincular o runner.",
      });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const linkedRunners = linkedRunnersQuery.data ?? [];
  const allRunners = runnersQuery.data ?? [];

  const availableRunners = useMemo(() => {
    const linkedRunnerIds = new Set(linkedRunners.map((item) => item.runner_id));
    return allRunners.filter((runner) => !linkedRunnerIds.has(runner.id));
  }, [allRunners, linkedRunners]);

  function handleRefresh() {
    automationQuery.refetch();
    linkedRunnersQuery.refetch();
  }

  function handleConfirmLink() {
    if (!selectedRunnerId) return;
    linkMutation.mutate(Number(selectedRunnerId));
  }

  function handleConfirmUnlink() {
    if (!unlinkTarget) return;
    unlinkMutation.mutate(unlinkTarget.id);
  }

  if (!Number.isFinite(automationId) || automationId <= 0) {
    return (
      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-10 text-sm text-red-600">
            ID de automação inválido.
          </div>
        </section>
      </div>
    );
  }

  const automation = automationQuery.data;

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`fixed right-6 top-20 z-[80] flex items-start gap-3 border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="pr-4 text-sm font-medium">{toast.message}</div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 transition hover:text-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/automations")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para automações
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Detalhes da Automação #{automationId}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Informações gerais e runners vinculados.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/automations/${automationId}/edit`)}
                className="inline-flex h-10 items-center border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
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
          {automationQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando automação...</p>
          ) : automationQuery.isError || !automation ? (
            <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Não foi possível carregar os dados da automação.
            </div>
          ) : (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="ID" value={automation.id} icon={Bot} />
                <MetricCard
                  title="Repositório"
                  value={automation.repository_name || "---"}
                  icon={Server}
                />
                <MetricCard
                  title="Bot"
                  value={automation.bot_name || "---"}
                  icon={Bot}
                />
                <MetricCard
                  title="Status"
                  value={automation.active ? "Ativa" : "Inativa"}
                  icon={Link2}
                />
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Resumo da automação
                  </h2>
                </div>

                <div className="grid gap-5 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <InfoItem label="Nome" value={automation.name} />
                  <InfoItem label="Label" value={automation.label || "---"} />
                  <InfoItem
                    label="Repositório"
                    value={automation.repository_name || `#${automation.repository_id}`}
                  />
                  <InfoItem label="Bot" value={automation.bot_name || `#${automation.bot_id}`} />
                  <InfoItem label="ID do repositório" value={automation.repository_id} />
                  <InfoItem label="ID do bot" value={automation.bot_id} />
                  <InfoItem label="Prioridade padrão" value={automation.default_priority} />
                  <InfoItem
                    label="Ativa"
                    value={
                      <span
                        className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getEnabledClass(
                          automation.active
                        )}`}
                      >
                        {automation.active ? "Ativa" : "Inativa"}
                      </span>
                    }
                  />
                  <InfoItem label="Criada em" value={formatDateTime(automation.created_at)} />
                  <InfoItem
                    label="Atualizada em"
                    value={formatDateTime(automation.updated_at)}
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
                  <div className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {automation.description || "---"}
                  </div>
                </div>
              </section>

              <section className="border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Runners vinculados
                  </h2>

                  <button
                    type="button"
                    onClick={() => setIsLinkModalOpen(true)}
                    className="inline-flex h-10 items-center gap-2 border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    <Link2 className="h-4 w-4" />
                    Vincular runner
                  </button>
                </div>

                <div className="overflow-x-auto">
                  {linkedRunnersQuery.isLoading ? (
                    <div className="px-5 py-6 text-sm text-slate-500">
                      Carregando runners vinculados...
                    </div>
                  ) : linkedRunnersQuery.isError ? (
                    <div className="px-5 py-6 text-sm text-red-600">
                      Não foi possível carregar os runners vinculados.
                    </div>
                  ) : linkedRunners.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-500">
                      Nenhum runner vinculado.
                    </div>
                  ) : (
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Runner
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Label
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Status
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Ativo
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Ações
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {linkedRunners.map((link) => (
                          <tr key={link.id} className="border-b border-slate-200">
                            <td className="px-4 py-3 text-sm text-slate-800">
                              {link.runner_name || `Runner #${link.runner_id}`}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {link.runner_label || "---"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {formatRunnerStatus(link.runner_status)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span
                                className={`inline-flex min-w-[90px] items-center justify-center rounded-full border px-3 py-1 text-xs font-medium ${getEnabledClass(
                                  Boolean(link.runner_enabled)
                                )}`}
                              >
                                {link.runner_enabled ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setUnlinkTarget(link)}
                                className="inline-flex h-9 items-center gap-2 border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                              >
                                <Unlink className="h-4 w-4" />
                                Desvincular
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      <LinkRunnerModal
        open={isLinkModalOpen}
        runners={availableRunners}
        selectedRunnerId={selectedRunnerId}
        onChangeSelectedRunnerId={setSelectedRunnerId}
        onCancel={() => {
          setIsLinkModalOpen(false);
          setSelectedRunnerId("");
        }}
        onConfirm={handleConfirmLink}
        loading={linkMutation.isPending}
      />

      <ConfirmModal
        open={!!unlinkTarget}
        title="Confirmar desvínculo"
        description={
          unlinkTarget
            ? `Runner: ${unlinkTarget.runner_name || `#${unlinkTarget.runner_id}`}\n\nTem certeza que deseja desvincular este runner da automação?`
            : ""
        }
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={handleConfirmUnlink}
        confirmLabel="Confirmar desvínculo"
        loading={unlinkMutation.isPending}
        danger
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 break-words">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center border border-slate-200 bg-slate-50">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
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

function LinkRunnerModal({
  open,
  runners,
  selectedRunnerId,
  onChangeSelectedRunnerId,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  runners: RunnerRead[];
  selectedRunnerId: string;
  onChangeSelectedRunnerId: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-slate-950/55" onClick={onCancel} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative z-10 w-full max-w-lg border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-950">Vincular runner</h2>
          </div>

          <div className="space-y-4 px-6 py-5">
            {runners.length === 0 ? (
              <div className="text-sm text-slate-500">
                Não há runners disponíveis para vincular.
              </div>
            ) : (
              <label className="block text-slate-900">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Runner disponível
                </span>
                <select
                  value={selectedRunnerId}
                  onChange={(e) => onChangeSelectedRunnerId(e.target.value)}
                  className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                >
                  <option value="">Selecione</option>
                  {runners.map((runner) => (
                    <option key={runner.id} value={runner.id}>
                      {runner.name}
                      {runner.label ? ` - ${runner.label}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading || !selectedRunnerId || runners.length === 0}
              className="inline-flex h-10 items-center gap-2 border border-slate-950 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 className="h-4 w-4" />
              {loading ? "Vinculando..." : "Vincular"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ConfirmModal({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel,
  loading,
  danger = false,
}: {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  loading?: boolean;
  danger?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-slate-950/55" onClick={onCancel} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className="relative z-10 w-full max-w-md border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          </div>

          <div className="px-6 py-5 text-sm whitespace-pre-line text-slate-700">
            {description}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                danger
                  ? "border border-red-600 bg-red-600 hover:bg-red-700"
                  : "border border-emerald-600 bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Processando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
