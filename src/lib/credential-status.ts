/** Saúde da credencial, como o backend devolve em `status`. */
export type CredentialStatus =
  | "valida"
  | "nao_verificada"
  | "invalida"
  | "senha_incorreta"
  | "senha_expirada"
  | "usuario_bloqueado";

export const CREDENTIAL_STATUS_LABEL: Record<string, string> = {
  valida: "Válida",
  nao_verificada: "Não verificada",
  invalida: "Inválida",
  senha_incorreta: "Senha incorreta",
  senha_expirada: "Senha expirada",
  usuario_bloqueado: "Usuário bloqueado",
};

export function isCredentialInvalid(status?: string | null) {
  return status === "invalida" || status === "senha_incorreta" || status === "senha_expirada" || status === "usuario_bloqueado";
}

export function credentialStatusLabel(status?: string | null) {
  return CREDENTIAL_STATUS_LABEL[status ?? ""] ?? status ?? "Não verificada";
}
