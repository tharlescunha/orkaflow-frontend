import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp, Plus } from "lucide-react";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FilterBar, SearchInput } from "@/components/common/filter-bar";
import { PageHeader } from "@/components/common/page-header";
import { RefreshIndicator } from "@/components/common/refresh-indicator";
import { getApiErrorMessage } from "@/lib/api-error";
import { normalizeSearch } from "@/lib/search";
import { btn, card, focusRing } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  deleteEnvVariable,
  listEnvVariables,
  type EnvScopeType,
  type EnvVariableRead,
} from "@/services/api/env-variables";
import { toast } from "@/store/toast-store";
import { EffectiveTab } from "./effective-tab";
import { ImportEnvDialog } from "./import-env-dialog";
import { ScopeBadge } from "./scope-badge";
import { SCOPE_LABELS } from "./scope-labels";
import { VariableFormSheet } from "./variable-form-sheet";
import { groupVariables, type VariableGroup } from "./group-utils";
import { VariableGroups } from "./variable-groups";
import { VariablesTable } from "./variables-table";

type ScopeFilter = EnvScopeType | "all";

// Chip de filtro/aba: azul quando ativo (cor de destaque do painel).
const chipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition",
    focusRing,
    active
      ? "border-blue-600 bg-blue-600 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  );

export function EnvVariablesPage() {
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"cadastro" | "efetivos">("cadastro");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  // Alvo aberto (bot, automação ou máquina). null = lista de alvos.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnvVariableRead | null>(null);
  const [toDelete, setToDelete] = useState<EnvVariableRead | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Todas as variáveis numa chamada; o agrupamento por alvo é feito aqui.
  const query = useQuery({
    queryKey: ["env-variables", "all"],
    queryFn: () => listEnvVariables(),
  });

  const groups = useMemo(() => groupVariables(query.data ?? []), [query.data]);
  const hasGlobal = groups.some((g) => g.scopeType === "global");
  const filters: ScopeFilter[] = ["all", "automation", "bot", "runner", ...(hasGlobal ? (["global"] as const) : [])];

  const visibleGroups = scope === "all" ? groups : groups.filter((g) => g.scopeType === scope);
  const openGroup: VariableGroup | null = groups.find((g) => g.key === openKey) ?? null;

  const openVariables = useMemo(() => {
    if (!openGroup) return [];
    const q = normalizeSearch(search);
    const list = [...openGroup.variables].sort((a, b) => a.name.localeCompare(b.name));
    return q ? list.filter((v) => normalizeSearch(`${v.name} ${v.description ?? ""}`).includes(q)) : list;
  }, [openGroup, search]);

  const removeMutation = useMutation({
    mutationFn: (id: number) => deleteEnvVariable(id),
    onSuccess: () => {
      toast.success("Variável excluída.");
      queryClient.invalidateQueries({ queryKey: ["env-variables"] });
      queryClient.invalidateQueries({ queryKey: ["env-variables-effective"] });
      setToDelete(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível excluir a variável."));
      setToDelete(null);
    },
  });

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openTarget(group: VariableGroup) {
    setOpenKey(group.key);
    setSearch("");
  }

  function backToTargets() {
    setOpenKey(null);
    setSearch("");
  }

  function clearFilters() {
    setSearch("");
    setScope("all");
  }

  // Com um alvo aberto, "Nova variável" e "Importar .env" já vêm nele.
  const defaultScope = openGroup && openGroup.scopeType !== "global" ? openGroup.scopeType : undefined;
  const defaultScopeId = openGroup && openGroup.scopeType !== "global" ? openGroup.scopeId : null;

  const hasActiveFilters = search.trim() !== "" || scope !== "all";

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader
          title="Variáveis de ambiente"
          description="Configuração fixa do robô (URLs, usuários, pastas), por automação, bot ou máquina. Use os.environ['NOME'] no robô."
          actions={
            <>
              <RefreshIndicator
                updatedAt={query.dataUpdatedAt}
                isFetching={query.isFetching}
                onRefresh={() => queryClient.invalidateQueries({ queryKey: ["env-variables"] })}
              />
              <button type="button" onClick={() => setImportOpen(true)} className={btn.secondary}>
                <FileUp className="h-4 w-4" />
                Importar .env
              </button>
              <button type="button" onClick={openNew} className={btn.primary}>
                <Plus className="h-4 w-4" />
                Nova variável
              </button>
            </>
          }
        />

        <div className="flex gap-2 border-b border-slate-200 px-5 py-3" role="tablist" aria-label="Seções">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "cadastro"}
            className={chipClass(tab === "cadastro")}
            onClick={() => setTab("cadastro")}
          >
            Cadastro
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "efetivos"}
            className={chipClass(tab === "efetivos")}
            onClick={() => setTab("efetivos")}
          >
            Valores finais
          </button>
        </div>

        {tab === "efetivos" ? (
          <EffectiveTab />
        ) : openGroup ? (
          <>
            <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 px-5 py-3">
              <button
                type="button"
                onClick={backToTargets}
                className={cn("inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-slate-600 transition hover:text-blue-700", focusRing)}
              >
                <ArrowLeft className="h-4 w-4" />
                Todas as automações, bots e máquinas
              </button>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <ScopeBadge type={openGroup.scopeType} />
                  <h2 className="truncate text-lg font-semibold text-slate-950" title={openGroup.label}>
                    {openGroup.label}
                  </h2>
                  <span className="shrink-0 text-sm text-slate-500">
                    {openGroup.variables.length} variáve{openGroup.variables.length === 1 ? "l" : "is"}
                  </span>
                </div>
                <SearchInput value={search} onChange={setSearch} placeholder="Buscar variável" className="md:w-80" />
              </div>
            </div>
            <VariablesTable
              items={openVariables}
              hideScope
              loading={query.isLoading}
              error={query.isError ? query.error : null}
              onRetry={() => query.refetch()}
              retrying={query.isFetching}
              searching={search.trim() !== ""}
              onClearSearch={() => setSearch("")}
              onNew={openNew}
              onEdit={(item) => {
                setEditing(item);
                setFormOpen(true);
              }}
              onDelete={setToDelete}
            />
          </>
        ) : (
          <>
            <FilterBar hasActiveFilters={hasActiveFilters} onClear={clearFilters}>
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Buscar automação, bot, máquina ou variável"
                className="sm:w-80"
              />
              <div className="flex flex-wrap gap-2" role="group" aria-label="Escopo">
                {filters.map((f) => (
                  <button key={f} type="button" className={chipClass(scope === f)} onClick={() => setScope(f)}>
                    {f === "all" ? "Todos" : SCOPE_LABELS[f]}
                  </button>
                ))}
              </div>
            </FilterBar>
            <VariableGroups
              groups={visibleGroups}
              search={search}
              loading={query.isLoading}
              error={query.isError ? query.error : null}
              onRetry={() => query.refetch()}
              retrying={query.isFetching}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              onNew={openNew}
              onImport={() => setImportOpen(true)}
              onOpen={openTarget}
            />
          </>
        )}
      </section>

      <VariableFormSheet
        open={formOpen}
        editing={editing}
        defaultScope={defaultScope}
        defaultScopeId={defaultScopeId}
        onClose={() => setFormOpen(false)}
      />

      {/* Montado só quando aberto: cada importação começa do zero, já no alvo aberto na tela. */}
      {importOpen && (
        <ImportEnvDialog
          open
          onClose={() => setImportOpen(false)}
          initialScope={defaultScope}
          initialTargetId={defaultScopeId ?? ""}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir variável"
        confirmLabel="Excluir"
        tone="danger"
        isPending={removeMutation.isPending}
        onConfirm={() => toDelete && removeMutation.mutate(toDelete.id)}
        onCancel={() => {
          if (!removeMutation.isPending) setToDelete(null);
        }}
        description={
          toDelete ? (
            <p>
              Excluir <span className="font-mono font-medium text-slate-900">{toDelete.name}</span> (
              {SCOPE_LABELS[toDelete.scope_type]}
              {toDelete.scope_type !== "global" ? `: ${toDelete.scope_label}` : ""})? O robô deixa de receber
              esta variável. Esta ação não pode ser desfeita.
            </p>
          ) : undefined
        }
      />
    </div>
  );
}
