import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bot } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { getMcpInfo } from "@/services/api/integration";
import { ApiDocsTab } from "./api-docs-tab";
import { McpTab } from "./mcp-tab";

const TABS = [
  { key: "mcp", label: "MCP para IA", icon: Bot },
  { key: "api", label: "Documentação da API", icon: BookOpen },
] as const;

export function IntegrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "api" ? "api" : "mcp";

  const infoQuery = useQuery({ queryKey: ["integration-mcp-info"], queryFn: getMcpInfo, staleTime: 5 * 60_000 });
  // Base das rotas para os exemplos: o mesmo servidor que responde o MCP.
  const baseUrl = infoQuery.data?.url.replace(/\/mcp$/, "") ?? import.meta.env.VITE_API_URL ?? window.location.origin;

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 pt-5">
        <h1 className="text-2xl font-semibold text-slate-950">Integração</h1>
        <p className="mt-1 text-sm text-slate-500">
          Conecte o OrkaFlow a uma IA pelo MCP ou integre sistemas pela API.
        </p>
        <div className="mt-4 flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSearchParams(t.key === "mcp" ? {} : { tab: t.key }, { replace: true })}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium",
                  tab === t.key
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {tab === "api" ? (
          <ApiDocsTab baseUrl={baseUrl} />
        ) : infoQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : infoQuery.isError || !infoQuery.data ? (
          <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getApiErrorMessage(infoQuery.error, "Não foi possível carregar os dados do MCP.")}
          </p>
        ) : (
          <McpTab info={infoQuery.data} />
        )}
      </div>
    </section>
  );
}
