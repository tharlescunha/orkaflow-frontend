import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

import type { AutomationHealthStatus } from "@/services/api/automation-health";
import { tone } from "@/lib/ui";

/** Cores, ícone e texto de cada situação do Health. Usado pelo Health e pelo Sync. */
export type HealthVisual = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  cardClass: string;
  badgeClass: string;
  accentClass: string;
  iconClass: string;
  filterActiveClass: string;
  filterTextClass: string;
  bandClass: string;
};

export const HEALTH_VISUAL: Record<AutomationHealthStatus, HealthVisual> = {
  success: {
    label: "OK",
    icon: CheckCircle2,
    cardClass: "border-emerald-200 bg-emerald-50/60 hover:border-emerald-300",
    badgeClass: tone.success,
    accentClass: "bg-emerald-500",
    iconClass: "text-emerald-600",
    filterActiveClass: "border-emerald-600 bg-emerald-600 text-white",
    filterTextClass: "text-emerald-700",
    bandClass: "from-emerald-50 to-white border-emerald-200",
  },
  running: {
    label: "Rodando",
    icon: Loader2,
    cardClass: "border-blue-200 bg-blue-50/60 hover:border-blue-300",
    badgeClass: tone.info,
    accentClass: "bg-blue-500",
    iconClass: "text-blue-600",
    filterActiveClass: "border-blue-600 bg-blue-600 text-white",
    filterTextClass: "text-blue-700",
    bandClass: "from-blue-50 to-white border-blue-200",
  },
  // warning = atrasado: não rodou quando devia — âmbar, diferente do vermelho de erro de execução
  warning: {
    label: "Atrasado",
    icon: AlertTriangle,
    cardClass: "border-amber-200 bg-amber-50/60 hover:border-amber-300",
    badgeClass: tone.warning,
    accentClass: "bg-amber-500",
    iconClass: "text-amber-600",
    filterActiveClass: "border-amber-600 bg-amber-600 text-white",
    filterTextClass: "text-amber-700",
    bandClass: "from-amber-50 to-white border-amber-200",
  },
  error: {
    label: "Erro",
    icon: CircleAlert,
    cardClass: "border-red-200 bg-red-50/60 hover:border-red-300",
    badgeClass: tone.danger,
    accentClass: "bg-red-500",
    iconClass: "text-red-600",
    filterActiveClass: "border-red-600 bg-red-600 text-white",
    filterTextClass: "text-red-700",
    bandClass: "from-red-50 to-white border-red-200",
  },
};

export function getHealthVisual(status: string): HealthVisual {
  return HEALTH_VISUAL[status as AutomationHealthStatus] ?? HEALTH_VISUAL.warning;
}
