import { useRouteError } from "react-router-dom";

import { AppShell } from "../components/layout/app-shell";
import { AppErrorPage } from "../pages/app-error-page";

export function AppLayout() {
  // Quando montado como errorElement, mostra a página de erro no lugar do conteúdo (menu continua).
  const error = useRouteError();
  return <AppShell content={error ? <AppErrorPage /> : undefined} />;
}
