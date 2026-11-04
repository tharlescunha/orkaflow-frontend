import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { Skeleton } from "@/components/common/skeleton";
import { card } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { api } from "@/services/api/client";

/**
 * Database Status: a página original do projeto DatabaseStatus (public/dbstatus/index.html) dentro do painel,
 * com a paleta do Regente. Ela mora na mesma origem do painel, então usa o mesmo login: lê o token do
 * localStorage e, se ele vencer, pede ao painel (esta tela) para renová-lo.
 */
export function DatabaseStatusPage() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== "dbstatus-auth-expired") return;
      // Qualquer chamada autenticada faz o interceptor renovar o token e gravar o novo no localStorage.
      void api.get("/api/v1/auth/me").catch(() => undefined);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // O #db=servidor/banco do endereço (link do aviso de banco com problema) abre direto o detalhe desse banco.
  const { hash } = useLocation();
  const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
  const src = `/dbstatus/index.html?api=${encodeURIComponent(apiUrl)}${hash.startsWith("#db=") ? hash : ""}`;

  return (
    <section className={cn(card, "relative overflow-hidden")}>
      {!loaded && <Skeleton className="absolute inset-0 z-10 h-full w-full rounded-none" />}
      <iframe
        title="Database Status"
        src={src}
        onLoad={() => setLoaded(true)}
        className="block w-full border-0"
        style={{ height: "calc(100vh - 7rem)", minHeight: 560 }}
      />
    </section>
  );
}
