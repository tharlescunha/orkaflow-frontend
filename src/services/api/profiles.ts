import { api } from "./client";

export type PermissionRead = {
  id: number;
  module: string;
  action: string;
  description?: string | null;
};

export type ProfileRead = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  permissions: PermissionRead[];
  created_at: string;
  updated_at?: string | null;
};

export type ListProfilesParams = {
  skip?: number;
  limit?: number;
  active?: boolean;
};

export type CreateProfilePayload = {
  name: string;
  description?: string | null;
  active: boolean;
  permission_ids: number[];
};

export type UpdateProfilePayload = {
  name?: string;
  description?: string | null;
  active?: boolean;
  permission_ids?: number[];
};

export async function listProfiles(params: ListProfilesParams = {}) {
  const response = await api.get<ProfileRead[]>("/api/v1/profiles/", {
    params,
  });
  return response.data;
}

export async function getProfileById(profileId: number) {
  const response = await api.get<ProfileRead>(`/api/v1/profiles/${profileId}`);
  return response.data;
}

export async function createProfile(payload: CreateProfilePayload) {
  const response = await api.post<ProfileRead>("/api/v1/profiles/", payload);
  return response.data;
}

export async function updateProfile(
  profileId: number,
  payload: UpdateProfilePayload
) {
  const response = await api.put<ProfileRead>(
    `/api/v1/profiles/${profileId}`,
    payload
  );
  return response.data;
}

export async function activateProfile(profileId: number) {
  const response = await api.post<ProfileRead>(
    `/api/v1/profiles/${profileId}/activate`
  );
  return response.data;
}

export async function deactivateProfile(profileId: number) {
  const response = await api.post<ProfileRead>(
    `/api/v1/profiles/${profileId}/deactivate`
  );
  return response.data;
}
