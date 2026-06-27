import { api } from "./client";

export type PermissionRead = {
  id: number;
  module: string;
  action: string;
  description?: string | null;
};

export async function listPermissions() {
  const response = await api.get<PermissionRead[]>("/api/v1/permissions/");
  return response.data;
}
