import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useSystemHealth } from "@/hooks/use-system-health";
import { APP_VERSION, ENVIRONMENT_LABEL, NAV_GROUPS, isExactOnly } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";

// Id da última task com falha que o usuário já viu na tela de Erros.
const SEEN_ERRORS_KEY = "orkaflow:errors-seen";

function readSeenErrors(): number {
  try {
    return Number(localStorage.getItem(SEEN_ERRORS_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSeenErrors(total: number) {
  try {
    localStorage.setItem(SEEN_ERRORS_KEY, String(total));
  } catch {
    // sem storage: o badge só não é lembrado entre sessões
  }
}

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
  const { failedTasks } = useSystemHealth();
  const { pathname } = useLocation();
  // Badge do item "Erros": só as falhas (últimas 24h) que surgiram depois da última visita à tela de
  // Erros. Ao entrar lá, o número some; volta quando uma task nova falhar.
  const onErrorsPage = pathname.startsWith("/errors");
  const newestFailedId = failedTasks.reduce((max, task) => Math.max(max, task.id), 0);
  useEffect(() => {
    if (onErrorsPage && newestFailedId > readSeenErrors()) writeSeenErrors(newestFailedId);
  }, [onErrorsPage, newestFailedId]);
  const seenId = readSeenErrors();
  const errorsBadge = onErrorsPage ? 0 : failedTasks.filter((task) => task.id > seenId).length;

  return (
    <aside
      onMouseEnter={() => {
        if (collapsed) setHovered(true);
      }}
      onMouseLeave={() => {
        if (collapsed) setHovered(false);
      }}
      className={cn(
        "h-full shrink-0 border-r border-slate-200 bg-white text-slate-700",
        "overflow-hidden transition-[width] duration-300 ease-out",
        mobile ? "flex w-full flex-col bg-white" : "hidden md:flex md:flex-col",
        !mobile && (isOpen ? "w-[256px]" : "w-[76px]")
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Marca */}
        <NavLink to="/" onClick={onNavigate} className={cn("mx-3 flex items-center gap-3 border-b border-slate-200 px-1 pb-4 pt-5", !isOpen && "justify-center px-0")}>
          {/* Logo simples do Regente como no guia: ícone original, nome em Inter Bold (−3,5%), selo de versão e legenda. */}
          <img src="/brand/regente-icone.svg" alt="Regente" className="h-10 w-10 shrink-0" />
          {isOpen && (
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-[22px] font-bold leading-none tracking-[-0.035em] text-regente-ink">Regente</span>
                <span className="shrink-0 rounded-full bg-regente-100 px-1.5 py-px text-[10px] font-bold leading-4 text-[#1E40AF]">v{APP_VERSION}</span>
              </span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-regente-muted">{ENVIRONMENT_LABEL}</span>
            </span>
          )}
        </NavLink>

        <nav
          className={cn(
            "min-h-0 flex-1 px-3 pb-3 pt-4",
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
                            isActive ? "bg-[#F7EDDF] font-semibold text-[#7a4a12]" : "text-slate-700 hover:bg-[#F7EDDF]/60 hover:text-slate-900"
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
