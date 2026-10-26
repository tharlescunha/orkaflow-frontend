import type { JsonSchema, OpenApiOperation, OpenApiSpec } from "@/services/api/integration";

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export type DocOperation = {
  key: string;
  method: string;
  path: string;
  tag: string;
  op: OpenApiOperation;
};

export type DocGroup = {
  tag: string;
  description: string;
  operations: DocOperation[];
  // Rotas usadas pelo agente das máquinas: integrações normalmente não usam.
  internal: boolean;
};

export function groupOperations(spec: OpenApiSpec): DocGroup[] {
  const descriptions = new Map((spec.tags ?? []).map((t) => [t.name, t.description ?? ""]));
  const groups = new Map<string, DocOperation[]>();

  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (!op) continue;
      const tag = op.tags?.[0] ?? "Outros";
      const list = groups.get(tag) ?? [];
      list.push({ key: `${method.toUpperCase()} ${path}`, method, path, tag, op });
      groups.set(tag, list);
    }
  }

  return [...groups.entries()]
    .map(([tag, operations]) => ({
      tag,
      description: descriptions.get(tag) ?? "",
      operations,
      internal: tag.startsWith("Worker"),
    }))
    .sort((a, b) => Number(a.internal) - Number(b.internal) || a.tag.localeCompare(b.tag, "pt-BR"));
}

export function resolveSchema(spec: OpenApiSpec, schema?: JsonSchema, depth = 0): JsonSchema | undefined {
  if (!schema || depth > 8) return schema;
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop() ?? "";
    return resolveSchema(spec, spec.components?.schemas?.[name], depth + 1);
  }
  return schema;
}

// Tira o "null" de anyOf [X, null] (campos opcionais do Pydantic).
function unwrapNullable(spec: OpenApiSpec, schema: JsonSchema | undefined, depth: number) {
  const resolved = resolveSchema(spec, schema, depth);
  const variants = resolved?.anyOf ?? resolved?.oneOf;
  if (variants) {
    const notNull = variants.filter((v) => v.type !== "null");
    if (notNull.length === 1) return { schema: resolveSchema(spec, notNull[0], depth), nullable: true };
  }
  return { schema: resolved, nullable: false };
}

export function typeLabel(spec: OpenApiSpec, schema?: JsonSchema, depth = 0): string {
  const { schema: s, nullable } = unwrapNullable(spec, schema, depth);
  if (!s) return "qualquer";
  let label: string;
  if (s.enum) label = s.enum.map((v) => JSON.stringify(v)).join(" | ");
  else if (s.type === "array") label = `lista de ${typeLabel(spec, s.items, depth + 1)}`;
  else if (s.title && s.properties) label = s.title;
  else if (s.format === "date-time") label = "data/hora";
  else if (s.format === "date") label = "data";
  else if (s.type === "integer") label = "inteiro";
  else if (s.type === "number") label = "número";
  else if (s.type === "boolean") label = "true/false";
  else if (s.type === "string") label = "texto";
  else if (s.type === "object") label = "objeto";
  else label = "qualquer";
  return nullable ? `${label} (opcional)` : label;
}

export function exampleFromSchema(spec: OpenApiSpec, schema?: JsonSchema, depth = 0): unknown {
  const { schema: s } = unwrapNullable(spec, schema, depth);
  if (!s || depth > 6) return null;
  if (s.example !== undefined) return s.example;
  if (s.examples?.length) return s.examples[0];
  if (s.default !== undefined && s.default !== null) return s.default;
  if (s.enum?.length) return s.enum[0];
  if (s.allOf?.length) return exampleFromSchema(spec, s.allOf[0], depth + 1);

  switch (s.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [name, prop] of Object.entries(s.properties ?? {})) {
        out[name] = exampleFromSchema(spec, prop, depth + 1);
      }
      return out;
    }
    case "array":
      return [exampleFromSchema(spec, s.items, depth + 1)];
    case "integer":
      return 1;
    case "number":
      return 1.5;
    case "boolean":
      return true;
    case "string":
      if (s.format === "date-time") return "2026-01-31T08:00:00-03:00";
      if (s.format === "date") return "2026-01-31";
      return "texto";
    default:
      return s.properties ? exampleFromSchema(spec, { ...s, type: "object" }, depth) : null;
  }
}

export function requestSchema(op: OpenApiOperation): JsonSchema | undefined {
  return op.requestBody?.content?.["application/json"]?.schema;
}

export function responseSchema(op: OpenApiOperation): { status: string; schema?: JsonSchema } | undefined {
  const entry = Object.entries(op.responses ?? {}).find(([status]) => status.startsWith("2"));
  if (!entry) return undefined;
  return { status: entry[0], schema: entry[1].content?.["application/json"]?.schema };
}

// Rotas protegidas trazem "security" (HTTPBearer); as públicas e as do worker não.
export function needsToken(operation: DocOperation) {
  return Boolean(operation.op.security?.length);
}

export function buildCurl(baseUrl: string, operation: DocOperation, body: unknown) {
  const lines = [`curl -X ${operation.method.toUpperCase()} "${baseUrl}${operation.path}"`];
  if (needsToken(operation)) lines.push(`  -H "Authorization: Bearer $ORKAFLOW_TOKEN"`);
  if (body !== undefined) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${JSON.stringify(body)}'`);
  }
  return lines.join(" \\\n");
}

export function toJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}
