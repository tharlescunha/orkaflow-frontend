import { Link } from "react-router-dom";
import { KeyRound, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { badge, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { CREDENTIAL_STATUS_LABEL } from "@/lib/credential-status";

export type CredentialAlert = {
  credential_id: number;
  credential_label: string;
  status: string;
  status_label: string;
  status_reason?: string | null;
  status_updated_at?: string | null;
  status_task_id?: number | null;
};

const STATUS: Record<string, { label: string; tone: keyof typeof tone; icon: typeof ShieldCheck }> = {
  valida: { label: CREDENTIAL_STATUS_LABEL.valida, tone: "success", icon: ShieldCheck },
  nao_verificada: { label: CREDENTIAL_STATUS_LABEL.nao_verificada, tone: "neutral", icon: ShieldQuestion },
  invalida: { label: CREDENTIAL_STATUS_LABEL.invalida, tone: "danger", icon: ShieldAlert },
  senha_incorreta: { label: CREDENTIAL_STATUS_LABEL.senha_incorreta, tone: "danger", icon: ShieldAlert },
  senha_expirada: { label: CREDENTIAL_STATUS_LABEL.senha_expirada, tone: "danger", icon: ShieldAlert },
  usuario_bloqueado: { label: CREDENTIAL_STATUS_LABEL.usuario_bloqueado, tone: "danger", icon: ShieldAlert },
};

/** Selo de saúde: verde válida, cinza não verificada, vermelho quando o robô avisou que não serve. */
export function CredentialStatusBadge({
  status,
  reason,
  updatedAt,
  className,
}: {
  status?: string | null;
  reason?: string | null;
  updatedAt?: string | null;
  className?: string;
}) {
  const meta = STATUS[status ?? ""] ?? STATUS.nao_verificada;
  const Icon = meta.icon;
  const title = [reason, updatedAt ? `desde ${formatDateTime(updatedAt)}` : null].filter(Boolean).join(" · ") || undefined;
  return (
    <span className={cn(badge, tone[meta.tone], "whitespace-nowrap", className)} title={title}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

/** Faixa de aviso na automação / Health: a credencial que ela usa não serve mais. */
export function CredentialAlertStrip({ alerts, compact }: { alerts?: CredentialAlert[] | null; compact?: boolean }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className={cn("space-y-1.5", compact ? "text-xs" : "text-sm")}>
      {alerts.map((alert) => (
        <div
          key={alert.credential_id}
          className={cn(
            "flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 text-red-900",
            compact ? "px-2.5 py-1.5" : "px-4 py-3"
          )}
        >
          <KeyRound className={cn("shrink-0 text-red-600", compact ? "mt-0.5 h-3.5 w-3.5" : "mt-0.5 h-4 w-4")} />
          <div className="min-w-0">
            <p className="font-medium">
              Credencial{" "}
              <Link to={`/credentials/${alert.credential_id}`} className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                {alert.credential_label}
              </Link>{" "}
              com {alert.status_label.toLowerCase()}. Agendamentos pausados e novas tasks bloqueadas até atualizar a senha.
            </p>
            {!compact && alert.status_reason && <p className="mt-0.5 text-red-800/80">{alert.status_reason}</p>}
            {!compact && alert.status_task_id && (
              <p className="mt-0.5 text-xs text-red-800/70">
                Detectado na{" "}
                <Link to={`/tasks/${alert.status_task_id}`} className="underline underline-offset-2">
                  task #{alert.status_task_id}
                </Link>
                {alert.status_updated_at ? ` em ${formatDateTime(alert.status_updated_at)}` : ""}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
