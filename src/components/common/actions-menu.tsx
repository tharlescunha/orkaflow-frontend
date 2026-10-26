import type { ComponentType } from "react";
import { MoreVertical } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { btn } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type ActionItem = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  // danger: vermelho (apagar, parar); success: verde (ativar, reativar).
  tone?: "default" | "danger" | "success";
  disabled?: boolean;
  // Separador antes deste item.
  separatorBefore?: boolean;
};

// Menu "⋮" de ações por linha, igual em todas as tabelas (substitui os 4 ActionsDropdown copiados).
export function ActionsMenu({ items, label = "Ações", className }: { items: ActionItem[]; label?: string; className?: string }) {
  if (items.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(btn.icon, className)} aria-label={label} onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px] rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-lg" onClick={(e) => e.stopPropagation()}>
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={`${item.label}-${index}`}>
              {item.separatorBefore && <DropdownMenuSeparator className="my-1 bg-slate-100" />}
              <DropdownMenuItem
                disabled={item.disabled}
                onSelect={() => item.onSelect()}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none focus:bg-slate-100",
                  item.tone === "danger" && "text-red-700 focus:bg-red-50",
                  item.tone === "success" && "text-emerald-700 focus:bg-emerald-50"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </DropdownMenuItem>
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
