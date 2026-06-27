import { api } from "./client";
import type {
  CreateCredentialItemPayload,
  CreateCredentialPayload,
  CredentialFilters,
  CredentialItem,
  CredentialItemSecretRead,
  CredentialRead,
  CredentialWithItemsRead,
  UpdateCredentialItemPayload,
  UpdateCredentialPayload,
} from "@/types/credential";

export async function listCredentials(params: CredentialFilters = {}) {
  const response = await api.get<CredentialRead[]>("/api/v1/credentials/", {
    params,
  });

  return response.data;
}

export async function getCredential(credentialId: number) {
  const response = await api.get<CredentialWithItemsRead>(
    `/api/v1/credentials/${credentialId}`
  );

  return response.data;
}

export async function createCredential(payload: CreateCredentialPayload) {
  const response = await api.post<CredentialRead>("/api/v1/credentials/", payload);
  return response.data;
}

export async function updateCredential(
  credentialId: number,
  payload: UpdateCredentialPayload
) {
  const response = await api.put<CredentialRead>(
    `/api/v1/credentials/${credentialId}`,
    payload
  );
  return response.data;
}

export async function deleteCredential(credentialId: number) {
  const response = await api.delete<CredentialRead>(
    `/api/v1/credentials/${credentialId}`
  );
  return response.data;
}

export async function listCredentialItems(
  credentialId: number,
  active?: boolean
) {
  const response = await api.get<CredentialItem[]>(
    `/api/v1/credentials/${credentialId}/items`,
    {
      params: active === undefined ? undefined : { active },
    }
  );

  return response.data;
}

export async function createCredentialItem(
  credentialId: number,
  payload: CreateCredentialItemPayload
) {
  const response = await api.post<CredentialItem>(
    `/api/v1/credentials/${credentialId}/items`,
    payload
  );

  return response.data;
}

export async function updateCredentialItem(
  credentialId: number,
  itemId: number,
  payload: UpdateCredentialItemPayload
) {
  const response = await api.put<CredentialItem>(
    `/api/v1/credentials/${credentialId}/items/${itemId}`,
    payload
  );

  return response.data;
}

export async function deleteCredentialItem(
  credentialId: number,
  itemId: number
) {
  const response = await api.delete<CredentialItem>(
    `/api/v1/credentials/${credentialId}/items/${itemId}`
  );

  return response.data;
}

export async function revealCredentialItemSecret(
  credentialId: number,
  itemId: number
) {
  const response = await api.get<CredentialItemSecretRead>(
    `/api/v1/credentials/${credentialId}/items/${itemId}/reveal`
  );

  return response.data;
}
