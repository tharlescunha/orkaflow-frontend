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
