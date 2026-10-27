// Trechos de código do Guia do Bot. Curtos de propósito: uma ideia por bloco.
// (Ficam fora do .tsx para o react-refresh/only-export-components não reclamar.)

export const CODE_MAIN_MAESTRO = `from maestro import Maestro

maestro = Maestro()   # producao=True por padrão

def main():
    maestro.info("Começando")
    # ... o trabalho do robô ...
    maestro.success("Tudo certo")

if __name__ == "__main__":
    with maestro:     # erro não tratado vira falha na task, com traceback
        main()
`;

export const CODE_MAIN_LEGACY = `import sys

def main():
    print("Começando")
    # ... o trabalho do robô ...
    print("Tudo certo")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"[ERRO] {e}")
        sys.exit(1)   # diferente de 0 = a task fica com erro
`;

export const CODE_LOCAL_INSTALL = `pip install "git+https://dev.azure.com/SEU-ORG/SEU-PROJETO/_git/orkaflow-worker#subdirectory=maestro"
python -m maestro init      # cria task.json ao lado do main.py`;

export const CODE_LOCAL_RUN = `maestro = Maestro(producao=False)   # lê ./task.json, imprime no console, grava ./resultado.json`;

export const CODE_TASK_JSON = `{
  "parameters_json": {
    "filtros": {"filial": "010"},
    "dados_acesso": {"sap_usuario": "USUARIO_TESTE", "sap_senha": "troque-aqui"}
  },
  "runtime_parameters_json": {"lote": "A"},
  "env": {"SAP_URL": "https://sap.exemplo"}
}`;

export const CODE_INPUT_MAESTRO = `filial = maestro.param("filial", default="010")   # parâmetro da automação
senha  = maestro.credential("sap_senha")           # credencial cadastrada (nunca imprima)
url    = maestro.env("SAP_URL")                    # variável de ambiente do orquestrador`;

export const CODE_INPUT_LEGACY = `import json, sys

dados = json.load(open(sys.argv[1], encoding="utf-8"))   # caminho do JSON vem por argumento
params = dados["parameters_json"]                        # dict com o que a automação enviou
filial = params["filtros"]["filial"]
senha  = params["dados_acesso"]["sap_senha"]              # já resolvido pelo worker`;

export const CODE_OUTPUT_MAESTRO = `maestro.info("Lendo pedidos", total=120)
maestro.warning("Pedido sem fornecedor", pedido=4500012001)
maestro.step(2, 5, "Enviando ao SAP")          # aparece na lista e no detalhe da task
maestro.success("120 pedidos", result={"pedidos": 120}, items_processed=120)`;

export const CODE_OUTPUT_LEGACY = `import json, os

print("Lendo pedidos: 120")                    # tudo que imprime vai para o log da task

# resultado (opcional): grava no arquivo que o worker indica
with open(os.environ["ORKAFLOW_RESULT_FILE"], "w", encoding="utf-8") as f:
    json.dump({"pedidos": 120}, f)`;

export const CODE_CREDENTIAL_MAESTRO = `from maestro import Maestro, CredencialInvalida

maestro = Maestro()

def main():
    senha = maestro.credential("sap_senha")
    try:
        sap.login(usuario, senha)
    except SenhaExpirada as e:            # o SAP avisa; o robô repassa
        raise CredencialInvalida("sap_senha", motivo="senha_expirada", mensagem=str(e))
`;

export const CODE_CREDENTIAL_LEGACY = `import json, sys

def avisar_credencial(chave, motivo, mensagem):
    print("ORKAFLOW_ALERTA_CREDENCIAL " + json.dumps(
        {"sistema": "SAP", "chave": chave, "motivo": motivo, "mensagem": mensagem},
        ensure_ascii=False), flush=True)
    sys.exit(3)   # código 3 é reservado para isso

try:
    sap.login(usuario, senha)
except SenhaExpirada as e:
    avisar_credencial("sap_senha", "senha_expirada", str(e))
`;

export const CODE_FULL_MAESTRO = `import requests
from maestro import Maestro, CredencialInvalida

maestro = Maestro(screenshot_on_error=True)   # robô de tela: tira print se der erro

def main():
    filial = maestro.param("filial", default="010")
    senha = maestro.credential("sap_senha")

    maestro.step(1, 3, "Login no SAP")
    try:
        sap.login("RPA_SUPRI", senha)
    except SenhaExpirada as e:
        raise CredencialInvalida("sap_senha", motivo="senha_expirada", mensagem=str(e))

    maestro.step(2, 3, "Lendo pedidos")
    pedidos = sap.me2l(filial)
    maestro.info("Pedidos lidos", total=len(pedidos))

    maestro.step(3, 3, "Gravando")
    caminho = gravar_planilha(pedidos)
    maestro.attach(caminho, "Pedidos lidos")           # fica na task para baixar

    if any(p.precisa_aprovacao for p in pedidos):
        maestro.next_automation("Aprovacao_Pedidos")   # entra na fila ao terminar bem

    maestro.success(f"{len(pedidos)} pedidos", result={"pedidos": len(pedidos)}, items_processed=len(pedidos))

if __name__ == "__main__":
    with maestro:
        main()
`;

export type MaestroCall = { call: string; what: string; example: string };
export type MaestroGroup = { title: string; calls: MaestroCall[] };

export const MAESTRO_REFERENCE: MaestroGroup[] = [
  {
    title: "Criar",
    calls: [
      { call: "Maestro()", what: "Instância usada no robô inteiro. producao=True por padrão.", example: "maestro = Maestro()" },
      { call: "Maestro(producao=False)", what: "Na sua máquina: lê task.json, imprime no console, grava resultado.json. Nada vai para a rede.", example: "maestro = Maestro(producao=False)" },
      { call: "Maestro(screenshot_on_error=True)", what: "Tira print da tela quando um erro escapar do with. Para robô de tela.", example: "maestro = Maestro(screenshot_on_error=True)" },
      { call: "with maestro:", what: "Em volta do main(). Exceção vira erro na task com traceback; fim normal vira sucesso.", example: "with maestro:\n    main()" },
    ],
  },
  {
    title: "Receber",
    calls: [
      { call: "param(nome, default=None)", what: "Parâmetro da automação (parameters_json, depois runtime_parameters_json).", example: 'filial = maestro.param("filial", default="010")' },
      { call: "require(nome)", what: "Igual ao param, mas falha com mensagem clara se não veio.", example: 'lote = maestro.require("lote")' },
      { call: "params", what: "Todos os parâmetros num dict (sem dados_acesso).", example: "print(maestro.params.keys())" },
      { call: "credential(chave)", what: "Valor de uma credencial vinculada à automação (dados_acesso). Nunca imprima.", example: 'senha = maestro.credential("sap_senha")' },
      { call: "env(nome, default=None)", what: "Variável de ambiente cadastrada no orquestrador (Variáveis).", example: 'url = maestro.env("SAP_URL")' },
      { call: "task.id / task.automation_id", what: "Dados da execução atual.", example: "maestro.info(f\"task {maestro.task.id}\")" },
    ],
  },
  {
    title: "Contar o que está acontecendo",
    calls: [
      { call: "info(msg, **dados)", what: "Mensagem no log da task. Campos extras viram chave=valor.", example: 'maestro.info("Lendo pedidos", total=120)' },
      { call: "warning(msg, **dados)", what: "Aviso (amarelo): fora do esperado, mas o robô segue.", example: 'maestro.warning("Linha sem CNPJ", linha=37)' },
      { call: "error(msg, **dados)", what: "Erro no log sem encerrar o robô. Para encerrar, use fail().", example: 'maestro.error("Falha ao abrir ME2L")' },
      { call: "step(atual, total, texto)", what: "Etapa atual: aparece na lista e no detalhe da task com barra.", example: 'maestro.step(3, 7, "Enviando ao SAP")' },
      { call: "heartbeat()", what: "Sinal de vida em trechos longos sem log (o worker encerra robô mudo por 10 min).", example: "maestro.heartbeat()" },
      { call: "timer(rotulo)", what: "Mede e loga a duração de um trecho.", example: 'with maestro.timer("Login SAP"):\n    sap.login(u, s)' },
    ],
  },
  {
    title: "Print e arquivos",
    calls: [
      { call: "screenshot(descricao)", what: "Tira print da tela agora e anexa à task.", example: 'maestro.screenshot("Tela antes de gravar")' },
      { call: "attach(caminho, descricao)", what: "Anexa um arquivo (planilha, PDF, log) à task, até 5 MB, 10 por task. Pode apagar o arquivo depois.", example: 'maestro.attach("C:/saida/pedidos.xlsx", "Pedidos lidos")' },
    ],
  },
  {
    title: "Encerrar",
    calls: [
      { call: "success(msg, result=None, items_processed=None, items_failed=None)", what: "Termina bem. msg vira a mensagem final; result (dict) vira o resultado da task; os contadores preenchem Processados / Com falha.", example: 'maestro.success("120 pedidos", result={"pedidos": 120}, items_processed=120)' },
      { call: "fail(msg, category=\"system\"|\"business\", retryable=None)", what: "Termina com erro. business = regra de negócio (não repetir); system = ambiente (a retentativa pode repetir).", example: 'maestro.fail("Planilha não encontrada", category="business")' },
      { call: "raise CredencialInvalida(chave, motivo, mensagem)", what: "Senha vencida, errada ou usuário bloqueado: o orquestrador pausa os agendamentos e bloqueia tasks novas.", example: 'raise CredencialInvalida("sap_senha", motivo="senha_expirada", mensagem="SAP: senha venceu")' },
      { call: "next_automation(nome, parametros=None)", what: "Ao terminar bem, coloca outra automação na fila. Ela leva os próprios parâmetros e credenciais; parametros só sobrescreve.", example: 'maestro.next_automation("Aprovacao_Pedidos", parametros={"lote": "A"})' },
    ],
  },
];
