// Leitura de arquivo .env (NOME=valor) para importar variáveis de ambiente.
//
// Aceita: linhas em branco e comentários (#), prefixo "export ", valores entre
// aspas simples ou duplas (nas duplas, \n vira quebra de linha) e comentário no
// fim de valor sem aspas ("VALOR # comentário"). Linhas que não são NOME=valor
// voltam em `ignored`, com o número da linha.

export type DotEnvEntry = { line: number; name: string; value: string };
export type DotEnvIgnored = { line: number; text: string; reason: string };

const KEY_RE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;

function unquote(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }
  // Sem aspas: " # comentário" no fim não faz parte do valor.
  const comment = value.search(/\s#/);
  return (comment >= 0 ? value.slice(0, comment) : value).trim();
}

export function parseDotEnv(text: string): { entries: DotEnvEntry[]; ignored: DotEnvIgnored[] } {
  const entries: DotEnvEntry[] = [];
  const ignored: DotEnvIgnored[] = [];

  text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) return;

      const match = KEY_RE.exec(line);
      if (!match) {
        ignored.push({ line: index + 1, text: rawLine, reason: "Não está no formato NOME=valor." });
        return;
      }
      entries.push({ line: index + 1, name: match[1], value: unquote(match[2]) });
    });

  return { entries, ignored };
}

// Sugestão inicial de "secreta" pelo nome; o usuário pode mudar em cada linha.
const SECRET_HINT_RE = /(PASS|SENHA|SECRET|TOKEN|KEY|PWD|CREDENTIAL|PRIVATE|AUTH)/i;

export function looksSecret(name: string) {
  return SECRET_HINT_RE.test(name);
}
