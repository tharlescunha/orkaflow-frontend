import { api } from "./client";

export type ApiTokenStatus = "ativo" | "revogado" | "expirado";

export type ApiToken = {
  id: number;
  name: string;
  token_prefix: string;
  status: ApiTokenStatus;
  created_at: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  revoked_at?: string | null;
};

// O valor completo do token só vem na resposta da criação.
export type ApiTokenCreated = ApiToken & { token: string };

export type ApiTokenCreatePayload = {
  name: string;
  expires_in_days: number | null;
};

export type McpTool = {
  name: string;
  title: string;
  description: string;
  input_schema: JsonSchema;
  kind: "consulta" | "ação";
};

export type McpInfo = {
  enabled: boolean;
  public_url_configured?: boolean;
  url: string;
  api_base_url: string;
  tools: McpTool[];
};

export type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  title?: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
};

export type OperationGuide = {
  summary?: string;
  description?: string;
  example_request?: unknown;
  example_response?: unknown;
};

export type OpenApiParameter = {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: JsonSchema;
};

export type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: JsonSchema }> }>;
  security?: Record<string, string[]>[];
  "x-orkaflow-guide"?: OperationGuide;
};

export type OpenApiSpec = {
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
  tags?: { name: string; description?: string }[];
  components?: { schemas?: Record<string, JsonSchema> };
};

export async function getDocumentedOpenApi() {
  const response = await api.get<OpenApiSpec>("/api/v1/integration/openapi");
  return response.data;
}

export async function getMcpInfo() {
  const response = await api.get<McpInfo>("/api/v1/integration/mcp-info");
  return response.data;
}

// Sem userId: tokens do usuário logado. Com userId: tokens de outro usuário (admin).
function tokensUrl(userId?: number) {
  return userId ? `/api/v1/users/${userId}/api-tokens` : "/api/v1/api-tokens/";
}

export async function listApiTokens(userId?: number) {
  const response = await api.get<ApiToken[]>(tokensUrl(userId));
  return response.data;
}

export async function createApiToken(payload: ApiTokenCreatePayload, userId?: number) {
  const response = await api.post<ApiTokenCreated>(tokensUrl(userId), payload);
  return response.data;
}

export async function revokeApiToken(tokenId: number, userId?: number) {
  const base = userId ? `/api/v1/users/${userId}/api-tokens` : "/api/v1/api-tokens";
  const response = await api.delete<ApiToken>(`${base}/${tokenId}`);
  return response.data;
}
