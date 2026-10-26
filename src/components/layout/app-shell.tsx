import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { ConnectionBanner } from "./connection-banner";
import { SystemHealthBanner } from "./system-health-banner";
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
    <div className="h-screen w-screen flex flex-col bg-slate-100">
      {/* HEADER FIXO EM CIMA */}
      <AppHeader onToggleSidebar={handleToggleSidebar} />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] border-slate-800 bg-slate-950 p-0 text-slate-100">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <AppSidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* CONTEÚDO ABAIXO DO HEADER */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar collapsed={sidebarCollapsed} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ConnectionBanner />
          <SystemHealthBanner />

          {/* relative: elementos absolutos (ex.: textos sr-only) ficam contidos e recortados aqui,
              em vez de alongar a página inteira além do layout */}
          <main className="relative flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 lg:p-8">
              {content ?? <Outlet />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
