import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { McpPageSkeleton } from "@/components/common/skeleton";
import { card } from "@/lib/ui";
import { getMcpInfo } from "@/services/api/integration";
import { resolveApiBase } from "./api-base";
import { McpTab } from "./mcp-tab";

export function IntegrationMcpPage() {
  const infoQuery = useQuery({ queryKey: ["integration-mcp-info"], queryFn: getMcpInfo, staleTime: 5 * 60_000 });
  const info = infoQuery.data;

  return (
    <section className={card}>
      <PageHeader title="MCP para IA" />

      <div className="p-5 md:p-6">
        {infoQuery.isLoading ? (
          <McpPageSkeleton />
        ) : infoQuery.isError || !info ? (
          <QueryError error={infoQuery.error} what="os dados do MCP" onRetry={() => infoQuery.refetch()} retrying={infoQuery.isFetching} />
        ) : (
          <McpTab info={info} url={`${resolveApiBase(info.url, info.public_url_configured)}/mcp`} />
        )}
      </div>
    </section>
  );
}
