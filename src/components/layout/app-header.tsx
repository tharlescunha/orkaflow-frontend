import { Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

import { describeRoute } from "@/lib/navigation";
import { focusRing } from "@/lib/ui";
import { UserMenu } from "./user-menu";

type AppHeaderProps = {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
};

// Topo sem barra: caminho da tela à esquerda, busca global à direita. O usuário fica na sidebar
// (no celular, aqui).
export function AppHeader({ onToggleSidebar, onOpenSearch }: AppHeaderProps) {
  const { pathname } = useLocation();
  const route = describeRoute(pathname);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 md:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Abrir ou recolher o menu"
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white hover:text-slate-900 ${focusRing}`}
        >
          <Menu className="h-5 w-5" />
        </button>
        <nav className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-500 sm:flex" aria-label="Caminho">
          {route.group && (
            <>
              <span className="truncate">{route.group}</span>
              <span className="text-slate-300">/</span>
            </>
          )}
          <span className="truncate font-medium text-slate-900">{route.label ?? "OrkaFlow"}</span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className={`flex h-9 items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 text-sm text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 ${focusRing}`}
          aria-label="Buscar no painel"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Ir para...</span>
          <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-medium text-slate-500 sm:inline">Ctrl K</kbd>
        </button>
        <div className="md:hidden">
          <UserMenu compact />
        </div>
      </div>
    </div>
  );
}
