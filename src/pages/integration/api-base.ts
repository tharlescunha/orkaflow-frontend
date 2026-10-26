// Endereço do backend como o navegador o enxerga (VITE_API_URL); é o mesmo que a IA vai usar.
// Sem VITE_API_URL o front e o back estão no mesmo endereço.
export function browserApiBase() {
  const configured = String(import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(configured) ? configured : window.location.origin;
}

// PUBLIC_API_URL no backend tem prioridade; senão, o endereço que o navegador usa.
export function resolveApiBase(serverUrl?: string, publicConfigured?: boolean) {
  if (serverUrl && publicConfigured) return serverUrl.replace(/\/mcp$/, "");
  return browserApiBase();
}
