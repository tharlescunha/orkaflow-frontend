import { api } from "./client";

/** Banco em estado crítico agora (leitura direta, mesmos limites da tela Database Status). */
export type DatabaseAlert = {
  server: string | null;
  name: string;
  dtu: number;
  reasons: string[];
};

export type DatabaseAlertsResponse = {
  items: DatabaseAlert[];
  checked: number;
  generated: string;
};

export async function getDatabaseAlerts() {
  // A primeira chamada descobre os bancos e lê cada um: pode levar algumas dezenas de segundos.
  const response = await api.get<DatabaseAlertsResponse>("/api/v1/dbstatus/alerts", { timeout: 90_000 });
  return response.data;
}
