import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/80", className)} aria-hidden="true" />;
}

// Linhas cinzas no lugar da tabela enquanto carrega (em vez do texto "Carregando...").
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-slate-100" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-16" : c === 1 ? "w-48" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Blocos no lugar de cards/grades.
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  );
}

// Cards das máquinas (Runners): imagem da tela em cima, nome + status, caixa de capacidade e linha do heartbeat.
export function RunnerCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5" role="status" aria-label="Carregando">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Skeleton className="aspect-video w-full rounded-none" />
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Cards da Saúde das automações: faixa à esquerda, título + bot, selo à direita e grade 2x2 de informações.
export function HealthCardSkeleton({ count = 8, gridClassName }: { count?: number; gridClassName: string }) {
  return (
    <div className={cn("grid gap-4", gridClassName)} role="status" aria-label="Carregando">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative min-h-[150px] overflow-hidden rounded-xl border border-slate-200 bg-white p-4 pl-5">
          <div className="absolute left-0 top-0 h-full w-1 bg-slate-200" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Tela do MCP: parágrafo, barra da URL, cartão de tokens com tabela e passo 2 com abas e comando.
export function McpPageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="rounded-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100 px-4">
          {Array.from({ length: 2 }).map((_, r) => (
            <div key={r} className="flex items-center gap-6 py-3">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-5 w-56" />
      </div>
      <Skeleton className="h-11 w-full max-w-xl rounded-lg" />
      <div className="flex gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  );
}

// Campos de formulário/detalhe.
export function DetailSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2" role="status" aria-label="Carregando">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ))}
    </div>
  );
}
