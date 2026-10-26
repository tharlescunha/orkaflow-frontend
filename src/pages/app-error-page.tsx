import { useState } from "react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { AlertTriangle, ChevronRight, Home, RefreshCcw, SearchX } from "lucide-react";

// Página de erro do próprio painel (antes aparecia o "Unexpected Application Error!" do react-router).
export function AppErrorPage() {
  const error = useRouteError();
  const [showDetail, setShowDetail] = useState(false);

  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ""}` : JSON.stringify(error, null, 2);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center border ${notFound ? "border-slate-200 bg-slate-50 text-slate-500" : "border-red-200 bg-red-50 text-red-700"}`}>
            {notFound ? <SearchX className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-950">
              {notFound ? "Página não encontrada" : "Algo deu errado nesta tela"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {notFound
                ? "O endereço não existe ou mudou de lugar. Use o menu para chegar onde queria."
                : "O painel continua funcionando; só esta tela falhou. Recarregue ou volte ao início."}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/" className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
            <Home className="h-4 w-4" />
            Ir para o início
          </Link>
          {!notFound && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Recarregar
            </button>
          )}
        </div>

        {!notFound && (
          <div className="mt-6">
            <button type="button" onClick={() => setShowDetail((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
              <ChevronRight className={`h-3.5 w-3.5 transition ${showDetail ? "rotate-90" : ""}`} />
              Detalhe técnico
            </button>
            {showDetail && (
              <pre className="mt-2 max-h-64 overflow-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">{detail}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-slate-500">
            <SearchX className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Página não encontrada</h1>
            <p className="mt-1 text-sm text-slate-600">O endereço não existe ou mudou de lugar. Use o menu para chegar onde queria.</p>
          </div>
        </div>
        <div className="mt-6">
          <Link to="/" className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800">
            <Home className="h-4 w-4" />
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}
