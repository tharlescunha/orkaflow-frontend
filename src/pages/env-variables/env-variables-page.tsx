import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileUp, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-error";
import { normalizeSearch } from "@/lib/search";
import { toast } from "@/store/toast-store";
import {
  deleteEnvVariable,
  listEnvVariables,
  type EnvScopeType,
  type EnvVariableRead,
} from "@/services/api/env-variables";
import { EffectiveTab } from "./effective-tab";
import { ImportEnvDialog } from "./import-env-dialog";
import { ScopeBadge } from "./scope-badge";
import { SCOPE_LABELS } from "./scope-labels";
import { VariableFormSheet } from "./variable-form-sheet";
import { groupVariables, type VariableGroup } from "./group-utils";
import { VariableGroups } from "./variable-groups";
import { VariablesTable } from "./variables-table";

type ScopeFilter = EnvScopeType | "all";

const chip = (active: boolean) =>
  `h-9 border px-3 text-sm font-medium transition ${
    active
      ? "border-slate-950 bg-slate-950 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

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

  // Com um alvo aberto, "Nova variável" e "Importar .env" já vêm nele.
  const defaultScope = openGroup && openGroup.scopeType !== "global" ? openGroup.scopeType : undefined;
  const defaultScopeId = openGroup && openGroup.scopeType !== "global" ? openGroup.scopeId : null;

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Variáveis de ambiente</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Configuração fixa do robô (URLs, usuários, pastas), por automação, bot ou máquina.
                Use os.environ['NOME'] no robô.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["env-variables"] })}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileUp className="h-4 w-4" />
                Importar .env
              </button>
              <button
                type="button"
                onClick={openNew}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Nova variável
              </button>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="button" className={chip(tab === "cadastro")} onClick={() => setTab("cadastro")}>
              Cadastro
            </button>
            <button type="button" className={chip(tab === "efetivos")} onClick={() => setTab("efetivos")}>
              Valores finais
            </button>
          </div>
        </div>

        {tab === "efetivos" ? (
          <EffectiveTab />
        ) : openGroup ? (
          <>
            <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4">
              <button
                type="button"
                onClick={backToTargets}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-950"
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
                <div className="relative md:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar variável"
                    className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            </div>
            <VariablesTable
              items={openVariables}
              hideScope
              loading={query.isLoading}
              error={query.isError}
              onEdit={(item) => {
                setEditing(item);
                setFormOpen(true);
              }}
              onDelete={setToDelete}
            />
          </>
        ) : (
          <>
            <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {filters.map((f) => (
                  <button key={f} type="button" className={chip(scope === f)} onClick={() => setScope(f)}>
                    {f === "all" ? "Todos" : SCOPE_LABELS[f]}
                  </button>
                ))}
              </div>
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar automação, bot, máquina ou nome de variável"
                  className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
                />
              </div>
            </div>
            <VariableGroups
              groups={visibleGroups}
              search={search}
              loading={query.isLoading}
              error={query.isError}
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

      {toDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Excluir variável</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Excluir <span className="font-mono font-medium">{toDelete.name}</span> (
                  {SCOPE_LABELS[toDelete.scope_type]}
                  {toDelete.scope_type !== "global" ? `: ${toDelete.scope_label}` : ""})? Esta ação
                  não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setToDelete(null)}
                disabled={removeMutation.isPending}
                className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate(toDelete.id)}
                disabled={removeMutation.isPending}
                className="h-10 bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
