import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import { logoutRequest } from "@/services/api/auth";
import { focusRing } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// compact: só o avatar (sidebar recolhida).
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleProfile() {
    navigate("/profile");
  }

  function handleLogout() {
    // Avisa o servidor (sem esperar) e limpa a sessão local.
    logoutRequest().catch(() => undefined);
    logout();
    navigate("/login");
  }

  const initials =
    user?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "US";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-100",
            compact && "justify-center px-0",
            focusRing
          )}
          aria-label="Menu do usuário"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {initials}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight text-slate-900">{user?.name || "Usuário"}</span>
                <span className="block truncate text-[11px] text-slate-500">{user?.email || user?.login || ""}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-slate-500">
          {user?.login ? `@${user.login}` : "Conta"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1 bg-slate-100" />
        <DropdownMenuItem
          onClick={handleProfile}
          className="cursor-pointer rounded-lg px-2 py-2 text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900"
        >
          <User className="mr-2 h-4 w-4" />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer rounded-lg px-2 py-2 text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
