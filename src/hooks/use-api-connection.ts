import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api/client";

type HealthComponent = { status?: string };
type HealthPayload = {
  status?: string;
  database?: string;
  components?: Record<string, HealthComponent>;
};

const COMPONENT_LABELS: Record<string, string> = {
  database: "banco de dados",
  dispatcher: "distribuidor de tasks",
  watchdog: "watchdog",
  scheduler_engine: "agendador",
  scheduler_runtime: "agendador (execução)",
};

const STATUS_LABELS: Record<string, string> = {
  unknown: "sem sinal",
  stale: "parado",
  error: "com erro",
  down: "fora do ar",
};

function describeIssues(components: Record<string, HealthComponent> | undefined) {
  if (!components) return [];

  return Object.entries(components)
    .filter(([, component]) => component?.status && component.status !== "ok")
    .map(([name, component]) => {
      const status = String(component.status);
      return `${COMPONENT_LABELS[name] ?? name}: ${STATUS_LABELS[status] ?? status}`;
    });
}

export function useApiConnection() {
  const query = useQuery({
    queryKey: ["health", "api-ping"],
    queryFn: async () => {
      const response = await api.get<HealthPayload>("/api/v1/health", { timeout: 10_000 });
      return response.data;
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    // Uma resposta lenta (reinício do servidor, plano que "acorda") não vira aviso:
    // só conta como sem conexão depois de falhar de novo.
    retry: 1,
    retryDelay: 5_000,
  });

  const lastContactAt = query.dataUpdatedAt > 0 ? new Date(query.dataUpdatedAt) : null;

  return {
    disconnected: query.isError,
    degraded: !query.isError && !!query.data && query.data.status !== "ok",
    databaseStatus: query.data?.database,
    issues: describeIssues(query.data?.components),
    lastContactAt,
  };
}
