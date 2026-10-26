import {
  Bot,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  PlusSquare,
  PlaySquare,
  ScrollText,
  Server,
  Settings2,
  Siren,
  UserCircle2,
  Users,
  Boxes,
  Bell,
  Activity,
  Variable,
  Plug,
  BookOpen,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useSystemHealth } from "@/hooks/use-system-health";

type AppSidebarProps = {
  collapsed: boolean;
};

const menuGroups = [
  {
    title: "Operação",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },

      // 🔥 AJUSTADO AQUI
      { label: "Health", to: "/automations/health", icon: Activity },

      { label: "Tasks", to: "/tasks", icon: ClipboardList },
      { label: "Nova Task", to: "/tasks/new", icon: PlusSquare },
      { label: "Logs", to: "/logs", icon: ScrollText },
      { label: "Erros", to: "/errors", icon: Siren, badgeKey: "errors" },
    ],
  },
  {
    title: "Execução",
    items: [
      { label: "Runners", to: "/runners", icon: Server },
      { label: "Runner Config", to: "/runner-configs", icon: Settings2 },
      { label: "Guia do Bot", to: "/worker-registration", icon: FileText },
    ],
  },
  {
    title: "Automação",
    items: [
      { label: "Bots", to: "/bots", icon: Bot },
      { label: "Versões de Bot", to: "/bot-versions", icon: Boxes },
      { label: "Automações", to: "/automations", icon: PlaySquare },
      { label: "Agendamentos", to: "/schedules", icon: CalendarClock },
      { label: "Repositórios", to: "/repositories", icon: FolderGit2 },
      { label: "Variáveis", to: "/env-variables", icon: Variable },
    ],
  },
  {
    title: "Segurança",
    items: [{ label: "Credenciais", to: "/credentials", icon: KeyRound }],
  },
  {
    title: "Integração",
    items: [
      { label: "MCP", to: "/integration/mcp", icon: Plug },
      { label: "API", to: "/integration/api", icon: BookOpen },
      { label: "Notificações", to: "/notifications", icon: Bell },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Usuários", to: "/users", icon: Users },
      { label: "Perfil", to: "/profile", icon: UserCircle2 },
    ],
  },
];

export function AppSidebar({ collapsed }: AppSidebarProps) {
  const [hovered, setHovered] = useState(false);

  const isOpen = !collapsed || hovered;
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
        "hidden h-full shrink-0 border-r border-slate-200 bg-slate-950 text-slate-100 md:flex md:flex-col",
        "overflow-hidden transition-[width] duration-300 ease-out",
        isOpen ? "w-[280px]" : "w-[84px]"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <nav
          className={cn(
            "flex-1 min-h-0 px-3 py-4",
            "overflow-y-auto overflow-x-hidden",
            "scroll-smooth",
            "[scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent]",
            "[&::-webkit-scrollbar]:w-2",
            "[&::-webkit-scrollbar-track]:bg-transparent",
            "[&::-webkit-scrollbar-thumb]:rounded-full",
            "[&::-webkit-scrollbar-thumb]:bg-slate-700/60",
            "[&::-webkit-scrollbar-thumb:hover]:bg-slate-600/80"
          )}
        >
          <div className="space-y-6 pr-1">
            {menuGroups.map((group) => (
              <div key={group.title}>
                {isOpen && (
                  <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {group.title}
                  </div>
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          cn(
                            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                            "transition-colors duration-200 ease-out",
                            isOpen ? "justify-start" : "justify-center",
                            isActive
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-300 hover:bg-white/10 hover:text-white"
                          )
                        }
                        title={!isOpen ? item.label : undefined}
                      >
                        <span className="relative shrink-0">
                          <Icon className="h-4 w-4" />
                          {!isOpen && "badgeKey" in item && errorsBadge > 0 && (
                            <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                              {errorsBadge > 99 ? "99+" : errorsBadge}
                            </span>
                          )}
                        </span>
                        {isOpen && (
                          <span className="truncate transition-opacity duration-200 ease-out">
                            {item.label}
                          </span>
                        )}
                        {isOpen && "badgeKey" in item && errorsBadge > 0 && (
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

        {isOpen && (
          <div className="shrink-0 border-t border-slate-800 p-4">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-sm font-medium">Ambiente</p>
              <p className="mt-1 text-xs text-slate-400">Produção</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
