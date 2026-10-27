// Colorizador simples (sem biblioteca) para os trechos do Guia do Bot.
// Cobre o que aparece lá: Python, JSON e linhas de terminal. Cores no estilo "VS Code claro".

export type TokenKind =
  | "plain"
  | "keyword"
  | "builtin"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "decorator"
  | "key"
  | "operator";

export type Token = { kind: TokenKind; text: string };
export type Lang = "python" | "json" | "shell";

const PY_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del", "elif", "else", "except",
  "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass",
  "raise", "return", "try", "while", "with", "yield", "True", "False", "None",
]);
const PY_BUILTINS = new Set([
  "print", "len", "open", "range", "str", "int", "float", "dict", "list", "set", "tuple", "any", "all", "enumerate",
  "isinstance", "Exception", "RuntimeError", "ValueError", "KeyError", "self", "json", "sys", "os", "requests",
  "maestro", "Maestro", "CredencialInvalida",
]);

// Ordem importa: comentário e string antes de identificadores.
const PY_RE =
  /(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*')|(@\w+)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)(?=\s*\()|(\b[A-Za-z_]\w*\b)|([=+\-*/%<>!&|^~:]+)/gm;

function pythonTokens(code: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(PY_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "plain", text: code.slice(last, idx) });
    const [full, comment, str, deco, num, fnName, ident, op] = m;
    if (comment) out.push({ kind: "comment", text: full });
    else if (str) out.push({ kind: "string", text: full });
    else if (deco) out.push({ kind: "decorator", text: full });
    else if (num) out.push({ kind: "number", text: full });
    else if (fnName) out.push({ kind: PY_KEYWORDS.has(fnName) ? "keyword" : PY_BUILTINS.has(fnName) ? "builtin" : "function", text: full });
    else if (ident) out.push({ kind: PY_KEYWORDS.has(ident) ? "keyword" : PY_BUILTINS.has(ident) ? "builtin" : "plain", text: full });
    else if (op) out.push({ kind: "operator", text: full });
    else out.push({ kind: "plain", text: full });
    last = idx + full.length;
  }
  if (last < code.length) out.push({ kind: "plain", text: code.slice(last) });
  return out;
}

const JSON_RE = /("(?:\\.|[^"\\])*")(\s*:)?|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;

function jsonTokens(code: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(JSON_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "plain", text: code.slice(last, idx) });
    const [full, str, colon, num, lit] = m;
    if (str) {
      out.push({ kind: colon ? "key" : "string", text: str });
      if (colon) out.push({ kind: "plain", text: colon });
    } else if (num) out.push({ kind: "number", text: full });
    else if (lit) out.push({ kind: "keyword", text: full });
    last = idx + full.length;
  }
  if (last < code.length) out.push({ kind: "plain", text: code.slice(last) });
  return out;
}

const SHELL_RE = /(#.*$)|("(?:\\.|[^"\\])*")|(^\s*(?:pip|python|git|npm)\b)/gm;

function shellTokens(code: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of code.matchAll(SHELL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "plain", text: code.slice(last, idx) });
    const [full, comment, str, cmd] = m;
    if (comment) out.push({ kind: "comment", text: full });
    else if (str) out.push({ kind: "string", text: full });
    else if (cmd) out.push({ kind: "keyword", text: full });
    last = idx + full.length;
  }
  if (last < code.length) out.push({ kind: "plain", text: code.slice(last) });
  return out;
}

export function tokenize(code: string, lang: Lang): Token[] {
  if (lang === "json") return jsonTokens(code);
  if (lang === "shell") return shellTokens(code);
  return pythonTokens(code);
}

// Paleta clara, próxima do tema padrão do VS Code.
export const TOKEN_CLASS: Record<TokenKind, string> = {
  plain: "text-slate-800",
  keyword: "text-[#af00db]",
  builtin: "text-[#267f99]",
  string: "text-[#a31515]",
  comment: "text-[#008000] italic",
  number: "text-[#098658]",
  function: "text-[#795e26]",
  decorator: "text-[#795e26]",
  key: "text-[#0451a5]",
  operator: "text-slate-600",
};
