import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Code2,
  FileJson,
  Import,
  ListChecks,
  PlayCircle,
  ScrollText,
  TerminalSquare,
  Wrench,
  XCircle,
} from "lucide-react";

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
    title: "1. Criar o arquivo principal",
    description:
      "Crie um arquivo main.py ou app.py na raiz do bot. Esse será o ponto de entrada chamado pelo orquestrador.",
  },
  {
    title: "2. Criar a função main()",
    description:
      "A função main() deve controlar o fluxo principal: iniciar logs, ler parâmetros quando necessário, chamar a função principal do bot e imprimir o resultado.",
  },
  {
    title: "3. Ler parâmetros, se o bot precisar",
    description:
      "Quando o bot receber dados do orquestrador, o caminho do arquivo JSON temporário será enviado como argumento na execução.",
  },
  {
    title: "4. Tratar erros corretamente",
    description:
      "Todo erro precisa ser capturado, impresso em formato claro e finalizado com sys.exit(1), para o orquestrador saber que a tarefa falhou.",
  },
  {
    title: "5. Usar logs com print()",
    description:
      "Tudo que for impresso com print() pode ser exibido nos logs da execução dentro do orquestrador.",
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

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
        {eyebrow}
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ title, description, code }: { title: string; description: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 shadow-sm">
      <div className="border-b border-slate-800 bg-slate-900/80 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Code2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
          </div>
        </div>
      </div>

      <pre className="max-h-[720px] overflow-auto p-5 text-sm leading-6 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function WorkerRegistrationPage() {
  return (
    <div className="min-h-full bg-slate-100">
      <div className="space-y-8">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-8 shadow-sm md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_30%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-8">
              <SectionTitle
                eyebrow="Configuração do Bot"
                title="Como preparar o main.py ou app.py para o OrkaFlow"
                description="Esta página explica o padrão obrigatório para um bot ser executado pelo orquestrador. O arquivo principal precisa ter uma função main(), logs com print(), tratamento de erro e retorno sys.exit(1) quando a execução falhar. Quando o bot precisar receber parâmetros, eles serão enviados pelo orquestrador em um arquivo JSON temporário."
              />

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-slate-800 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <PlayCircle className="h-5 w-5 text-blue-300" />
                    <span className="text-sm font-semibold text-white">Entrada padrão</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    O orquestrador chama o arquivo principal do bot, normalmente main.py ou app.py.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <TerminalSquare className="h-5 w-5 text-blue-300" />
                    <span className="text-sm font-semibold text-white">Logs visíveis</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Use print() para mostrar andamento, etapas, avisos e resultado final nos logs do OrkaFlow.
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-5 w-5 text-blue-300" />
                    <span className="text-sm font-semibold text-white">Erro controlado</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Se falhar, capture o erro, imprima a mensagem e finalize com sys.exit(1).
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="#exemplo-com-parametros"
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                >
                  Ver exemplo com parâmetros
                  <ArrowRight className="h-4 w-4" />
                </a>

                <a
                  href="#exemplo-sem-parametros"
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-blue-500/40 hover:text-white"
                >
                  Ver exemplo sem parâmetros
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                  <ListChecks className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Regras obrigatórias</h2>
                  <p className="text-sm text-slate-400">Padrão mínimo para execução</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {rules.map((rule) => (
                  <div key={rule} className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-6 text-slate-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">O que é o arquivo principal do bot</h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              O arquivo principal é o primeiro arquivo executado pelo orquestrador. Ele deve organizar a execução do bot de forma simples e previsível: receber entrada, chamar a função principal, imprimir logs e devolver erro corretamente quando houver falha.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">Estrutura recomendada</h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-600">
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Imports no topo do arquivo.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Função para ler payload, se precisar receber parâmetros.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Função principal do processo do bot.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Função main() para controlar a execução.</li>
                  <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Bloco if __name__ == "__main__" com try/except.</li>
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">O que não pode faltar</h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-600">
                  <li className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />Não deixe erro passar sem tratamento.</li>
                  <li className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />Não finalize erro apenas com print().</li>
                  <li className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />Não esqueça o sys.exit(1) em caso de falha.</li>
                  <li className="flex gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />Não deixe parâmetros fixos no código quando eles vierem do orquestrador.</li>
                </ul>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Nomes indicados</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use preferencialmente um destes arquivos na raiz do bot.</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3"><code className="text-sm text-blue-300">main.py</code></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3"><code className="text-sm text-blue-300">app.py</code></div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-950">Retorno esperado</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />Sucesso: execução termina sem sys.exit(1).</li>
                <li className="flex gap-3"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />Erro: execução imprime o erro e chama sys.exit(1).</li>
              </ul>
            </div>
          </aside>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Passo a passo da execução</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">Esse é o fluxo que o arquivo principal deve seguir para funcionar bem dentro do orquestrador.</p>
          </div>

          <div className="mt-8 grid gap-5 xl:grid-cols-2">
            {steps.map((step) => (
              <div key={step.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Como funcionam os parâmetros</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Quando o bot precisa receber dados, o orquestrador cria um arquivo JSON temporário e passa o caminho desse arquivo como argumento na execução. O main.py deve ler esse caminho com sys.argv, abrir o arquivo e carregar o JSON.
              </p>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="text-sm font-semibold text-slate-900">Exemplo de chamada feita pelo orquestrador</h3>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3">
                  <code className="text-sm text-blue-300">python main.py C:\\temp\\orkaflow\\payload_123.json</code>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-3">
                <FileJson className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-slate-950">Formato comum</h3>
              </div>
              <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
{`{
  "parameters": [
    {
      "parameter_name": "dados",
      "parameter_value": "{\\"dados_acesso\\": {\\"email\\": \\"teste@empresa.com\\", \\"senha\\": \\"123\\"}}"
    }
  ]
}`}
              </pre>
            </div>
          </div>
        </section>

        <section id="exemplo-com-parametros" className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <Import className="mt-1 h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Exemplo completo com parâmetros</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use esse modelo quando o bot precisa receber dados do orquestrador, como usuário, senha, filtros, datas, cliente ou qualquer outro parâmetro da task.
                </p>
              </div>
            </div>
          </div>

          <CodeBlock
            title="main.py recebendo payload JSON"
            description="Modelo recomendado para bot que recebe parâmetros via arquivo temporário enviado pelo orquestrador."
            code={codeWithParams}
          />
        </section>

        <section id="exemplo-sem-parametros" className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-start gap-3">
              <ScrollText className="mt-1 h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Exemplo completo sem parâmetros</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use esse modelo quando o bot não precisa receber nenhum dado do orquestrador e apenas executa uma rotina fixa.
                </p>
              </div>
            </div>
          </div>

          <CodeBlock
            title="main.py sem payload"
            description="Modelo recomendado para bot simples, sem entrada de parâmetros."
            code={codeWithoutParams}
          />
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-8 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Resumo final</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                O main.py ou app.py deve ser simples, controlado e previsível. A responsabilidade dele é iniciar o bot, ler parâmetros quando existirem, chamar a função principal, imprimir logs e encerrar corretamente em caso de erro.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-6">
              <h3 className="text-lg font-semibold text-white">Checklist rápido</h3>
              <ul className="mt-5 space-y-4 text-sm text-slate-300">
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Arquivo main.py ou app.py na raiz.</li>
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />Função main() criada.</li>
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />try/except no bloco principal.</li>
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />sys.exit(1) em caso de erro.</li>
                <li className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />print() para logs do orquestrador.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
