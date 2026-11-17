import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, FileText, GitCommitHorizontal, History, Info, User } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SearchInput } from "@/components/common/filter-bar";
import { QueryError } from "@/components/common/query-error";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { DetailSkeleton } from "@/components/common/skeleton";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSeenVersion, markVersionSeen } from "@/lib/release-seen";
import { normalizeSearch } from "@/lib/search";
import { badge, btn, card, filterChip, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listReleases } from "@/services/api/releases";
import type { ReleaseFile, ReleaseItem, ReleaseType } from "@/types/release";

const PAGE_SIZE = 15;

type Filter = "all" | ReleaseType;

const TYPE_META: Record<ReleaseType, { label: string; tone: keyof typeof tone; hint: string }> = {
  melhoria: { label: "Melhoria", tone: "success", hint: "nova funcionalidade" },
  correcao: { label: "Correção", tone: "danger", hint: "correção pontual" },
  geral: { label: "Geral", tone: "info", hint: "mudança estrutural ou de infraestrutura" },
};

const FILE_STATUS: Record<string, { label: string; className: string }> = {
  A: { label: "novo", className: "bg-emerald-100 text-emerald-700" },
  M: { label: "alterado", className: "bg-slate-100 text-slate-600" },
  D: { label: "removido", className: "bg-red-100 text-red-700" },
  R: { label: "renomeado", className: "bg-amber-100 text-amber-700" },
};

const REPO_LABEL: Record<string, string> = { backend: "backend", frontend: "frontend", worker: "worker" };

/** Texto simples do ATUALIZACOES.md: parágrafos separados por linha em branco, `código` e **negrito**. */
function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index}>
          {paragraph.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
            if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) {
              return (
                <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
                  {part.slice(1, -1)}
                </code>
              );
            }
            if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={i} className="font-semibold text-slate-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

function searchText(item: ReleaseItem) {
  return normalizeSearch(
    [
      `v${item.version}`,
      item.title,
      item.problem,
      item.solution,
      item.requester ?? "",
      item.type_label,
      item.commits.map((c) => c.hash).join(" "),
      item.files.map((f) => f.path).join(" "),
    ].join(" ")
  );
}

export function ReleasesPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [showHelp, setShowHelp] = useState(false);
  // Última versão vista antes desta visita: o que saiu depois disso ganha o selo "Novo".
  const [previouslySeen] = useState<string | null>(() => getSeenVersion());

  const query = useQuery({
    queryKey: ["releases"],
    queryFn: listReleases,
    staleTime: 5 * 60_000,
  });

  const notes = query.data;

  useEffect(() => {
    if (notes?.current_version) markVersionSeen(notes.current_version);
  }, [notes?.current_version]);

  const newVersions = useMemo(() => {
    const items = notes?.items ?? [];
    if (!previouslySeen) return new Set<string>();
    const seenIndex = items.findIndex((item) => item.version === previouslySeen);
    return new Set(items.slice(0, seenIndex < 0 ? 0 : seenIndex).map((item) => item.version));
  }, [notes?.items, previouslySeen]);

  const filtered = useMemo(() => {
    const text = normalizeSearch(search);
    return (notes?.items ?? []).filter(
      (item) => (filter === "all" || item.type === filter) && (!text || searchText(item).includes(text))
    );
  }, [notes?.items, filter, search]);

  const shown = filtered.slice(0, visible);

  function chooseFilter(next: Filter) {
    setFilter(next);
    setVisible(PAGE_SIZE);
  }

  const counts = notes?.counts;

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-6 px-5 pb-5 pt-6 sm:px-8">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">Registro de versões</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-regente-ink">Atualizações do sistema</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tudo o que foi melhorando e corrigido no Regente, com o problema que existia e a solução entregue. Cada entrada traz também os
              commits e os arquivos alterados.
            </p>
            <button
              type="button"
              onClick={() => setShowHelp((value) => !value)}
              aria-expanded={showHelp}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
            >
              <Info className="h-3.5 w-3.5" />
              Como funciona a numeração de versão?
              {showHelp ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="flex items-start gap-8">
            <dl className="flex items-start gap-8">
              <div>
                <dd className="font-mono text-2xl font-bold tabular-nums text-slate-900">{notes?.total ?? "—"}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Entradas</dt>
              </div>
              <div>
                <dd className="font-mono text-2xl font-bold tabular-nums text-slate-900">{notes?.current_version ? `v${notes.current_version}` : "—"}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Versão atual</dt>
              </div>
              <div>
                <dd className="font-mono text-2xl font-bold tabular-nums text-slate-900">{notes?.last_release_at ? formatDate(notes.last_release_at) : "—"}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">Último deploy</dt>
              </div>
            </dl>
            <RefreshIndicator updatedAt={query.dataUpdatedAt} isFetching={query.isFetching} onRefresh={() => query.refetch()} />
          </div>
        </div>

        {showHelp && (
          <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700 sm:mx-8">
            <p>
              A versão tem quatro números, no padrão <strong className="font-mono">3.X.Y.Z</strong>. O <strong>3</strong> é a geração do sistema: o
              Regente é o terceiro orquestrador e esse número não muda. Nos três seguintes, cada tipo de atualização sobe uma casa e zera as casas à direita:
            </p>
            <ul className="mt-3 space-y-2">
              {(["geral", "melhoria", "correcao"] as ReleaseType[]).map((type) => (
                <li key={type} className="flex flex-wrap items-center gap-2">
                  <span className={cn(badge, tone[TYPE_META[type].tone])}>{TYPE_META[type].label}</span>
                  <span>
                    sobe o <strong className="font-mono">{type === "geral" ? "X" : type === "melhoria" ? "Y" : "Z"}</strong>: {TYPE_META[type].hint}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => chooseFilter("all")} className={filterChip(filter === "all")}>
              Todas{notes ? ` (${notes.total})` : ""}
            </button>
            {(["melhoria", "correcao", "geral"] as ReleaseType[]).map((type) => (
              <button key={type} type="button" onClick={() => chooseFilter(type)} className={filterChip(filter === type)}>
                {type === "melhoria" ? "Melhorias" : type === "correcao" ? "Correções" : "Gerais"}
                {counts ? ` (${counts[type]})` : ""}
              </button>
            ))}
          </div>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Buscar por descrição, arquivo, versão ou commit"
            className="sm:w-80"
          />
        </div>
      </section>

      {query.isLoading ? (
        <section className={card}>
          <div className="p-6">
            <DetailSkeleton fields={6} />
          </div>
        </section>
      ) : query.isError ? (
        <section className={card}>
          <div className="p-5">
            <QueryError error={query.error} what="as atualizações" onRetry={() => query.refetch()} retrying={query.isFetching} />
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section className={card}>
          <EmptyState
            icon={History}
            title={notes?.total ? "Nenhuma atualização com esses filtros" : "Nenhuma atualização registrada ainda"}
            description={notes?.total ? "Tente outro texto ou outro tipo." : "As atualizações aparecem aqui quando forem registradas no ATUALIZACOES.md."}
            action={
              notes?.total ? (
                <button
                  type="button"
                  className={btn.secondary}
                  onClick={() => {
                    setSearch("");
                    chooseFilter("all");
                  }}
                >
                  Limpar filtros
                </button>
              ) : undefined
            }
          />
        </section>
      ) : (
        <section className={cn(card, "divide-y divide-slate-100")}>
          {shown.map((item) => (
            <ReleaseEntry key={item.version} item={item} isNew={newVersions.has(item.version)} />
          ))}
          {filtered.length > shown.length && (
            <div className="flex justify-center px-5 py-5">
              <button type="button" className={btn.secondary} onClick={() => setVisible((value) => value + PAGE_SIZE)}>
                Mostrar mais ({filtered.length - shown.length} restantes)
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ReleaseEntry({ item, isNew }: { item: ReleaseItem; isNew: boolean }) {
  const [showFiles, setShowFiles] = useState(false);
  const meta = TYPE_META[item.type];

  return (
    <article id={`v${item.version}`} className="grid gap-4 px-5 py-6 sm:px-8 md:grid-cols-[170px_minmax(0,1fr)] md:gap-8">
      <div className="space-y-1.5">
        <p className="font-mono text-sm font-bold text-slate-900">v{item.version}</p>
        <p className="text-xs text-slate-500">{formatDateTime(item.released_at)}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {item.commits.map((commit) => (
            <span
              key={`${commit.repo}-${commit.hash}`}
              title={`Commit ${commit.hash} no repositório ${REPO_LABEL[commit.repo] ?? commit.repo}`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
            >
              <GitCommitHorizontal className="h-3 w-3 text-slate-400" />
              {commit.hash}
            </span>
          ))}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(badge, tone[meta.tone])}>{meta.label}</span>
          {isNew && <span className={cn(badge, "border-blue-600 bg-blue-600 text-white")}>Novo</span>}
        </div>
        <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-950">{item.title}</h2>

        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Problema</p>
            <RichText text={item.problem} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Solução</p>
            <RichText text={item.solution} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          {item.requester && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Solicitante: <strong className="font-semibold text-slate-700">{item.requester}</strong>
            </span>
          )}
          {item.files.length > 0 && (
            <button
              type="button"
              onClick={() => setShowFiles((value) => !value)}
              aria-expanded={showFiles}
              className="inline-flex items-center gap-1.5 font-medium text-blue-700 underline-offset-2 hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              {showFiles ? "Ocultar arquivos alterados" : `Ver arquivos alterados (${item.files.length})`}
              {showFiles ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {showFiles && <FileList files={item.files} />}
      </div>
    </article>
  );
}

function FileList({ files }: { files: ReleaseFile[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Arquivos alterados
      </p>
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {files.map((file) => {
          const status = FILE_STATUS[file.status] ?? FILE_STATUS.M;
          return (
            <li key={`${file.repo}-${file.path}`} className="flex items-center gap-3 px-4 py-2 text-xs">
              <span className={cn("inline-flex w-[72px] shrink-0 justify-center rounded px-1.5 py-0.5 font-medium", status.className)}>{status.label}</span>
              <span className="w-16 shrink-0 text-slate-400">{REPO_LABEL[file.repo] ?? file.repo}</span>
              <span className="min-w-0 break-all font-mono text-slate-700">{file.path}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
