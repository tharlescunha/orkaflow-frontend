import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Link2Off, Monitor, Pencil, Power, Server, Trash2, X } from "lucide-react";

import {
  activateRunner,
  disableRunner,
  getRunnerScreenshotBlobUrl,
  listRunners,
  removeRunner,
  type RunnerRead,
} from "@/services/api/runners";
import { getRunnerHealth, getRunnerStatusText } from "@/lib/health";
import { RunnerBadges, RunnerHeartbeatText } from "@/components/common/runner-badges";
import { PageHeader } from "@/components/common/page-header";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { QueryError } from "@/components/common/query-error";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ActionsMenu } from "@/components/common/actions-menu";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { CardSkeleton } from "@/components/common/skeleton";
import { toast } from "@/store/toast-store";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDateTime } from "@/lib/format";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, select, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

type EnabledFilter = "true" | "false" | "all" | "removed";

type ConfirmAction = { runner: RunnerRead; action: "toggle" | "remove" } | null;

const REFRESH_MS = 10_000;

// Tom do badge de status do runner (online/offline/sem sinal...).
function getRunnerStatusTone(runner: RunnerRead): keyof typeof tone {
  if (getRunnerHealth(runner).noSignal) return "danger";

  switch ((runner.status || "").toLowerCase()) {
    case "online":
      return "success";
    case "busy":
      return "info";
    case "maintenance":
      return "warning";
    case "blocked":
    case "offline":
      return "danger";
    default:
      return "neutral";
  }
}

function getRunnerDisplayName(runner: RunnerRead) {
  return runner.name?.replace(/^Automacao_/i, "") || `Runner ${runner.id}`;
}

function canShowScreenshot(runner: RunnerRead) {
  return Boolean(runner.has_screenshot);
}

export function RunnersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("true");
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [previewRunner, setPreviewRunner] = useState<RunnerRead | null>(null);

  const queryParams = useMemo(() => {
    if (enabledFilter === "removed") {
      return { skip: 0, limit: 100, removed: true };
    }

    return {
      skip: 0,
      limit: 100,
      enabled: enabledFilter === "all" ? undefined : enabledFilter === "true",
    };
  }, [enabledFilter]);

  const runnersQuery = useQuery({
    queryKey: ["runners-page", queryParams],
    queryFn: () => listRunners(queryParams),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["runners-page"] });
    queryClient.invalidateQueries({ queryKey: ["runners"] });
    queryClient.invalidateQueries({ queryKey: ["health"] });
  }

  const activateMutation = useMutation({
    mutationFn: (runnerId: number) => activateRunner(runnerId),
    onSuccess: () => {
      toast.success("Runner ativado.");
      invalidate();
      setConfirm(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível ativar o runner.")),
  });

  const disableMutation = useMutation({
    mutationFn: (runnerId: number) => disableRunner(runnerId),
    onSuccess: () => {
      toast.success("Runner desativado.");
      invalidate();
      setConfirm(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível desativar o runner.")),
  });

  const removeMutation = useMutation({
    mutationFn: (runnerId: number) => removeRunner(runnerId),
    onSuccess: () => {
      toast.success('Runner removido. Ele continua em "Removidos (histórico)".');
      invalidate();
      setConfirm(null);
    },
    onError: (error) => {
      // Fecha o diálogo para o aviso (ex.: task em execução) ficar visível.
      toast.error(getApiErrorMessage(error, "Não foi possível remover o runner."));
      setConfirm(null);
    },
  });

  function handleConfirm() {
    if (!confirm) return;

    if (confirm.action === "remove") {
      removeMutation.mutate(confirm.runner.id);
      return;
    }

    if (confirm.runner.enabled) {
      disableMutation.mutate(confirm.runner.id);
      return;
    }

    activateMutation.mutate(confirm.runner.id);
  }

  const isSubmitting = activateMutation.isPending || disableMutation.isPending || removeMutation.isPending;

  const runners = useMemo(() => {
    const list = runnersQuery.data ?? [];
    const q = normalizeSearch(search);
    if (!q) return list;
    return list.filter((runner) =>
      normalizeSearch(`${runner.name ?? ""} ${runner.label ?? ""} ${runner.host_name ?? ""} ${runner.ip ?? ""}`).includes(q)
    );
  }, [runnersQuery.data, search]);

  const hasActiveFilters = enabledFilter !== "true" || search.trim() !== "";
  const confirmRunner = confirm?.action === "toggle" ? confirm.runner : null;

  function clearFilters() {
    setEnabledFilter("true");
    setSearch("");
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Runners"
          description="Acompanhe as máquinas cadastradas e abra os detalhes de cada uma."
          actions={
            <RefreshIndicator
              updatedAt={runnersQuery.dataUpdatedAt}
              isFetching={runnersQuery.isFetching}
              onRefresh={() => runnersQuery.refetch()}
              intervalMs={REFRESH_MS}
            />
          }
        />

        <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, host ou IP" />
          <select
            value={enabledFilter}
            onChange={(e) => setEnabledFilter(e.target.value as EnabledFilter)}
            className={cn(select, "w-56")}
            aria-label="Filtrar por situação"
          >
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
            <option value="all">Todos</option>
            <option value="removed">Removidos (histórico)</option>
          </select>
        </FilterBar>

        <div className="p-5">
          {runnersQuery.isLoading ? (
            <CardSkeleton count={6} />
          ) : runnersQuery.isError ? (
            <QueryError
              error={runnersQuery.error}
              what="os runners"
              onRetry={() => runnersQuery.refetch()}
              retrying={runnersQuery.isFetching}
            />
          ) : runners.length === 0 ? (
            <EmptyState
              icon={Server}
              title={enabledFilter === "removed" ? "Nenhum runner removido" : "Nenhum runner encontrado"}
              description={
                hasActiveFilters
                  ? "Nenhum runner combina com os filtros."
                  : "Configure uma máquina com o configurar_worker.bat para ela aparecer aqui."
              }
              action={
                hasActiveFilters ? (
                  <button type="button" className={btn.secondary} onClick={clearFilters}>
                    Limpar filtros
                  </button>
                ) : (
                  <button type="button" className={btn.primary} onClick={() => navigate("/worker-registration")}>
                    Guia do bot
                  </button>
                )
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {runners.map((runner) => (
                <RunnerCard
                  key={runner.id}
                  runner={runner}
                  onOpen={() => navigate(`/runners/${runner.id}`)}
                  onPreview={() => setPreviewRunner(runner)}
                  onEdit={() => navigate(`/runner-configs/${runner.id}/edit`)}
                  onToggle={() => setConfirm({ runner, action: "toggle" })}
                  onRemove={() => setConfirm({ runner, action: "remove" })}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <ScreenshotPreviewModal runner={previewRunner} onClose={() => setPreviewRunner(null)} />

      <ConfirmDialog
        open={confirm?.action === "remove"}
        title="Remover runner"
        tone="danger"
        description={
          confirm
            ? `Runner: ${confirm.runner.name}\n\n` +
              "Ele some das telas de Runners e Config. Runners, é desvinculado das automações " +
              "e não recebe mais tasks. O histórico das execuções continua com o nome dele.\n\n" +
              "Se a máquina for configurada de novo (configurar_worker.bat), ela volta."
            : ""
        }
        confirmLabel="Remover"
        isPending={isSubmitting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />

      <ConfirmDialog
        open={Boolean(confirmRunner)}
        title={confirmRunner?.enabled ? "Desativar runner" : "Ativar runner"}
        tone={confirmRunner?.enabled ? "warning" : "default"}
        description={
          confirmRunner
            ? `Runner: ${confirmRunner.name}\n\n${
                confirmRunner.enabled
                  ? "Ele para de receber tasks até ser ativado de novo."
                  : "Ele volta a receber tasks das automações vinculadas."
              }`
            : ""
        }
        confirmLabel={confirmRunner?.enabled ? "Desativar" : "Ativar"}
        isPending={isSubmitting}
        onCancel={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function RunnerCard({
  runner,
  onOpen,
  onPreview,
  onEdit,
  onToggle,
  onRemove,
}: {
  runner: RunnerRead;
  onOpen: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const displayName = getRunnerDisplayName(runner);
  const showScreenshot = canShowScreenshot(runner);
  const removed = Boolean(runner.deleted_at);

  return (
    <div className={cn(card, "group relative overflow-hidden transition hover:shadow-md")}>
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="relative aspect-video overflow-hidden bg-slate-100">
          {showScreenshot ? (
            <RunnerScreenshotImage runner={runner} displayName={displayName} className="h-full w-full object-cover" />
          ) : (
            <ScreenshotEmptyState />
          )}
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900" title={displayName}>
              {displayName}
            </h3>
            <span className={cn(badge, tone[getRunnerStatusTone(runner)], "shrink-0")}>{getRunnerStatusText(runner)}</span>
          </div>

          <div className="mt-2 space-y-1.5">
            {removed ? (
              <p className="text-xs font-medium text-slate-500">Removido em {formatDateTime(runner.deleted_at)}</p>
            ) : (
              <>
                <RunnerBadges runner={runner} />
                <p className="text-xs">
                  <RunnerHeartbeatText runner={runner} />
                </p>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="absolute right-2 top-2 z-20">
        <ActionsMenu
          className="h-8 w-8 bg-white/90"
          items={[
            { label: "Ver detalhes", icon: Eye, onSelect: onOpen },
            ...(removed
              ? []
              : [
                  { label: "Editar configuração", icon: Pencil, onSelect: onEdit },
                  {
                    label: runner.enabled ? "Desativar" : "Ativar",
                    icon: Power,
                    tone: runner.enabled ? ("default" as const) : ("success" as const),
                    onSelect: onToggle,
                  },
                  { label: "Remover", icon: Trash2, tone: "danger" as const, separatorBefore: true, onSelect: onRemove },
                ]),
          ]}
        />
      </div>

      {showScreenshot && (
        <div className="absolute left-2 top-2 z-20 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPreview();
            }}
            className={cn(btn.secondary, btn.sm, "bg-white/90")}
          >
            <Eye className="h-3.5 w-3.5" />
            Ampliar
          </button>
        </div>
      )}
    </div>
  );
}

function RunnerScreenshotImage({
  runner,
  displayName,
  className,
}: {
  runner: RunnerRead;
  displayName: string;
  className: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const loadedKeyRef = useRef<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const imageKey = `${runner.id}-${runner.last_screenshot_at || "last"}`;

    if (loadedKeyRef.current === imageKey && src) {
      return;
    }

    let cancelled = false;

    async function loadImage() {
      try {
        setHasError(false);

        const url = await getRunnerScreenshotBlobUrl(runner.id);

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        objectUrlRef.current = url;
        loadedKeyRef.current = imageKey;
        setSrc(url);
      } catch {
        if (!cancelled) {
          setHasError(true);
        }
      }
    }

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [runner.id, runner.last_screenshot_at, src]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  if (hasError) {
    return <ScreenshotEmptyState />;
  }

  if (!src) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
        <Monitor className="h-12 w-12" strokeWidth={1.7} />
        <span className="mt-2 text-xs font-medium">Carregando imagem...</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Screenshot do runner ${displayName}`}
      className={className}
      draggable={false}
      onError={() => setHasError(true)}
    />
  );
}

function ScreenshotEmptyState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
      <Link2Off className="h-12 w-12" strokeWidth={1.7} />
      <span className="mt-2 text-xs font-medium">Imagem indisponível</span>
    </div>
  );
}

function ScreenshotPreviewModal({ runner, onClose }: { runner: RunnerRead | null; onClose: () => void }) {
  useEffect(() => {
    if (!runner) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [runner, onClose]);

  if (!runner) return null;

  const displayName = getRunnerDisplayName(runner);
  const showScreenshot = canShowScreenshot(runner);

  return createPortal(
    <div className="fixed inset-0 z-[9000]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900" title={displayName}>
                {displayName}
              </h2>
              <p className="text-xs text-slate-500">Screenshot do runner</p>
            </div>

            <button type="button" onClick={onClose} className={btn.icon} aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-[420px] items-center justify-center bg-slate-100 p-6">
            {showScreenshot ? (
              <RunnerScreenshotImage
                runner={runner}
                displayName={displayName}
                className="mx-auto max-h-[76vh] w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                <Link2Off className="h-20 w-20" strokeWidth={1.5} />
                <span className="mt-4 text-sm font-medium">Imagem indisponível</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
