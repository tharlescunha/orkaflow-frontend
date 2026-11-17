import { useQuery } from "@tanstack/react-query";

import { getCurrentVersion } from "@/services/api/releases";

/** Versão atual do Regente (a mais nova do ATUALIZACOES.md), ou null enquanto carrega ou se a API não respondeu. */
export function useCurrentVersion(): string | null {
  const query = useQuery({
    queryKey: ["release-version"],
    queryFn: getCurrentVersion,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return query.data?.version ?? null;
}
