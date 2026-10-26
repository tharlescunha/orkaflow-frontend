import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { ConnectionBanner } from "./connection-banner";
import { SystemHealthBanner } from "./system-health-banner";
import { CommandPalette } from "@/components/common/command-palette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const MOBILE_QUERY = "(max-width: 767px)";

function readCollapsed(): boolean {
  try {
    const saved = localStorage.getItem("sidebar");
    return saved ? JSON.parse(saved) : false;
  } catch {
    return false;
  }
}

export function AppShell({ content }: { content?: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(readCollapsed);
  // No celular a sidebar não cabe ao lado: abre por cima, como painel deslizante.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // Ctrl+K / Cmd+K abre a busca global em qualquer tela.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleToggleSidebar() {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setMobileOpen(true);
      return;
    }
    setSidebarCollapsed((prev: boolean) => {
      try {
        localStorage.setItem("sidebar", JSON.stringify(!prev));
      } catch {
        // sem storage (modo privado): só não persiste
      }
      return !prev;
    });
  }

  return (
    <div className="flex h-screen w-screen bg-[#f4f6fb] text-slate-800">
      <AppSidebar collapsed={sidebarCollapsed} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-slate-200 bg-white p-0 text-slate-800">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader onToggleSidebar={handleToggleSidebar} onOpenSearch={() => setSearchOpen(true)} />

        {/* relative: elementos absolutos (ex.: textos sr-only) ficam contidos e recortados aqui,
            em vez de alongar a página inteira além do layout */}
        <main className="relative flex-1 overflow-y-auto">
          <div className="space-y-3 px-4 pt-1 md:px-8">
            <ConnectionBanner />
            <SystemHealthBanner />
          </div>
          {/* key pela rota: cada tela entra com um fade curto. */}
          <div key={location.pathname} className="page-enter px-4 pb-8 pt-3 md:px-8">
            {content ?? <Outlet />}
          </div>
        </main>
      </div>

      <CommandPalette open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
