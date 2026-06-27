import { ChevronDown, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  function handleProfile() {
    navigate("/profile");
  }

  function handleLogout() {
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
        <button className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            {initials}
          </div>

          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold text-slate-900">
              {user?.name || "Usuário"}
            </p>
            <p className="text-xs text-slate-500">
              {user?.email || "usuario@orkaflow.local"}
            </p>
          </div>

          <ChevronDown className="h-4 w-4 text-slate-500" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
      >
        <DropdownMenuItem
          onClick={handleProfile}
          className="cursor-pointer rounded-lg text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900"
        >
          <User className="mr-2 h-4 w-4" />
          Perfil
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer rounded-lg text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
