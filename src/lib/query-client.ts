import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/store/toast-store";

function isAuthError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // 401 e tratado pelo interceptor (refresh/logout).
      // Erros de rede sao sinalizados pelo banner de conexao, nao por toast.
      if (isAuthError(error)) return;
      if (axios.isAxiosError(error) && !error.response) return;
      // so avisa quando ja havia dados (refetch falhou) ou a query pede explicitamente
      if (query.state.data === undefined && !query.meta?.toast) return;
      toast.error(getApiErrorMessage(error, "Falha ao atualizar dados."));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (isAuthError(error)) return;
      // mutations que tratam o proprio erro (toast local) nao duplicam
      if (mutation.options.onError) return;
      toast.error(getApiErrorMessage(error, "Falha ao executar a ação."));
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      // Polling só com a aba visível; dados recentes não refazem fetch a cada montagem.
      refetchIntervalInBackground: false,
      staleTime: 5_000,
    },
  },
});
