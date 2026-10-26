import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Copy, Lock, Search } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api-error";
import { copyText } from "@/lib/clipboard";
import { normalizeSearch } from "@/lib/search";
import { inputWithIcon } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { getDocumentedOpenApi, type OpenApiSpec } from "@/services/api/integration";
import { SimpleMarkdown } from "./simple-markdown";
import {
  buildCurl,
  exampleFromSchema,
  groupOperations,
  needsToken,
  requestSchema,
  resolveSchema,
  responseSchema,
  toJson,
  typeLabel,
  type DocGroup,
  type DocOperation,
} from "./openapi-utils";

const METHOD_STYLE: Record<string, string> = {
  get: "bg-sky-100 text-sky-800 border-sky-200",
  post: "bg-emerald-100 text-emerald-800 border-emerald-200",
  put: "bg-amber-100 text-amber-800 border-amber-200",
  patch: "bg-violet-100 text-violet-800 border-violet-200",
  delete: "bg-red-100 text-red-800 border-red-200",
};

const PARAM_PLACE: Record<string, string> = { path: "na URL", query: "query string", header: "header", cookie: "cookie" };

function slug(tag: string) {
  return `grupo-${normalizeSearch(tag).replace(/[^a-z0-9]+/g, "-")}`;
}

export function ApiDocsTab({ baseUrl }: { baseUrl: string }) {
  const [search, setSearch] = useState("");
  const [showInternal, setShowInternal] = useState(false);

  const specQuery = useQuery({ queryKey: ["integration-openapi"], queryFn: getDocumentedOpenApi, staleTime: 5 * 60_000 });

  const groups = useMemo(() => (specQuery.data ? groupOperations(specQuery.data) : []), [specQuery.data]);

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return groups
      .filter((g) => showInternal || !g.internal || term)
      .map((g) => ({
        ...g,
        operations: term
          ? g.operations.filter((o) => {
              const guide = o.op["x-orkaflow-guide"];
              const haystack = [o.key, o.tag, o.op.summary, guide?.description].join(" ");
              return normalizeSearch(haystack).includes(term);
            })
          : g.operations,
      }))
      .filter((g) => g.operations.length > 0);
  }, [groups, search, showInternal]);

  if (specQuery.isLoading) return <p className="p-6 text-sm text-slate-500">Carregando documentação...</p>;
  if (specQuery.isError || !specQuery.data) {
    return (
      <p className="m-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {getApiErrorMessage(specQuery.error, "Não foi possível carregar a documentação da API.")}
      </p>
    );
  }

  const spec = specQuery.data;
  const total = groups.reduce((n, g) => n + g.operations.length, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar rota ou assunto"
            className={inputWithIcon}
          />
        </div>
        <nav className="hidden max-h-[70vh] space-y-0.5 overflow-y-auto pr-1 lg:block">
          {filtered.map((g) => (
            <a
              key={g.tag}
              href={`#${slug(g.tag)}`}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700"
            >
              <span className="truncate">{g.tag}</span>
              <span className="shrink-0 text-xs text-slate-400">{g.operations.length}</span>
            </a>
          ))}
        </nav>
        <label className="flex items-center gap-2 px-2 text-xs text-slate-500">
          <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} />
          Mostrar rotas internas do worker
        </label>
      </aside>

      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p>
            <strong>{total} rotas</strong> com base <code className="bg-white px-1 font-mono text-xs">{baseUrl}</code>. As
            rotas com <Lock className="inline h-3.5 w-3.5" /> exigem o header{" "}
            <code className="bg-white px-1 font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>; o token pode ser
            um token de integração (<code className="font-mono text-xs">ork_...</code>, gerado no Perfil) ou o de login.
            Datas seguem ISO 8601 e o corpo é sempre JSON.
          </p>
        </div>

        {filtered.length === 0 && <p className="text-sm text-slate-500">Nenhuma rota encontrada.</p>}

        {filtered.map((group) => (
          <GroupSection key={group.tag} group={group} spec={spec} baseUrl={baseUrl} />
        ))}
      </div>
    </div>
  );
}

function GroupSection({ group, spec, baseUrl }: { group: DocGroup; spec: OpenApiSpec; baseUrl: string }) {
  return (
    <section id={slug(group.tag)} className="scroll-mt-4 space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          {group.tag}
          {group.internal && (
            <span className="ml-2 border border-slate-200 bg-slate-100 px-2 py-0.5 align-middle text-xs font-medium text-slate-500">
              interno (agente das máquinas)
            </span>
          )}
        </h2>
        {group.description && (
          <div className="mt-1">
            <SimpleMarkdown text={group.description} />
          </div>
        )}
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {group.operations.map((operation) => (
          <OperationRow key={operation.key} operation={operation} spec={spec} baseUrl={baseUrl} />
        ))}
      </div>
    </section>
  );
}

function OperationRow({ operation, spec, baseUrl }: { operation: DocOperation; spec: OpenApiSpec; baseUrl: string }) {
  const [open, setOpen] = useState(false);
  const { op } = operation;
  const guide = op["x-orkaflow-guide"];

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span
          className={cn(
            "w-16 shrink-0 rounded-md border py-0.5 text-center font-mono text-[11px] font-bold uppercase",
            METHOD_STYLE[operation.method]
          )}
        >
          {operation.method}
        </span>
        <code className="min-w-0 truncate font-mono text-sm text-slate-900" title={operation.path}>
          {operation.path}
        </code>
        {needsToken(operation) && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <span className="ml-auto hidden min-w-0 truncate text-sm text-slate-500 md:block">{op.summary}</span>
      </button>
      {open && <OperationDetail operation={operation} spec={spec} baseUrl={baseUrl} guideText={guide?.description} />}
    </div>
  );
}

function OperationDetail({
  operation,
  spec,
  baseUrl,
  guideText,
}: {
  operation: DocOperation;
  spec: OpenApiSpec;
  baseUrl: string;
  guideText?: string;
}) {
  const { op } = operation;
  const guide = op["x-orkaflow-guide"];
  const bodySchema = requestSchema(op);
  const body = bodySchema ? (guide?.example_request ?? exampleFromSchema(spec, bodySchema)) : undefined;
  const response = responseSchema(op);
  const responseExample = guide?.example_response ?? (response?.schema ? exampleFromSchema(spec, response.schema) : undefined);
  const bodyFields = Object.entries(resolveSchema(spec, bodySchema)?.properties ?? {});
  const bodyRequired = new Set(resolveSchema(spec, bodySchema)?.required ?? []);
  const curl = buildCurl(baseUrl, operation, body);

  return (
    <div className="space-y-5 border-t border-slate-100 bg-slate-50/50 px-4 py-4 md:px-11">
      {op.summary && <p className="text-sm font-medium text-slate-900">{op.summary}</p>}
      {guideText ? (
        <SimpleMarkdown text={guideText} />
      ) : op.description ? (
        <SimpleMarkdown text={op.description} />
      ) : null}

      {op.parameters && op.parameters.length > 0 && (
        <Block title="Parâmetros">
          <FieldTable
            rows={op.parameters.map((p) => ({
              name: p.name,
              where: PARAM_PLACE[p.in] ?? p.in,
              type: typeLabel(spec, p.schema),
              required: Boolean(p.required),
              description: p.description ?? p.schema?.description ?? "",
            }))}
          />
        </Block>
      )}

      {bodyFields.length > 0 && (
        <Block title="Campos do corpo (JSON)">
          <FieldTable
            rows={bodyFields.map(([name, schema]) => ({
              name,
              type: typeLabel(spec, schema),
              required: bodyRequired.has(name),
              description: resolveSchema(spec, schema)?.description ?? schema.description ?? "",
            }))}
          />
        </Block>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {body !== undefined && <CodeBlock title="Exemplo de corpo" code={toJson(body)} />}
        {responseExample !== undefined && (
          <CodeBlock title={`Exemplo de resposta (${response?.status ?? "200"})`} code={toJson(responseExample)} />
        )}
      </div>

      <CodeBlock title="Exemplo com curl" code={curl} />
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

type FieldRow = { name: string; where?: string; type: string; required: boolean; description: string };

function FieldTable({ rows }: { rows: FieldRow[] }) {
  const showWhere = rows.some((r) => r.where);
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-semibold">Nome</th>
            {showWhere && <th className="px-3 py-2 font-semibold">Onde</th>}
            <th className="px-3 py-2 font-semibold">Tipo</th>
            <th className="px-3 py-2 font-semibold">Descrição</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.where}-${row.name}`} className="border-b border-slate-100 align-top last:border-b-0">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-900">
                {row.name}
                {row.required && <span className="ml-1 text-red-600" title="Obrigatório">*</span>}
              </td>
              {showWhere && <td className="whitespace-nowrap px-3 py-2 text-slate-500">{row.where}</td>}
              <td className="px-3 py-2 text-slate-600">{row.type}</td>
              <td className="px-3 py-2 text-slate-600">{row.description || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <button
          type="button"
          onClick={() => copyText(code)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-blue-700"
        >
          <Copy className="h-3.5 w-3.5" />
          Copiar
        </button>
      </div>
      <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">{code}</pre>
    </div>
  );
}
