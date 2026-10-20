import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api/client";

type HealthPayload = { status?: string; database?: string };

export function useApiConnection() {
  const query = useQuery({
    queryKey: ["health", "api-ping"],
    queryFn: async () => {
      const response = await api.get<HealthPayload>("/api/v1/health", { timeout: 5_000 });
      return response.data;
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    retry: false,
  });

  const lastContactAt = query.dataUpdatedAt > 0 ? new Date(query.dataUpdatedAt) : null;

  return {
    disconnected: query.isError,
    degraded: !query.isError && !!query.data && query.data.status !== "ok",
    databaseStatus: query.data?.database,
    lastContactAt,
  };
}
