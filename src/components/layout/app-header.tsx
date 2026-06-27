import { Menu } from "lucide-react";
import { UserMenu } from "./user-menu";

type AppHeaderProps = {
  onToggleSidebar: () => void;
};

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="relative z-30 shrink-0 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-xl border border-slate-200 p-2 transition hover:bg-slate-100"
          >
            <Menu className="h-5 w-5 text-slate-700" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-slate-200">
              <img
                src="/favicon.svg"
                alt="OrkaFlow"
                className="h-5 w-5"
              />
            </div>
            <span className="text-lg font-semibold text-slate-900">
              OrkaFlow
            </span>
          </div>
        </div>

        <UserMenu />
      </div>
    </header>
  );
}
