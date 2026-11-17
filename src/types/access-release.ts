/** Aviso de que um usuário bloqueado (ex.: aprovador do SAP) já foi corrigido e os robôs podem voltar a usá-lo. */
export type AccessRelease = {
  login: string;
  system?: string | null;
  note?: string | null;
  // UTC, ex.: 2026-11-17T14:10:00Z (é o que o robô recebe em LIBERACOES_DE_ACESSO)
  released_at: string;
  released_by_id?: number | null;
  released_by_name?: string | null;
  // Ainda entregue aos robôs (últimas 48 h).
  active: boolean;
};

export type CreateAccessReleasePayload = {
  login: string;
  system?: string | null;
  note?: string | null;
};
