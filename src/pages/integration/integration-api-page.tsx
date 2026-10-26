import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/page-header";
import { card } from "@/lib/ui";
import { getMcpInfo } from "@/services/api/integration";
import { resolveApiBase } from "./api-base";
import { ApiDocsTab } from "./api-docs-tab";

export function IntegrationApiPage() {
  const infoQuery = useQuery({ queryKey: ["integration-mcp-info"], queryFn: getMcpInfo, staleTime: 5 * 60_000 });
  const baseUrl = resolveApiBase(infoQuery.data?.url, infoQuery.data?.public_url_configured);

  return (
    <section className={card}>
      <PageHeader
        title="Documentação da API"
        description="Todas as rotas do OrkaFlow com explicação, parâmetros e exemplos para integrar outros sistemas."
      />

      <div className="p-5 md:p-6">
        <ApiDocsTab baseUrl={baseUrl} />
      </div>
    </section>
  );
}
