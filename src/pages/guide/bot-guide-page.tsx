import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Code2,
  GitBranch,
  KeyRound,
  Laptop,
  ListChecks,
  PlaySquare,
  Rocket,
} from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { CopyButton } from "@/pages/notifications/json-block";
import { badge, btn, card, cardBody, cardHeader, cardTitle, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";

import {
  CODE_CREDENTIAL_LEGACY,
  CODE_CREDENTIAL_MAESTRO,
  CODE_FULL_MAESTRO,
  CODE_INPUT_LEGACY,
  CODE_INPUT_MAESTRO,
  CODE_LOCAL_INSTALL,
  CODE_LOCAL_RUN,
  CODE_MAIN_LEGACY,
  CODE_MAIN_MAESTRO,
  CODE_OUTPUT_LEGACY,
  CODE_OUTPUT_MAESTRO,
  CODE_TASK_JSON,
  MAESTRO_REFERENCE,
} from "./bot-guide-code";
import { TOKEN_CLASS, tokenize, type Lang } from "./code-highlight";

/**
 * Guia do Bot: como montar um robô para o orquestrador, do main.py ao agendamento.
 * Uma ideia por seção, código curto, os dois jeitos (Maestro e JSON) lado a lado.
 * Instalação do worker nas máquinas fica em Runner Config (é do PPI, não de quem faz o robô).
 */
export function BotGuidePage() {
  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Guia do Bot"
          description="Como montar um robô para o orquestrador: do main.py até o agendamento. Qualquer pessoa consegue; não precisa instalar nada nas máquinas."
          actions={
            <>
              <a href="#jornada" className={btn.secondary}>
                Passo a passo
              </a>
              <a href="#maestro" className={btn.primary}>
                Guia do Maestro
                <ArrowRight className="h-4 w-4" />
              </a>
            </>
          }
        />

        <div className={cn(cardBody, "grid gap-4 md:grid-cols-3")}>
          <Rule title="Um main.py na raiz">
            O orquestrador roda <Inline>python main.py</Inline> na pasta do robô. Tudo começa numa função{" "}
            <Inline>main()</Inline>.
          </Rule>
          <Rule title="Terminar bem = sucesso">
            Processo que termina normal vira task com sucesso. <Inline>sys.exit(1)</Inline> (ou qualquer código diferente de 0) vira
            erro. O Maestro faz isso por você.
          </Rule>
          <Rule title="Fale enquanto roda">
            Tudo que o robô imprime vai para o log da task. Robô mudo por 10 minutos é considerado travado e encerrado.
          </Rule>
        </div>
      </section>

      <Panel id="jornada" title="Passo a passo" icon={<ListChecks className="h-4 w-4 text-blue-600" />}>
        <ol className="grid gap-4 lg:grid-cols-2">
          <Step n={1} icon={<Code2 className="h-4 w-4" />} title="Monte a main">
            <p>
              Crie a pasta do robô com <Inline>main.py</Inline> e <Inline>requirements.txt</Inline>. A main só chama o seu código e
              termina dizendo se deu certo. O Maestro não precisa ser instalado no robô: o worker coloca nas máquinas.
            </p>
            <Code title="main.py" code={CODE_MAIN_MAESTRO} />
          </Step>

          <Step n={2} icon={<Laptop className="h-4 w-4" />} title="Teste na sua máquina">
            <p>
              Instale o Maestro uma vez, gere o <Inline>task.json</Inline> de exemplo e rode com <Inline>producao=False</Inline>:
              logs no console, resultado em <Inline>resultado.json</Inline>, nada vai para a rede.
            </p>
            <Code title="Terminal" code={CODE_LOCAL_INSTALL} lang="shell" />
            <Code title="No robô" code={CODE_LOCAL_RUN} />
            <Details summary="Como é o task.json">
              <Code title="task.json" code={CODE_TASK_JSON} lang="json" />
            </Details>
          </Step>

          <Step n={3} icon={<GitBranch className="h-4 w-4" />} title="Suba no Git">
            <p>
              Azure DevOps ou GitHub, tanto faz. Copie o link do repositório <strong>com o token de acesso</strong> (o orquestrador
              usa esse link para clonar nas máquinas; o token nunca aparece nas telas).
            </p>
          </Step>

          <Step n={4} icon={<PlaySquare className="h-4 w-4" />} title="Cadastre o bot">
            <p>
              Automação → Bots → <strong>Novo bot</strong>: cole o link e clique em <strong>Sincronizar</strong>. Nome, descrição e
              versão vêm do repositório. Deixe <em>"lê o arquivo da task por argumento"</em> desmarcado (só robô antigo precisa).
            </p>
          </Step>

          <Step n={5} icon={<KeyRound className="h-4 w-4" />} title="Crie a automação">
            <p>
              Automação → Automações → Nova: escolha o bot, as máquinas que podem rodar, os parâmetros padrão e a credencial
              (bloco <em>dados_acesso</em>). O robô lê tudo isso com <Inline>maestro.param</Inline> e{" "}
              <Inline>maestro.credential</Inline>.
            </p>
          </Step>

          <Step n={6} icon={<Rocket className="h-4 w-4" />} title="Rode ou agende">
            <p>
              <strong>Nova task</strong> roda agora; <strong>Agendamentos</strong> define horário, calendário e retentativa. Acompanhe em
              Tasks: etapa, log, print no erro e arquivos anexados.
            </p>
          </Step>
        </ol>
      </Panel>

      <Panel title="Dois jeitos de falar com o orquestrador" icon={<BookOpen className="h-4 w-4 text-blue-600" />}>
        <p className="mb-4 text-sm leading-6 text-slate-600">
          <strong>Maestro</strong> é o jeito recomendado: uma biblioteca que o robô importa e que faz a conversa toda. O{" "}
          <strong>jeito antigo</strong> continua valendo para os robôs que já existem: JSON por argumento, <Inline>print</Inline>{" "}
          e código de saída. Dá para misturar os dois no mesmo robô.
        </p>

        <Compare
          left={{ title: "Maestro", badge: "recomendado" }}
          right={{ title: "Jeito antigo (JSON + print)", badge: "robôs existentes" }}
          rows={[
            { label: "Estrutura da main", left: CODE_MAIN_MAESTRO, right: CODE_MAIN_LEGACY },
            { label: "Receber parâmetros e credenciais", left: CODE_INPUT_MAESTRO, right: CODE_INPUT_LEGACY },
            { label: "Devolver logs, etapa e resultado", left: CODE_OUTPUT_MAESTRO, right: CODE_OUTPUT_LEGACY },
          ]}
        />

        <p className="mt-4 text-xs leading-5 text-slate-500">
          No jeito antigo, o caminho do JSON chega em <Inline>sys.argv[1]</Inline> só se o bot estiver marcado como{" "}
          <em>"lê o arquivo da task por argumento"</em>. As variáveis <Inline>ORKAFLOW_TASK_FILE</Inline> e{" "}
          <Inline>ORKAFLOW_RESULT_FILE</Inline> existem sempre.
        </p>
      </Panel>

      <Panel title="Senha vencida no SAP: avise, não insista" icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Quando a senha do usuário de serviço vence ou o usuário é bloqueado, o SAP avisa na tela de login. Se o robô só
          falhar, o agendamento tenta de novo a cada ciclo até <strong>bloquear o usuário</strong>. O robô precisa reconhecer esse
          aviso e repassar ao orquestrador: ele marca a credencial, <strong>pausa os agendamentos</strong> que a usam e recusa
          tasks novas até alguém trocar a senha em Credenciais. Uma falha de login, zero novas tentativas.
        </div>
        <Compare
          left={{ title: "Maestro" }}
          right={{ title: "Jeito antigo" }}
          rows={[{ label: "Ao detectar o aviso do SAP", left: CODE_CREDENTIAL_MAESTRO, right: CODE_CREDENTIAL_LEGACY }]}
        />
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Motivos aceitos: <Inline>senha_expirada</Inline>, <Inline>senha_incorreta</Inline>, <Inline>usuario_bloqueado</Inline>. A
          chave é o nome do item em <em>dados_acesso</em>. Vale para qualquer sistema, não só SAP.
        </p>
      </Panel>

      <Panel id="maestro" title="Guia do Maestro" icon={<BookOpen className="h-4 w-4 text-blue-600" />}>
        <p className="mb-4 text-sm leading-6 text-slate-600">
          Tudo que a biblioteca faz, com um exemplo cada. No editor (VS Code, PyCharm), digite <Inline>maestro.</Inline> e use{" "}
          <strong>Ctrl+Espaço</strong>: a lista e a descrição de cada chamada aparecem ali mesmo.
        </p>

        <div className="space-y-3">
          {MAESTRO_REFERENCE.map((group) => (
            <ReferenceGroup key={group.title} title={group.title} calls={group.calls} />
          ))}
        </div>

        <Details summary="Ver um robô completo com o Maestro" className="mt-5">
          <Code title="main.py completo" code={CODE_FULL_MAESTRO} />
        </Details>
      </Panel>

      <Panel title="Antes de publicar" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[
            "main.py na raiz, com main() e `with maestro:` (ou try/except + sys.exit(1)).",
            "requirements.txt com tudo que o robô importa (o maestro não precisa estar nele).",
            "Nenhuma senha no código nem no log: senha vem de maestro.credential.",
            "Senha vencida ou usuário bloqueado vira CredencialInvalida, não tentativa de novo.",
            "Robô de tela: screenshot_on_error=True, para ver o erro na task.",
            "Testado na sua máquina com producao=False antes de cadastrar.",
          ].map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------- blocos da página

function Panel({ id, title, icon, children }: { id?: string; title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className={cn(card, "scroll-mt-20")}>
      <div className={cardHeader}>
        <h2 className={cn(cardTitle, "flex items-center gap-2")}>
          {icon}
          {title}
        </h2>
      </div>
      <div className={cardBody}>{children}</div>
    </section>
  );
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{children}</p>
    </div>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {n}
        </span>
        <span className="text-slate-500">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-3 text-sm leading-6 text-slate-600">{children}</div>
    </li>
  );
}

function Inline({ children }: { children: ReactNode }) {
  return <code className="rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[12.5px] text-[#0451a5]">{children}</code>;
}

function Highlighted({ code, lang }: { code: string; lang: Lang }) {
  const tokens = useMemo(() => tokenize(code, lang), [code, lang]);
  return (
    <code>
      {tokens.map((token, index) => (
        <span key={index} className={TOKEN_CLASS[token.kind]}>
          {token.text}
        </span>
      ))}
    </code>
  );
}

// Bloco de código no padrão das telas: fundo claro, cantos arredondados, código colorido como no editor.
function Code({ title, code, lang = "python" }: { title: string; code: string; lang?: Lang }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{title}</span>
        <CopyButton value={code} label={`Copiar ${title}`} />
      </div>
      <pre className="max-h-[480px] overflow-auto px-4 py-3 font-mono text-[12.5px] leading-6">
        <Highlighted code={code} lang={lang} />
      </pre>
    </div>
  );
}

function Details({ summary, children, className }: { summary: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn("group rounded-lg border border-slate-200", className)}>
      <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
        <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
        {summary}
      </summary>
      <div className="border-t border-slate-100 p-3">{children}</div>
    </details>
  );
}

type CompareSide = { title: string; badge?: string };
type CompareRow = { label: string; left: string; right: string };

function Compare({ left, right, rows }: { left: CompareSide; right: CompareSide; rows: CompareRow[] }) {
  return (
    <div className="space-y-4">
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        <SideTitle side={left} highlight />
        <SideTitle side={right} />
      </div>
      {rows.map((row) => (
        <div key={row.label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Code title={left.title} code={row.left} />
            <Code title={right.title} code={row.right} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SideTitle({ side, highlight = false }: { side: CompareSide; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm font-semibold", highlight ? "text-blue-700" : "text-slate-700")}>{side.title}</span>
      {side.badge ? <span className={cn(badge, highlight ? tone.info : tone.neutral)}>{side.badge}</span> : null}
    </div>
  );
}

function ReferenceGroup({ title, calls }: { title: string; calls: { call: string; what: string; example: string }[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
        aria-expanded={open}
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="divide-y divide-slate-100 border-t border-slate-100">
          {calls.map((item) => (
            <div key={item.call} className="grid gap-2 px-4 py-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-6">
              <div>
                <code className="font-mono text-[12.5px] font-semibold text-slate-900">{item.call}</code>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.what}</p>
              </div>
              <pre className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[12px] leading-5">
                <Highlighted code={item.example} lang="python" />
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
