import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { useCurrentVersion } from "@/hooks/use-current-version";
import { useSeenVersion } from "@/lib/release-seen";
import { focusRing } from "@/lib/ui";

/** Versão atual ao lado da busca: abre a tela Atualizações. O pontinho azul avisa que saiu versão nova desde a última visita. */
export function ReleaseBadge() {
  const version = useCurrentVersion();
  const seen = useSeenVersion();

  if (!version) return null;
  const hasNews = seen !== version;

  return (
    <Link
      to="/releases"
      title={hasNews ? `Novidades no sistema (v${version}). Clique para ver o que mudou.` : `Atualizações do sistema (v${version})`}
      aria-label={`Atualizações do sistema, versão ${version}${hasNews ? ", com novidades" : ""}`}
      className={`relative flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 ${focusRing}`}
    >
      <Sparkles className="h-4 w-4 text-blue-600" />
      <span className="tabular-nums">v{version}</span>
      {hasNews && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white" aria-hidden="true" />}
    </Link>
  );
}
