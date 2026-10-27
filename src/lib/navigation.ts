import type { ComponentType } from "react";
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  Lock,
  PlaySquare,
  Plug,
  PlusSquare,
  ScrollText,
  Server,
  Settings2,
  Siren,
  UserCircle2,
  Users,
  Variable,
  Zap,
} from "lucide-react";

export type NavItem = {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  // Palavras extras para a busca global achar a tela.
  keywords?: string;
  badgeKey?: "errors";
};

export type NavGroup = { title: string; items: NavItem[] };

// Menu do painel: usado pela sidebar, pelo caminho no topo e pela busca global (Ctrl+K).
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Operação",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard, keywords: "indicadores métricas" },
      { label: "Health", to: "/automations/health", icon: Activity, keywords: "saúde automações atrasado" },
      { label: "Tasks", to: "/tasks", icon: ClipboardList, keywords: "execuções fila" },
      { label: "Nova Task", to: "/tasks/new", icon: PlusSquare, keywords: "executar rodar" },
      { label: "Logs", to: "/logs", icon: ScrollText, keywords: "máquina ao vivo" },
      { label: "Erros", to: "/errors", icon: Siren, badgeKey: "errors", keywords: "falhas" },
    ],
  },
  {
    title: "Execução",
    items: [
      { label: "Runners", to: "/runners", icon: Server, keywords: "máquinas" },
      { label: "Runner Config", to: "/runner-configs", icon: Settings2, keywords: "configuração máquinas" },
      { label: "Guia do Bot", to: "/worker-registration", icon: FileText, keywords: "maestro robô main.py como fazer" },
    ],
  },
  {
    title: "Automação",
    items: [
      { label: "Bots", to: "/bots", icon: Bot, keywords: "robôs" },
      { label: "Versões de Bot", to: "/bot-versions", icon: Boxes, keywords: "git release" },
      { label: "Automações", to: "/automations", icon: PlaySquare },
      { label: "Agendamentos", to: "/schedules", icon: CalendarClock, keywords: "cron horário" },
      { label: "Grupos exclusivos", to: "/exclusive-groups", icon: Lock, keywords: "concorrência não rodar junto mesma senha" },
      { label: "Repositórios", to: "/repositories", icon: FolderGit2, keywords: "áreas" },
      { label: "Variáveis", to: "/env-variables", icon: Variable, keywords: "ambiente env" },
    ],
  },
  {
    title: "Segurança",
    items: [{ label: "Credenciais", to: "/credentials", icon: KeyRound, keywords: "senhas cofre" }],
  },
  {
    title: "Integração",
    items: [
      { label: "MCP", to: "/integration/mcp", icon: Plug, keywords: "ia claude token" },
      { label: "API", to: "/integration/api", icon: BookOpen, keywords: "documentação rotas" },
      // A tela só faz uma coisa: abrir chamado no desk quando o agendamento falha N vezes seguidas.
      { label: "Chamado de erro", to: "/notifications", icon: Bell, keywords: "notificações chamado desk webhook" },
      { label: "Eventos", to: "/events", icon: Zap, keywords: "gatilho quando então webhook teams" },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Calendários", to: "/calendars", icon: CalendarDays, keywords: "feriados dias úteis janela" },
      { label: "Usuários", to: "/users", icon: Users },
      { label: "Perfil", to: "/profile", icon: UserCircle2, keywords: "minha conta senha" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

const ALL_PATHS = NAV_ITEMS.map((item) => item.to);

// Um item cujo caminho é prefixo de outro (/automations e /automations/health) só acende na rota exata.
export function isExactOnly(path: string) {
  return ALL_PATHS.some((other) => other !== path && other.startsWith(`${path}/`));
}

// Grupo e tela da rota atual, para o caminho no topo ("Operação / Tasks").
export function describeRoute(pathname: string): { group?: string; label?: string } {
  let best: { group: string; item: NavItem } | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const matches = pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (matches && (!best || item.to.length > best.item.to.length)) best = { group: group.title, item };
    }
  }
  return best ? { group: best.group, label: best.item.label } : {};
}

// VITE_ENV_LABEL no build (ex.: "Homologação"); sem ela, pelo modo do Vite.
export const ENVIRONMENT_LABEL: string =
  (import.meta.env.VITE_ENV_LABEL as string | undefined) || (import.meta.env.DEV ? "Desenvolvimento" : "Produção");
