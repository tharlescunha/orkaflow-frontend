// Login com a conta Microsoft (Microsoft Entra ID) pelo fluxo Authorization Code + PKCE, feito no navegador (aplicativo de
// página única, sem segredo). A ida leva a pessoa à Microsoft; a volta cai em /auth/callback, troca o código pelo id_token
// e o entrega ao backend, que valida tudo e emite os tokens do Regente.

const STORAGE_KEY = "regente-ms-sso";
const MAX_AGE_MS = 10 * 60 * 1000;
const SCOPE = "openid profile email";

type Pending = {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  tenantId: string;
  clientId: string;
  createdAt: number;
};

/** Erro do fluxo com texto pronto para a pessoa ler (`detail` é o texto técnico, para quem for investigar). */
export class SsoError extends Error {
  detail?: string;

  constructor(message: string, detail?: string) {
    super(message);
    this.name = "SsoError";
    this.detail = detail;
  }
}

function base64Url(bytes: Uint8Array): string {
  let text = "";
  bytes.forEach((byte) => {
    text += String.fromCharCode(byte);
  });
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Endereço de retorno: precisa estar cadastrado no aplicativo da Microsoft (https://regente.alzgraos.com.br/auth/callback). */
export function microsoftRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

/** Leva a pessoa à tela de login da Microsoft. */
export async function startMicrosoftLogin(config: { tenant_id: string; client_id: string }): Promise<void> {
  if (!window.crypto?.subtle) {
    throw new SsoError("Este navegador não permite o login com a Microsoft. Abra o painel por https e tente de novo.");
  }
  const verifier = randomString(64);
  const state = randomString(24);
  const nonce = randomString(24);
  const redirectUri = microsoftRedirectUri();

  const pending: Pending = {
    state,
    nonce,
    verifier,
    redirectUri,
    tenantId: config.tenant_id,
    clientId: config.client_id,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: SCOPE,
    state,
    nonce,
    code_challenge: base64Url(await sha256(verifier)),
    code_challenge_method: "S256",
  });
  window.location.assign(`https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/authorize?${params.toString()}`);
}

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // sem sessionStorage: nada a limpar
  }
}

/** Texto amigável para os erros mais comuns que a Microsoft devolve na volta. */
function friendlyMicrosoftError(error: string, description: string): string {
  if (error === "access_denied") return "O login com a Microsoft foi cancelado ou negado.";
  if (/AADSTS50011/.test(description)) return "O endereço de retorno não está cadastrado no aplicativo da Microsoft. Avise a TI.";
  if (/AADSTS9002326|AADSTS9002325/.test(description)) return "O aplicativo da Microsoft não está configurado como página única (SPA). Avise a TI.";
  if (/AADSTS700016|AADSTS700025/.test(description)) return "O aplicativo da Microsoft não foi encontrado ou está configurado de outro jeito. Avise a TI.";
  if (/AADSTS65001/.test(description)) return "A Microsoft pede a autorização de um administrador para este aplicativo. Avise a TI.";
  if (/AADSTS50105|AADSTS50020|AADSTS50034/.test(description)) return "Esta conta não tem acesso ao aplicativo do Regente na Microsoft. Avise a TI.";
  return "A Microsoft não concluiu o login.";
}

/** Fecha o fluxo na volta: confere o state, troca o código pelo id_token e devolve o id_token com o nonce deste login. */
export async function finishMicrosoftLogin(search: URLSearchParams): Promise<{ idToken: string; nonce: string }> {
  const pending = readPending();
  clearPending(); // o código vale uma vez só: nunca reaproveitar

  const error = search.get("error");
  if (error) {
    const description = search.get("error_description") ?? "";
    throw new SsoError(friendlyMicrosoftError(error, description), `${error}: ${description}`.slice(0, 400));
  }

  const code = search.get("code");
  if (!pending || !code || search.get("state") !== pending.state) {
    throw new SsoError("O login com a Microsoft expirou ou foi aberto em outra aba. Volte para o login e tente de novo.");
  }
  if (Date.now() - pending.createdAt > MAX_AGE_MS) {
    throw new SsoError("O login com a Microsoft demorou demais. Volte para o login e tente de novo.");
  }

  let response: Response;
  try {
    response = await fetch(`https://login.microsoftonline.com/${pending.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: pending.clientId,
        grant_type: "authorization_code",
        scope: SCOPE,
        code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.verifier,
      }),
    });
  } catch {
    throw new SsoError("Não foi possível falar com a Microsoft. Confira a conexão e tente de novo.");
  }

  const data = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !data.id_token) {
    const description = data.error_description ?? "";
    throw new SsoError(friendlyMicrosoftError(data.error ?? "", description), `${data.error ?? response.status}: ${description}`.slice(0, 400));
  }
  return { idToken: data.id_token, nonce: pending.nonce };
}
