import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  Link2Off,
  MoreVertical,
  Monitor,
  Pencil,
  Power,
  RefreshCcw,
  X,
  XCircle,
} from "lucide-react";

import {
  activateRunner,
  disableRunner,
  getRunnerScreenshotBlobUrl,
  listRunners,
  type RunnerRead,
} from "@/services/api/runners";

type EnabledFilter = "true" | "false" | "all";

type MenuState = {
  runner: RunnerRead;
  anchorRect: DOMRect;
} | null;

function getRunnerStatusDotClass(status?: string) {
  switch ((status || "").toLowerCase()) {
    case "online":
    case "busy":
      return "bg-emerald-500";
    case "maintenance":
      return "bg-amber-500";
    case "blocked":
    case "offline":
      return "bg-red-500";
    default:
      return "bg-slate-400";
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
  const [openMenu, setOpenMenu] = useState<MenuState>(null);
  const [confirmRunner, setConfirmRunner] = useState<RunnerRead | null>(null);
  const [previewRunner, setPreviewRunner] = useState<RunnerRead | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(10);

  const queryParams = useMemo(() => {
    return {
      skip: 0,
      limit: 100,
      enabled:
        enabledFilter === "all"
          ? undefined
          : enabledFilter === "true"
          ? true
          : false,
    };
  }, [enabledFilter]);

  const runnersQuery = useQuery({
    queryKey: ["runners-page", queryParams],
    queryFn: () => listRunners(queryParams),
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const activateMutation = useMutation({
    mutationFn: (runnerId: number) => activateRunner(runnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runners-page"] });
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      setConfirmRunner(null);
      setOpenMenu(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: (runnerId: number) => disableRunner(runnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runners-page"] });
      queryClient.invalidateQueries({ queryKey: ["runners"] });
      setConfirmRunner(null);
      setOpenMenu(null);
    },
  });

  useEffect(() => {
    setRefreshCountdown(10);

    const timer = window.setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) return 10;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabledFilter]);

  useEffect(() => {
    setRefreshCountdown(10);
  }, [runnersQuery.dataUpdatedAt]);

  useEffect(() => {
    if (!openMenu) return;

    function handleClose() {
      setOpenMenu(null);
    }

    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);

    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
    };
  }, [openMenu]);

  function handleRefresh() {
    setRefreshCountdown(10);
    runnersQuery.refetch();
  }

  function handleOpenRunner(runner: RunnerRead) {
    navigate(`/runners/${runner.id}`);
  }

  function handleToggleMenu(
    runner: RunnerRead,
    event: React.MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();

    setOpenMenu((prev) => {
      if (prev?.runner.id === runner.id) return null;

      return {
        runner,
        anchorRect: rect,
      };
    });
  }

  function handleAskToggleRunner(runner: RunnerRead) {
    setConfirmRunner(runner);
    setOpenMenu(null);
  }

  function handleConfirmToggle() {
    if (!confirmRunner) return;

    if (confirmRunner.enabled) {
      disableMutation.mutate(confirmRunner.id);
      return;
    }

    activateMutation.mutate(confirmRunner.id);
  }

  const isSubmitting = activateMutation.isPending || disableMutation.isPending;
  const runners = runnersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Runners</h1>
              <p className="mt-1 text-sm text-slate-500">
                Acompanhe os runners cadastrados e abra os detalhes de cada
                máquina.
              </p>
            </div>

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

        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <select
              value={enabledFilter}
              onChange={(e) => setEnabledFilter(e.target.value as EnabledFilter)}
              className="h-10 min-w-[220px] border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
            >
              <option value="true">Somente ativos</option>
              <option value="false">Somente inativos</option>
              <option value="all">Todos</option>
            </select>

            <div className="text-sm text-slate-500">
              Próxima atualização em{" "}
              <span className="font-semibold text-slate-700">
                {refreshCountdown}s
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {runnersQuery.isLoading ? (
            <div className="py-10 text-sm text-slate-500">
              Carregando runners...
            </div>
          ) : runnersQuery.isError ? (
            <div className="py-10 text-sm text-red-600">
              Não foi possível carregar os runners.
            </div>
          ) : runners.length === 0 ? (
            <div className="py-10 text-sm text-slate-500">
              Nenhum runner encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {runners.map((runner) => (
                <RunnerCard
                  key={runner.id}
                  runner={runner}
                  onOpen={handleOpenRunner}
                  onPreview={setPreviewRunner}
                  onToggleMenu={handleToggleMenu}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <ActionsDropdown
        open={!!openMenu}
        anchorRect={openMenu?.anchorRect ?? null}
        runner={openMenu?.runner ?? null}
        onClose={() => setOpenMenu(null)}
        onView={(runner) => {
          setOpenMenu(null);
          navigate(`/runners/${runner.id}`);
        }}
        onEdit={(runner) => {
          setOpenMenu(null);
          navigate(`/runner-configs/${runner.id}/edit`);
        }}
        onToggle={(runner) => handleAskToggleRunner(runner)}
      />

      <ScreenshotPreviewModal
        runner={previewRunner}
        onClose={() => setPreviewRunner(null)}
      />

      <ConfirmModal
        open={!!confirmRunner}
        title={
          confirmRunner?.enabled
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        description={
          confirmRunner
            ? `Runner: ${confirmRunner.name}\n\nTem certeza que deseja ${
                confirmRunner.enabled ? "desativar" : "ativar"
              } este runner?`
            : ""
        }
        onCancel={() => setConfirmRunner(null)}
        onConfirm={handleConfirmToggle}
        confirmLabel={
          confirmRunner?.enabled
            ? "Confirmar desativação"
            : "Confirmar ativação"
        }
        loading={isSubmitting}
        danger={!!confirmRunner?.enabled}
      />
    </div>
  );
}

function RunnerCard({
  runner,
  onOpen,
  onPreview,
  onToggleMenu,
}: {
  runner: RunnerRead;
  onOpen: (runner: RunnerRead) => void;
  onPreview: (runner: RunnerRead) => void;
  onToggleMenu: (
    runner: RunnerRead,
    event: React.MouseEvent<HTMLButtonElement>
  ) => void;
}) {
  const displayName = getRunnerDisplayName(runner);
  const showScreenshot = canShowScreenshot(runner);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <button
        type="button"
        onClick={() => onOpen(runner)}
        className="w-full text-left"
      >
        <div className="relative aspect-video overflow-hidden bg-slate-100">
          {showScreenshot ? (
            <RunnerScreenshotImage
              runner={runner}
              displayName={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <ScreenshotEmptyState />
          )}

          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
            <span
              className={`h-2 w-2 rounded-full ${getRunnerStatusDotClass(
                runner.status
              )}`}
            />
            {String(runner.status || "offline").toUpperCase()}
          </div>
        </div>

        <div className="p-4">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {displayName}
          </h3>
        </div>
      </button>

      <div className="absolute right-2 top-2 z-20">
        <button
          type="button"
          onClick={(event) => onToggleMenu(runner, event)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-700 shadow transition hover:bg-white"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute bottom-2 right-2 z-20 flex gap-2 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onPreview(runner);
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-950/90 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition hover:bg-slate-950"
        >
          <Eye className="h-3.5 w-3.5" />
          Visualizar
        </button>
      </div>
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

function ScreenshotPreviewModal({
  runner,
  onClose,
}: {
  runner: RunnerRead | null;
  onClose: () => void;
}) {
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
    <div className="fixed inset-0 z-[9000]">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </h2>
              <p className="text-xs text-slate-500">Screenshot do runner</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-2 px-2 text-xs font-medium text-blue-600 transition hover:bg-slate-50 hover:text-blue-700"
            >
              <X className="h-4 w-4" />
              Fechar
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
              <div className="flex min-h-[360px] w-full flex-col items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                <Link2Off className="h-20 w-20" strokeWidth={1.5} />
                <span className="mt-4 text-sm font-medium">
                  Imagem indisponível
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ActionsDropdown({
  open,
  anchorRect,
  runner,
  onClose,
  onView,
  onEdit,
  onToggle,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  runner: RunnerRead | null;
  onClose: () => void;
  onView: (runner: RunnerRead) => void;
  onEdit: (runner: RunnerRead) => void;
  onToggle: (runner: RunnerRead) => void;
}) {
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 208 });

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;

    const dropdownWidth = 208;
    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = anchorRect.right - dropdownWidth;
    let top = anchorRect.bottom + gap;

    if (left < 8) left = 8;

    if (left + dropdownWidth > viewportWidth - 8) {
      left = viewportWidth - dropdownWidth - 8;
    }

    const estimatedHeight = 140;

    if (top + estimatedHeight > viewportHeight - 8) {
      top = anchorRect.top - estimatedHeight - gap;
    }

    if (top < 8) top = 8;

    setPosition({
      top,
      left,
      width: dropdownWidth,
    });
  }, [open, anchorRect]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !anchorRect || !runner) return null;

  return createPortal(
    <div className="fixed inset-0 z-[4000]">
      <div
        ref={dropdownRef}
        className="absolute border border-slate-200 bg-white p-2 shadow-xl"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
        }}
      >
        <button
          type="button"
          onClick={() => onView(runner)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Eye className="h-4 w-4" />
          Informações
        </button>

        <button
          type="button"
          onClick={() => onEdit(runner)}
          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Editar
        </button>

        <button
          type="button"
          onClick={() => onToggle(runner)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
            runner.enabled ? "text-red-600" : "text-emerald-700"
          }`}
        >
          <Power className="h-4 w-4" />
          {runner.enabled ? "Desativar" : "Ativar"}
        </button>
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
      if (event.key === "Escape") onCancel();
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

          <div className="whitespace-pre-line px-6 py-5 text-sm text-slate-700">
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
