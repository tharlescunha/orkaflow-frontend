import { useState } from "react";
import { Bot, Copy, Eye, Wrench } from "lucide-react";

import { ApiTokensCard } from "@/components/common/api-tokens-card";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { btn, card, input } from "@/lib/ui";
import type { McpInfo } from "@/services/api/integration";
import { CodeBlock } from "./api-docs-tab";

type ClientKey = "claude-code" | "claude-desktop" | "cursor" | "vscode" | "http";

const CLIENTS: { key: ClientKey; label: string }[] = [
  { key: "claude-code", label: "Claude Code" },
  { key: "claude-desktop", label: "Claude Desktop" },
  { key: "cursor", label: "Cursor" },
  { key: "vscode", label: "VS Code / Copilot" },
  { key: "http", label: "Outras IAs / teste" },
];

const EXAMPLE_QUESTIONS = [
  "Qual foi o status da última execução de cada automação?",
  "Quantas tasks rodaram hoje e quantas deram erro?",
  "Qual foi o erro da task 1234?",
  "A máquina SRV-RPA-01 está online? Está rodando alguma coisa agora?",
  "Roda a automação Automacao_Estoque_PO agora na fila manual.",
  "Tem versão nova no Git do bot RPA_Sigam? Se tiver, cria a versão.",
  "Pausa o agendamento da automação X até eu avisar.",
  "Cria um agendamento da automação X de segunda a sexta às 06:00.",
  "Vincula a máquina SRV-RPA-02 na automação X.",
  "Muda o timeout do bot RPA_Sigam para 90 minutos.",
  "Cadastra a variável SAP_URL só para a automação X.",
];

function snippets(url: string, token: string): Record<ClientKey, { intro: string; file?: string; code: string }[]> {
  const auth = `Bearer ${token}`;
  return {
    "claude-code": [
      {
        intro: "No terminal, rode uma vez (fica salvo no seu usuário com --scope user; sem ele, vale só para a pasta atual):",
        code: `claude mcp add --transport http --scope user orkaflow ${url} --header "Authorization: ${auth}"`,
      },
      { intro: "Para conferir se conectou:", code: "claude mcp list" },
    ],
    "claude-desktop": [
      {
        intro:
          "Em Configurações › Desenvolvedor › Editar configuração, abra o claude_desktop_config.json, adicione o bloco abaixo e reinicie o Claude Desktop. Precisa do Node.js instalado (o mcp-remote faz a ponte HTTP).",
        file: "claude_desktop_config.json",
        code: JSON.stringify(
          {
            mcpServers: {
              orkaflow: {
                command: "npx",
                args: ["-y", "mcp-remote", url, "--header", "Authorization:${ORKAFLOW_AUTH}"],
                env: { ORKAFLOW_AUTH: auth },
              },
            },
          },
          null,
          2
        ),
      },
    ],
    cursor: [
      {
        intro: "Em Settings › MCP › Add new global MCP server (ou no arquivo do projeto), adicione:",
        file: "~/.cursor/mcp.json",
        code: JSON.stringify({ mcpServers: { orkaflow: { url, headers: { Authorization: auth } } } }, null, 2),
      },
    ],
    vscode: [
      {
        intro: "Crie o arquivo na raiz do projeto (ou use o comando “MCP: Add Server”) e ative no modo agente do Copilot:",
        file: ".vscode/mcp.json",
        code: JSON.stringify({ servers: { orkaflow: { type: "http", url, headers: { Authorization: auth } } } }, null, 2),
      },
    ],
    http: [
      {
        intro:
          "Qualquer cliente MCP com transporte “Streamable HTTP” funciona: informe a URL e o header Authorization. Para testar na mão:",
        code: [
          `curl -X POST "${url}" \\`,
          `  -H "Authorization: ${auth}" \\`,
          `  -H "Content-Type: application/json" \\`,
          `  -H "Accept: application/json, text/event-stream" \\`,
          `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
        ].join("\n"),
      },
    ],
  };
}

export function McpTab({ info, url }: { info: McpInfo; url: string }) {
  const [client, setClient] = useState<ClientKey>("claude-code");
  const [token, setToken] = useState("");

  if (!info.enabled) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        O MCP está desligado neste servidor (ENABLE_MCP=false).
      </p>
    );
  }

  const tokenValue = token.trim() || "ork_SEU_TOKEN";
  const blocks = snippets(url, tokenValue)[client];
  const queries = info.tools.filter((t) => t.kind === "consulta");
  const actions = info.tools.filter((t) => t.kind !== "consulta");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="text-sm text-slate-700">
          O <strong>MCP</strong> (Model Context Protocol) deixa uma IA como o Claude consultar e operar o OrkaFlow
          conversando: tudo que o painel faz em Operação, Execução, Automação e Segurança — consultar status e erros,
          rodar e parar tasks, cadastrar e alterar bots, versões, automações, vínculos de máquina, agendamentos,
          variáveis e credenciais. A IA usa as mesmas permissões do dono do token e confirma com você antes de qualquer
          alteração. Valores de credenciais nunca são mostrados a ela.
        </p>
        <div className="flex flex-wrap items-stretch gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">URL do MCP</span>
            <code className="min-w-0 truncate font-mono text-sm text-slate-900">{url}</code>
          </div>
          <button
            type="button"
            onClick={() => copyText(url)}
            className={btn.secondary}
          >
            <Copy className="h-4 w-4" />
            Copiar
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <StepTitle n={1} title="Gere um token" />
        <ApiTokensCard hideGuideLink onCreated={setToken} />
      </section>

      <section className="space-y-3">
        <StepTitle n={2} title="Adicione o OrkaFlow na sua IA" />
        <label className="block max-w-xl">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cole o token aqui para já sair pronto nos exemplos (fica só nesta tela)
          </span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ork_..."
            autoComplete="off"
            spellCheck={false}
            className={cn(input, "font-mono")}
          />
        </label>
        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {CLIENTS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setClient(c.key)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
                client === c.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          {blocks.map((block) => (
            <div key={block.code} className="space-y-2">
              <p className="text-sm text-slate-700">{block.intro}</p>
              <CodeBlock title={block.file ?? "Comando"} code={block.code} />
            </div>
          ))}
          {client === "claude-desktop" && (
            <p className="text-xs text-slate-500">
              Os conectores personalizados do claude.ai (web) pedem login OAuth e não aceitam token fixo; para eles use o
              Claude Desktop ou o Claude Code.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <StepTitle n={3} title="Pergunte" />
        <ul className="grid gap-2 md:grid-cols-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <li key={q} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              {q}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">Ferramentas disponíveis ({info.tools.length})</h2>
        <ToolList title="Consultas" icon="eye" tools={queries} />
        <ToolList title="Ações" icon="wrench" tools={actions} />
      </section>
    </div>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-3 text-lg font-semibold text-slate-950">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{n}</span>
      {title}
    </h2>
  );
}

function ToolList({ title, icon, tools }: { title: string; icon: "eye" | "wrench"; tools: McpInfo["tools"] }) {
  const Icon = icon === "eye" ? Eye : Wrench;
  return (
    <div className={card}>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
        <Icon className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{title}</h3>
      </div>
      <ul className="divide-y divide-slate-100">
        {tools.map((tool) => {
          const params = Object.keys(tool.input_schema.properties ?? {});
          return (
            <li key={tool.name} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <code className="font-mono text-sm font-semibold text-slate-900">{tool.name}</code>
                <span className="text-sm text-slate-500">{tool.title}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{tool.description}</p>
              {params.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Parâmetros: {params.map((p) => <code key={p} className="mr-1.5 bg-slate-100 px-1 font-mono">{p}</code>)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
