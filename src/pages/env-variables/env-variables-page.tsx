import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/store/toast-store";
import {
  deleteEnvVariable,
  listEnvVariables,
  type EnvScopeType,
  type EnvVariableRead,
} from "@/services/api/env-variables";
import { EffectiveTab } from "./effective-tab";
import { SCOPE_LABELS } from "./scope-labels";
import { VariableFormSheet } from "./variable-form-sheet";
import { VariablesTable } from "./variables-table";
import { useScopeOptions } from "./use-scope-options";

type ScopeFilter = EnvScopeType | "all";
const FILTERS: ScopeFilter[] = ["all", "global", "bot", "automation", "runner"];

const chip = (active: boolean) =>
  `h-9 border px-3 text-sm font-medium transition ${
    active
      ? "border-slate-950 bg-slate-950 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

export function EnvVariablesPage() {
  const queryClient = useQueryClient();
  const { byScope, loading } = useScopeOptions();

  const [tab, setTab] = useState<"cadastro" | "efetivos">("cadastro");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [targetId, setTargetId] = useState<number | "">("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EnvVariableRead | null>(null);
  const [toDelete, setToDelete] = useState<EnvVariableRead | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const needsTarget = scope !== "all" && scope !== "global";

  const query = useQuery({
    queryKey: ["env-variables", scope, targetId, search],
    queryFn: () =>
      listEnvVariables({
        scope_type: scope === "all" ? undefined : scope,
        scope_id: needsTarget && targetId !== "" ? Number(targetId) : undefined,
        search: search || undefined,
      }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => deleteEnvVariable(id),
    onSuccess: () => {
      toast.success("Variável excluída.");
      queryClient.invalidateQueries({ queryKey: ["env-variables"] });
      queryClient.invalidateQueries({ queryKey: ["env-variables-effective"] });
      setToDelete(null);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, "Não foi possível excluir a variável."),
      );
      setToDelete(null);
    },
  });

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">
                Variáveis de ambiente
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-500">
                Parâmetros são o que muda a cada execução (datas, filtros).
                Variáveis são configuração fixa (URLs, usuários, pastas). Use
                os.environ['NOME'] no robô.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["env-variables"] })
                }
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCcw className="h-4 w-4" />
                Atualizar
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
            <button
              type="button"
              className={chip(tab === "cadastro")}
              onClick={() => setTab("cadastro")}
            >
              Cadastro
            </button>
            <button
              type="button"
              className={chip(tab === "efetivos")}
              onClick={() => setTab("efetivos")}
            >
              Valores finais
            </button>
          </div>
        </div>

        {tab === "cadastro" ? (
          <>
            <div className="space-y-3 border-b border-slate-200 bg-slate-50/60 px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={chip(scope === f)}
                    onClick={() => {
                      setScope(f);
                      setTargetId("");
                    }}
                  >
                    {f === "all" ? "Todos" : SCOPE_LABELS[f]}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,320px)_minmax(0,320px)]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Buscar por nome"
                    className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-slate-900"
                  />
                </div>
                {needsTarget && (
                  <SearchableSelect<number>
                    value={targetId}
                    onChange={setTargetId}
                    options={byScope[scope as EnvScopeType].map((o) => ({
                      value: o.id,
                      label: o.label,
                    }))}
                    emptyLabel={`Todos (${SCOPE_LABELS[scope as EnvScopeType]})`}
                    placeholder={`Todos (${SCOPE_LABELS[scope as EnvScopeType]})`}
                    searchPlaceholder="Digite para buscar..."
                    loading={loading[scope as EnvScopeType]}
                  />
                )}
              </div>
            </div>
            <VariablesTable
              items={query.data ?? []}
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
          <EffectiveTab />
        )}
      </section>

      <VariableFormSheet
        open={formOpen}
        editing={editing}
        defaultScope={
          needsTarget || scope === "global"
            ? (scope as EnvScopeType)
            : undefined
        }
        defaultScopeId={
          needsTarget && targetId !== "" ? Number(targetId) : null
        }
        onClose={() => setFormOpen(false)}
      />

      {toDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Excluir variável
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Excluir{" "}
                  <span className="font-mono font-medium">{toDelete.name}</span>{" "}
                  ({SCOPE_LABELS[toDelete.scope_type]}
                  {toDelete.scope_type !== "global"
                    ? `: ${toDelete.scope_label}`
                    : ""}
                  )? Esta ação não pode ser desfeita.
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
