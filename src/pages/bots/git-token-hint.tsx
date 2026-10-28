import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { checkGitUrl } from "@/services/api/settings";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 500;

function looksLikeUrl(value: string) {
  return /^https?:\/\/[^/\s]+\/\S*/i.test(value);
}

/**
 * Abaixo do campo do link do bot: diz de onde vem o token para aquele endereço.
 * Link com token → "token do próprio link"; link limpo → o ambiente de Git que cobre o endereço;
 * nenhum dos dois → alerta, porque o clone vai falhar na máquina.
 */
export function GitTokenHint({ url, className }: { url: string; className?: string }) {
  const trimmed = url.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(trimmed), DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [trimmed]);

  const masked = debounced.includes("***@");
  const enabled = looksLikeUrl(debounced) && !masked;

  const query = useQuery({
    queryKey: ["git-url-check", debounced],
    queryFn: () => checkGitUrl(debounced),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  if (!enabled) return null;

  if (query.isLoading || debounced !== trimmed) {
    return (
      <p className={cn("mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Conferindo de onde vem o token...
      </p>
    );
  }

  if (query.isError || !query.data) return null;

  const info = query.data;
  if (info.token_source === "nenhum") {
    return (
      <div role="alert" className={cn("mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900", className)}>
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Nenhum token para esse endereço. Cole o link com o token ou cadastre o ambiente em{" "}
          <Link to="/settings" className="font-semibold underline underline-offset-2">
            Configurações → Ambientes de Git
          </Link>
          .
        </span>
      </div>
    );
  }

  const expired = info.expiry_status === "vencido";
  const soon = info.expiry_status === "vence_em_breve";
  return (
    <div
      className={cn(
        "mt-2 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
        expired
          ? "border-red-200 bg-red-50 text-red-900"
          : soon
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900",
        className
      )}
    >
      {info.token_source === "link" ? <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>{info.message}</span>
    </div>
  );
}
