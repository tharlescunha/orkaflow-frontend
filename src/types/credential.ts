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
  created_at: string;
  updated_at?: string | null;
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
