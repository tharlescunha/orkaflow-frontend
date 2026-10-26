import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  // danger: ação destrutiva (botão vermelho); warning: atenção (âmbar); default: ação normal (escuro).
  tone?: "default" | "warning" | "danger";
  isPending?: boolean;
  // Para ações irreversíveis: a pessoa precisa digitar este texto para liberar o botão.
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const CONFIRM_CLASS = {
  default: "bg-slate-950 hover:bg-slate-800",
  warning: "bg-amber-600 hover:bg-amber-700",
  danger: "bg-red-700 hover:bg-red-800",
} as const;

// Diálogo de confirmação único do painel (substitui window.confirm e os modais copiados por tela).
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, isPending = false, onCancel } = props;

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isPending, onCancel]);

  if (!open) return null;

  // O corpo só existe enquanto aberto: o texto digitado zera sozinho a cada abertura.
  return createPortal(<ConfirmBody {...props} />, document.body);
}

function ConfirmBody({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  isPending = false,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState("");
  const titleId = useId();
  const locked = Boolean(requireText) && typed.trim() !== requireText;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-slate-950/55" onClick={() => !isPending && onCancel()} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
            <div className="flex items-start gap-3">
              {tone !== "default" && (
                <AlertTriangle className={cn("mt-0.5 h-5 w-5 shrink-0", tone === "danger" ? "text-red-600" : "text-amber-600")} />
              )}
              <h2 id={titleId} className="text-lg font-semibold text-slate-950">
                {title}
              </h2>
            </div>
            <button type="button" onClick={onCancel} disabled={isPending} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>

          {(description || requireText) && (
            <div className="space-y-4 px-6 py-5 text-sm text-slate-700">
              {description && <div className="whitespace-pre-line">{description}</div>}
              {requireText && (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Digite <span className="font-mono text-slate-900">{requireText}</span> para confirmar
                  </span>
                  <input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 font-mono text-sm text-slate-900 outline-none focus:border-slate-900"
                  />
                </label>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending || locked}
              className={cn(
                "inline-flex h-10 items-center gap-2 px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
                CONFIRM_CLASS[tone]
              )}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? "Processando..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
