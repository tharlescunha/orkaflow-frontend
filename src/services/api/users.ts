import { api } from "./client";

export type UserPermissionRead = {
  id: number;
  module: string;
  action: string;
  description?: string | null;
};

export type UserProfileRead = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  permissions: UserPermissionRead[];
};

export type UserRead = {
  id: number;
  name: string;
  login: string;
  email: string;
  active: boolean;
  role: string;
  profile_id?: number | null;
  profile?: UserProfileRead | null;
  created_at: string;
  updated_at?: string | null;
};

export type ListUsersParams = {
  skip?: number;
  limit?: number;
  active?: boolean;
  profile_id?: number;
  search?: string;
};

export type CreateUserPayload = {
  name: string;
  login: string;
  email: string;
  active: boolean;
  role: string;
  profile_id?: number | null;
  password: string;
};

export type UpdateUserPayload = {
  name?: string;
  login?: string;
  email?: string;
  active?: boolean;
  role?: string;
  profile_id?: number | null;
  password?: string;
};

export type ChangeUserStatusPayload = {
  active: boolean;
};

export async function listUsers(params: ListUsersParams = {}) {
  const response = await api.get<UserRead[]>("/api/v1/users/", {
    params,
  });
  return response.data;
}

export async function getUserById(userId: number) {
  const response = await api.get<UserRead>(`/api/v1/users/${userId}`);
  return response.data;
}

export async function createUser(payload: CreateUserPayload) {
  const response = await api.post<UserRead>("/api/v1/users/", payload);
  return response.data;
}

export async function updateUser(userId: number, payload: UpdateUserPayload) {
  const response = await api.put<UserRead>(`/api/v1/users/${userId}`, payload);
  return response.data;
}

export async function changeUserStatus(
  userId: number,
  payload: ChangeUserStatusPayload
) {
  const response = await api.patch<UserRead>(
    `/api/v1/users/${userId}/status`,
    payload
  );
  return response.data;
}

export async function blockUser(userId: number) {
  const response = await api.post<UserRead>(`/api/v1/users/${userId}/block`);
  return response.data;
}

export async function unblockUser(userId: number) {
  const response = await api.post<UserRead>(`/api/v1/users/${userId}/unblock`);
  return response.data;
}

export async function deleteUser(userId: number) {
  const response = await api.delete<UserRead>(`/api/v1/users/${userId}`);
  return response.data;
}
