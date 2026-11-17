export type CredentialItem = {
  id: number;
  credential_id: number;
  key: string;
  value_type: string;
  masked_preview?: string | null;
  notes?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type CredentialRead = {
  id: number;
  label: string;
  repository_id: number;
  repository_name?: string | null;
  active: boolean;
  // Saúde: valida | nao_verificada | invalida | senha_incorreta | senha_expirada | usuario_bloqueado
  status?: string | null;
  status_reason?: string | null;
  status_updated_at?: string | null;
  status_task_id?: number | null;
  created_at: string;
  updated_at?: string | null;
};

/** Credencial bloqueada (senha errada/expirada, usuário bloqueado) e o que ela está segurando. */
export type BlockedCredential = {
  id: number;
  label: string;
  repository_id: number;
  repository_name?: string | null;
  status: string;
  status_label: string;
  status_reason?: string | null;
  status_updated_at?: string | null;
  status_task_id?: number | null;
  automations: { id: number; name?: string | null }[];
  schedules_paused: number;
};

export type CredentialUnblockResult = {
  id: number;
  status: string;
  schedules_reactivated: number;
};

export type CredentialWithItemsRead = CredentialRead & {
  items: CredentialItem[];
};

export type CredentialItemSecretRead = {
  id: number;
  credential_id: number;
  key: string;
  value_type: string;
  value: string;
  active: boolean;
};

export type CreateCredentialPayload = {
  label: string;
  repository_id: number;
  active: boolean;
};

export type UpdateCredentialPayload = {
  label?: string;
  repository_id?: number;
  active?: boolean;
};

export type CreateCredentialItemPayload = {
  key: string;
  value_type: string;
  value: string;
  notes?: string | null;
  active: boolean;
};

export type UpdateCredentialItemPayload = {
  key?: string;
  value_type?: string;
  value?: string;
  notes?: string | null;
  active?: boolean;
};

export type CredentialFilters = {
  skip?: number;
  limit?: number;
  active?: boolean;
  repository_id?: number;
};

export type RepositoryOption = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};
