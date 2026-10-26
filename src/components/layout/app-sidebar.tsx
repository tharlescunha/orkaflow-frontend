import { useState } from "react";
import { NavLink } from "react-router-dom";

import { useSystemHealth } from "@/hooks/use-system-health";
import { ENVIRONMENT_LABEL, NAV_GROUPS, isExactOnly } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

type AppSidebarProps = {
  collapsed: boolean;
  // Dentro do painel deslizante do celular: sempre aberta e sem a largura fixa.
  mobile?: boolean;
  // Chamado ao clicar num item (o painel do celular fecha).
  onNavigate?: () => void;
};

// Sidebar clara: mesma família de cor do conteúdo, item ativo em azul suave, usuário no rodapé.
export function AppSidebar({ collapsed, mobile = false, onNavigate }: AppSidebarProps) {
  const [hovered, setHovered] = useState(false);

  const isOpen = mobile || !collapsed || hovered;
  const { errors24h, failedTasks } = useSystemHealth();
  // badge do item "Erros": erros das ultimas 24h (ou tasks falhas, o que for maior)
  const errorsBadge = Math.max(errors24h, failedTasks.length);

  return (
    <aside
      onMouseEnter={() => {
        if (collapsed) setHovered(true);
      }}
      onMouseLeave={() => {
        if (collapsed) setHovered(false);
      }}
      className={cn(
        "h-full shrink-0 border-r border-slate-200 bg-[#f8f9fb] text-slate-700",
        "overflow-hidden transition-[width] duration-300 ease-out",
        mobile ? "flex w-full flex-col bg-white" : "hidden md:flex md:flex-col",
        !mobile && (isOpen ? "w-[256px]" : "w-[76px]")
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Marca */}
        <NavLink to="/" onClick={onNavigate} className={cn("flex items-center gap-2.5 px-4 pb-2 pt-5", !isOpen && "justify-center px-0")}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-md shadow-blue-600/30">
            <img src="/favicon.svg" alt="" className="h-5 w-5 brightness-0 invert" />
          </span>
          {isOpen && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold leading-tight text-slate-900">OrkaFlow</span>
              <span className="block truncate text-[11px] text-slate-500">{ENVIRONMENT_LABEL}</span>
            </span>
          )}
        </NavLink>

        <nav
          className={cn(
            "min-h-0 flex-1 px-3 py-3",
            "overflow-y-auto overflow-x-hidden scroll-smooth",
            "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.45)_transparent]",
            "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70"
          )}
        >
          <div className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.title}>
                {isOpen && (
                  <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{group.title}</div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const showBadge = item.badgeKey === "errors" && errorsBadge > 0;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={isExactOnly(item.to)}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] font-medium transition-colors duration-150",
                            isOpen ? "justify-start" : "justify-center",
                            isActive ? "bg-slate-200/70 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-200/50 hover:text-slate-900"
                          )
                        }
                        title={!isOpen ? item.label : undefined}
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-[18px] w-[18px]" />
                          {!isOpen && showBadge && (
                            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                              {errorsBadge > 99 ? "99+" : errorsBadge}
                            </span>
                          )}
                        </span>
                        {isOpen && <span className="truncate">{item.label}</span>}
                        {isOpen && showBadge && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
                            {errorsBadge > 99 ? "99+" : errorsBadge}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Usuário no rodapé (no celular ele fica no topo). */}
        {!mobile && (
          <div className={cn("shrink-0 border-t border-slate-200 p-3", !isOpen && "px-2")}>
            <UserMenu compact={!isOpen} />
          </div>
        )}
      </div>
    </aside>
  );
}
