import { useQuery } from "@tanstack/react-query";

import { getMcpInfo } from "@/services/api/integration";
import { resolveApiBase } from "./api-base";
import { ApiDocsTab } from "./api-docs-tab";

export function IntegrationApiPage() {
  const infoQuery = useQuery({ queryKey: ["integration-mcp-info"], queryFn: getMcpInfo, staleTime: 5 * 60_000 });
  const baseUrl = resolveApiBase(infoQuery.data?.url, infoQuery.data?.public_url_configured);

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <h1 className="text-2xl font-semibold text-slate-950">Documentação da API</h1>
        <p className="mt-1 text-sm text-slate-500">
          Todas as rotas do OrkaFlow com explicação, parâmetros e exemplos para integrar outros sistemas.
        </p>
      </div>

      <div className="p-6">
        <ApiDocsTab baseUrl={baseUrl} />
      </div>
    </section>
  );
}
