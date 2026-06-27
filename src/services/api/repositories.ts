import { api } from "./client";

export type RepositoryRead = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type ListRepositoriesParams = {
  skip?: number;
  limit?: number;
  active?: boolean;
};

export type CreateRepositoryPayload = {
  name: string;
  description?: string | null;
  active?: boolean;
};

export type UpdateRepositoryPayload = {
  name?: string;
  description?: string | null;
  active?: boolean;
};

export async function listRepositories(
  params?: ListRepositoriesParams | boolean
) {
  const normalizedParams =
    typeof params === "boolean" ? { active: params } : params;

  const response = await api.get<RepositoryRead[]>("/api/v1/repositories/", {
    params: normalizedParams,
  });

  return response.data;
}

export async function getRepository(repositoryId: number) {
  const response = await api.get<RepositoryRead>(
    `/api/v1/repositories/${repositoryId}`
  );
  return response.data;
}

export async function createRepository(payload: CreateRepositoryPayload) {
  const response = await api.post<RepositoryRead>(
    "/api/v1/repositories/",
    payload
  );
  return response.data;
}

export async function updateRepository(
  repositoryId: number,
  payload: UpdateRepositoryPayload
) {
  const response = await api.put<RepositoryRead>(
    `/api/v1/repositories/${repositoryId}`,
    payload
  );
  return response.data;
}

export async function activateRepository(repositoryId: number) {
  return updateRepository(repositoryId, { active: true });
}

export async function disableRepository(repositoryId: number) {
  return updateRepository(repositoryId, { active: false });
}
