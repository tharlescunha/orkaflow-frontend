import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { ConnectionBanner } from "./connection-banner";
import { SystemHealthBanner } from "./system-health-banner";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("sidebar");
    return saved ? JSON.parse(saved) : false;
  });

  function handleToggleSidebar() {
    setSidebarCollapsed((prev: boolean) => {
      localStorage.setItem("sidebar", JSON.stringify(!prev));
      return !prev;
    });
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100">
      {/* HEADER FIXO EM CIMA */}
      <AppHeader onToggleSidebar={handleToggleSidebar} />

      {/* CONTEÚDO ABAIXO DO HEADER */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar collapsed={sidebarCollapsed} />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ConnectionBanner />
          <SystemHealthBanner />

          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 lg:p-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
