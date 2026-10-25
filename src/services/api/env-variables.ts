import { api } from "./client";

export type EnvScopeType = "global" | "bot" | "automation" | "runner";

export type EnvVariableRead = {
  id: number;
  name: string;
  scope_type: EnvScopeType;
  scope_id: number;
  scope_label: string;
  is_secret: boolean;
  value: string | null;
  description: string | null;
  active: boolean;
  updated_at: string | null;
};

export type ListEnvVariablesParams = {
  scope_type?: EnvScopeType;
  scope_id?: number;
  search?: string;
};

export type CreateEnvVariablePayload = {
  name: string;
  scope_type: EnvScopeType;
  scope_id: number | null;
  value: string;
  is_secret: boolean;
  description: string | null;
  active: boolean;
};

export type UpdateEnvVariablePayload = {
  name?: string;
  value?: string | null;
  is_secret?: boolean;
  description?: string | null;
  active?: boolean;
};

export type EffectiveEnvOverride = {
  scope_type: EnvScopeType;
  scope_label: string;
};

export type EffectiveEnvVariable = {
  name: string;
  value: string | null;
  is_secret: boolean;
  scope_type: EnvScopeType;
  scope_id: number;
  scope_label: string;
  overrides: EffectiveEnvOverride[];
};

export async function listEnvVariables(params: ListEnvVariablesParams = {}) {
  const response = await api.get<EnvVariableRead[]>("/api/v1/env-variables/", { params });
  return response.data;
}

export async function createEnvVariable(payload: CreateEnvVariablePayload) {
  const response = await api.post<EnvVariableRead>("/api/v1/env-variables/", payload);
  return response.data;
}

export async function updateEnvVariable(id: number, payload: UpdateEnvVariablePayload) {
  const response = await api.put<EnvVariableRead>(`/api/v1/env-variables/${id}`, payload);
  return response.data;
}

export async function deleteEnvVariable(id: number) {
  await api.delete(`/api/v1/env-variables/${id}`);
}

export type ImportEnvVariablesPayload = {
  scope_type: EnvScopeType;
  scope_id: number | null;
  // true: atualiza o valor das que já existem no escopo; false: mantém as existentes.
  overwrite: boolean;
  variables: { name: string; value: string; is_secret: boolean }[];
};

export type ImportEnvVariablesResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  results: { name: string; status: "created" | "updated" | "skipped" | "error"; message: string | null }[];
};

export async function importEnvVariables(payload: ImportEnvVariablesPayload) {
  const response = await api.post<ImportEnvVariablesResult>("/api/v1/env-variables/import", payload);
  return response.data;
}

export async function getEffectiveEnvVariables(params: {
  automation_id: number;
  runner_id?: number;
}) {
  const response = await api.get<EffectiveEnvVariable[]>("/api/v1/env-variables/effective", {
    params,
  });
  return response.data;
}
