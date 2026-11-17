import { api } from "./client";
import type { AccessRelease, CreateAccessReleasePayload } from "@/types/access-release";

export async function listAccessReleases() {
  const response = await api.get<AccessRelease[]>("/api/v1/access-releases/");
  return response.data;
}

export async function createAccessRelease(payload: CreateAccessReleasePayload) {
  const response = await api.post<AccessRelease>("/api/v1/access-releases/", payload);
  return response.data;
}
