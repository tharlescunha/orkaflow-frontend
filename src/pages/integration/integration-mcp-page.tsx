import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/lib/api-error";
import { getMcpInfo } from "@/services/api/integration";
import { resolveApiBase } from "./api-base";
import { McpTab } from "./mcp-tab";

export function IntegrationMcpPage() {
  const infoQuery = useQuery({ queryKey: ["integration-mcp-info"], queryFn: getMcpInfo, staleTime: 5 * 60_000 });
  const info = infoQuery.data;

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-2xl font-semibold text-slate-950">MCP para IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Conecte o OrkaFlow ao Claude ou a outra IA para consultar e operar o orquestrador conversando.
        </p>
      </div>

      <div className="p-6">
        {infoQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : infoQuery.isError || !info ? (
          <p className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {getApiErrorMessage(infoQuery.error, "Não foi possível carregar os dados do MCP.")}
          </p>
        ) : (
          <McpTab info={info} url={`${resolveApiBase(info.url, info.public_url_configured)}/mcp`} />
        )}
      </div>
    </section>
  );
}
