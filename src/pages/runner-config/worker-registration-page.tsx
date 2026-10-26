import type { ReactNode } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Code2, FileJson, Import, ListChecks, PlayCircle, ScrollText, TerminalSquare, XCircle } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { btn, card, cardBody, cardHeader, cardTitle } from "@/lib/ui";
import { cn } from "@/lib/utils";

const rules = [
  "O arquivo principal do bot deve ser main.py ou app.py.",
  "O orquestrador chama esse arquivo principal para iniciar a execução.",
  "Toda execução deve passar por uma função main().",
  "Se a execução terminar com sucesso, o processo deve finalizar normalmente.",
  "Se der erro, o processo deve usar sys.exit(1).",
  "Use print() para enviar logs visíveis no orquestrador.",
  "Quando houver parâmetros, leia o arquivo JSON temporário recebido por argumento.",
  "Cada método importante deve ter try/except para retornar uma mensagem clara de erro.",
];

const steps = [
  {
    title: "Criar o arquivo principal",
    description:
      "Crie um arquivo main.py ou app.py na raiz do bot. Esse será o ponto de entrada chamado pelo orquestrador.",
  },
  {
    title: "Criar a função main()",
    description:
      "A função main() deve controlar o fluxo principal: iniciar logs, ler parâmetros quando necessário, chamar a função principal do bot e imprimir o resultado.",
  },
  {
    title: "Ler parâmetros, se o bot precisar",
    description:
      "Quando o bot receber dados do orquestrador, o caminho do arquivo JSON temporário será enviado como argumento na execução.",
  },
  {
    title: "Tratar erros corretamente",
    description:
      "Todo erro precisa ser capturado, impresso em formato claro e finalizado com sys.exit(1), para o orquestrador saber que a tarefa falhou.",
  },
  {
    title: "Usar logs com print()",
    description: "Tudo que for impresso com print() pode ser exibido nos logs da execução dentro do orquestrador.",
  },
];

const codeWithParams = `import json
import sys
from pathlib import Path

# ============================================================
# IMPORTS DOS MÉTODOS DO BOT
# ============================================================
# Aqui você importa a função principal do seu bot.
# Exemplo:
# from aviso_notas_ppi_metodo import executar_envio
# from meu_bot import executar_bot


def ler_payload_task():
    """
    Lê o arquivo JSON temporário enviado pelo orquestrador.

    O orquestrador executa o bot passando o caminho do arquivo como argumento:
    python main.py C:\\caminho\\temporario\\payload.json
    """
    try:
        task_file = None

        if len(sys.argv) > 1:
            task_file = sys.argv[1]

        if not task_file:
            raise ValueError("Nenhum arquivo de payload foi informado pelo orquestrador.")

        path = Path(task_file)

        if not path.exists():
            raise FileNotFoundError(f"Arquivo de payload não encontrado: {task_file}")

        with path.open("r", encoding="utf-8") as f:
            return json.load(f)

    except Exception as e:
        raise RuntimeError(f"Erro ao ler payload da task: {e}")


def extrair_parametros(payload):
    """
    Extrai os parâmetros enviados pelo orquestrador.

    Padrão esperado:
    payload["parameters"][0]["parameter_value"]

    O campo parameter_value normalmente vem como string JSON.
    """
    try:
        if "parameters" not in payload or not payload["parameters"]:
            raise ValueError("Payload não possui parâmetros.")

        param = payload["parameters"][0]
        params_json = json.loads(param["parameter_value"])

        return params_json

    except Exception as e:
        raise RuntimeError(f"Erro ao extrair parâmetros do payload: {e}")


def executar_processo(params_json):
    """
    Função que chama a regra principal do bot.

    Coloque aqui a chamada para o método real do seu bot.
    """
    try:
        print("Iniciando processamento principal do bot...")

        email = params_json["dados_acesso"]["email"]
        senha = params_json["dados_acesso"]["senha"]

        print(f"E-mail recebido para execução: {email}")

        # Exemplo de chamada real:
        # resultado = executar_envio(
        #     remetente_email=email,
        #     senha_email=senha,
        #     excel_path="Lista de email_2.xlsx",
        # )

        resultado = {
            "status": "success",
            "mensagem": "Bot executado com sucesso.",
        }

        return resultado

    except Exception as e:
        raise RuntimeError(f"Erro durante execução principal do bot: {e}")


def main():
    """
    Função principal chamada pelo orquestrador.
    """
    print("INICIANDO BOT PELO ORQUESTRADOR")

    payload = ler_payload_task()
    params_json = extrair_parametros(payload)
    resultado = executar_processo(params_json)

    print("RESULTADO DA EXECUÇÃO")
    print(json.dumps(resultado, indent=4, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        erro = {
            "status": "error",
            "mensagem": str(e),
        }

        print("\\n[ERRO]")
        print(json.dumps(erro, indent=4, ensure_ascii=False))

        # Obrigatório: retorna erro para o orquestrador.
        sys.exit(1)
`;

const codeWithoutParams = `import json
import sys

# ============================================================
# IMPORTS DOS MÉTODOS DO BOT
# ============================================================
# Aqui você importa a função principal do seu bot.
# Exemplo:
# from meu_bot import executar_rotina


def executar_processo():
    """
    Função principal do bot quando não precisa receber parâmetros.
    """
    try:
        print("Iniciando execução do bot sem parâmetros...")

        # Exemplo de chamada real:
        # resultado = executar_rotina()

        resultado = {
            "status": "success",
            "mensagem": "Bot executado com sucesso sem parâmetros.",
        }

        return resultado

    except Exception as e:
        raise RuntimeError(f"Erro durante execução principal do bot: {e}")


def main():
    """
    Função principal chamada pelo orquestrador.
    """
    print("INICIANDO BOT SEM PARÂMETROS")

    resultado = executar_processo()

    print("RESULTADO DA EXECUÇÃO")
    print(json.dumps(resultado, indent=4, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        erro = {
            "status": "error",
            "mensagem": str(e),
        }

        print("\\n[ERRO]")
        print(json.dumps(erro, indent=4, ensure_ascii=False))

        # Obrigatório: retorna erro para o orquestrador.
        sys.exit(1)
`;

const payloadExample = `{
  "parameters": [
    {
      "parameter_name": "dados",
      "parameter_value": "{\\"dados_acesso\\": {\\"email\\": \\"teste@empresa.com\\", \\"senha\\": \\"123\\"}}"
    }
  ]
}`;

function Panel({ title, icon, children, className }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn(card, className)}>
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

function CheckItem({ children, tone = "ok" }: { children: ReactNode; tone?: "ok" | "warn" | "error" }) {
  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertCircle : XCircle;
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-red-600";
  return (
    <li className="flex gap-3 text-sm leading-6 text-slate-700">
      <Icon className={cn("mt-1 h-4 w-4 shrink-0", color)} />
      <span>{children}</span>
    </li>
  );
}

function CodeBlock({ title, description, code }: { title: string; description: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-800 bg-slate-900/80 px-5 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <Code2 className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-slate-300">{description}</p>
        </div>
      </div>

      <pre className="max-h-[720px] overflow-auto p-5 font-mono text-xs leading-5 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return <code className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800">{children}</code>;
}

export function WorkerRegistrationPage() {
  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Guia do bot"
          description="Como preparar o main.py ou app.py para o OrkaFlow executar o seu bot."
          actions={
            <>
              <a href="#exemplo-com-parametros" className={btn.primary}>
                Exemplo com parâmetros
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#exemplo-sem-parametros" className={btn.secondary}>
                Exemplo sem parâmetros
                <ArrowRight className="h-4 w-4" />
              </a>
            </>
          }
        />

        <div className={cardBody}>
          <p className="max-w-4xl text-sm leading-6 text-slate-600">
            O arquivo principal precisa ter uma função <InlineCode>main()</InlineCode>, logs com <InlineCode>print()</InlineCode>, tratamento de erro e
            retorno <InlineCode>sys.exit(1)</InlineCode> quando a execução falhar. Quando o bot precisar receber parâmetros, eles serão enviados pelo
            orquestrador em um arquivo JSON temporário.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <PlayCircle className="h-4 w-4 text-blue-600" />
                Entrada padrão
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">O orquestrador chama o arquivo principal do bot, normalmente main.py ou app.py.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <TerminalSquare className="h-4 w-4 text-blue-600" />
                Logs visíveis
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use print() para mostrar andamento, etapas, avisos e resultado final nos logs do OrkaFlow.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <XCircle className="h-4 w-4 text-blue-600" />
                Erro controlado
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">Se falhar, capture o erro, imprima a mensagem e finalize com sys.exit(1).</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel title="O que é o arquivo principal do bot">
          <p className="text-sm leading-7 text-slate-600">
            O arquivo principal é o primeiro arquivo executado pelo orquestrador. Ele deve organizar a execução do bot de forma simples e previsível:
            receber entrada, chamar a função principal, imprimir logs e devolver erro corretamente quando houver falha.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Estrutura recomendada</h3>
              <ul className="mt-3 space-y-2">
                <CheckItem>Imports no topo do arquivo.</CheckItem>
                <CheckItem>Função para ler payload, se precisar receber parâmetros.</CheckItem>
                <CheckItem>Função principal do processo do bot.</CheckItem>
                <CheckItem>Função main() para controlar a execução.</CheckItem>
                <CheckItem>Bloco if __name__ == "__main__" com try/except.</CheckItem>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">O que não pode faltar</h3>
              <ul className="mt-3 space-y-2">
                <CheckItem tone="warn">Não deixe erro passar sem tratamento.</CheckItem>
                <CheckItem tone="warn">Não finalize erro apenas com print().</CheckItem>
                <CheckItem tone="warn">Não esqueça o sys.exit(1) em caso de falha.</CheckItem>
                <CheckItem tone="warn">Não deixe parâmetros fixos no código quando eles vierem do orquestrador.</CheckItem>
              </ul>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Regras obrigatórias" icon={<ListChecks className="h-4 w-4 text-blue-600" />}>
            <ul className="space-y-2">
              {rules.map((rule) => (
                <CheckItem key={rule}>{rule}</CheckItem>
              ))}
            </ul>
          </Panel>

          <Panel title="Nomes indicados">
            <p className="text-sm leading-6 text-slate-600">Use preferencialmente um destes arquivos na raiz do bot.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <InlineCode>main.py</InlineCode>
              <InlineCode>app.py</InlineCode>
            </div>
          </Panel>

          <Panel title="Retorno esperado">
            <ul className="space-y-2">
              <CheckItem>Sucesso: execução termina sem sys.exit(1).</CheckItem>
              <CheckItem tone="error">Erro: execução imprime o erro e chama sys.exit(1).</CheckItem>
            </ul>
          </Panel>
        </div>
      </div>

      <Panel title="Passo a passo da execução">
        <p className="text-sm leading-6 text-slate-600">Esse é o fluxo que o arquivo principal deve seguir para funcionar bem dentro do orquestrador.</p>

        <ol className="mt-5 grid gap-4 xl:grid-cols-2">
          {steps.map((step, index) => (
            <li key={step.title} className={cn(card, "flex items-start gap-4 p-5")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Como funcionam os parâmetros" icon={<FileJson className="h-4 w-4 text-blue-600" />}>
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="text-sm leading-7 text-slate-600">
              Quando o bot precisa receber dados, o orquestrador cria um arquivo JSON temporário e passa o caminho desse arquivo como argumento na
              execução. O main.py deve ler esse caminho com <InlineCode>sys.argv</InlineCode>, abrir o arquivo e carregar o JSON.
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Exemplo de chamada feita pelo orquestrador</h3>
              <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 px-4 py-3 font-mono text-xs text-blue-300">
                python main.py C:\\temp\\orkaflow\\payload_123.json
              </pre>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Formato comum</h3>
            <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-5 text-slate-100">{payloadExample}</pre>
          </div>
        </div>
      </Panel>

      <section id="exemplo-com-parametros" className="space-y-4 scroll-mt-5">
        <Panel title="Exemplo completo com parâmetros" icon={<Import className="h-4 w-4 text-blue-600" />}>
          <p className="text-sm leading-6 text-slate-600">
            Use esse modelo quando o bot precisa receber dados do orquestrador, como usuário, senha, filtros, datas, cliente ou qualquer outro
            parâmetro da task.
          </p>
        </Panel>

        <CodeBlock
          title="main.py recebendo payload JSON"
          description="Modelo recomendado para bot que recebe parâmetros via arquivo temporário enviado pelo orquestrador."
          code={codeWithParams}
        />
      </section>

      <section id="exemplo-sem-parametros" className="space-y-4 scroll-mt-5">
        <Panel title="Exemplo completo sem parâmetros" icon={<ScrollText className="h-4 w-4 text-blue-600" />}>
          <p className="text-sm leading-6 text-slate-600">
            Use esse modelo quando o bot não precisa receber nenhum dado do orquestrador e apenas executa uma rotina fixa.
          </p>
        </Panel>

        <CodeBlock title="main.py sem payload" description="Modelo recomendado para bot simples, sem entrada de parâmetros." code={codeWithoutParams} />
      </section>

      <Panel title="Resumo final">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <p className="text-sm leading-7 text-slate-600">
            O main.py ou app.py deve ser simples, controlado e previsível. A responsabilidade dele é iniciar o bot, ler parâmetros quando existirem,
            chamar a função principal, imprimir logs e encerrar corretamente em caso de erro.
          </p>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold text-slate-900">Checklist rápido</h3>
            <ul className="mt-3 space-y-2">
              <CheckItem>Arquivo main.py ou app.py na raiz.</CheckItem>
              <CheckItem>Função main() criada.</CheckItem>
              <CheckItem>try/except no bloco principal.</CheckItem>
              <CheckItem>sys.exit(1) em caso de erro.</CheckItem>
              <CheckItem>print() para logs do orquestrador.</CheckItem>
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
