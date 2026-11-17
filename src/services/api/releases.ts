import { api } from "./client";
import type { ReleaseNotes, ReleaseVersion } from "@/types/release";

/** Histórico completo das atualizações (exige login). */
export async function listReleases() {
  const response = await api.get<ReleaseNotes>("/api/v1/releases/");
  return response.data;
}

/** Versão atual, sem login (selo da tela de entrada). */
export async function getCurrentVersion() {
  const response = await api.get<ReleaseVersion>("/api/v1/version");
  return response.data;
}
