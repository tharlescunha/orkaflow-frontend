import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, EyeOff, FileUp, Upload, X } from "lucide-react";

import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { looksSecret, parseDotEnv, type DotEnvIgnored } from "@/lib/dotenv";
import {
  importEnvVariables,
  listEnvVariables,
  type EnvScopeType,
  type ImportEnvVariablesResult,
} from "@/services/api/env-variables";
import { toast } from "@/store/toast-store";
import { SCOPE_LABELS } from "./scope-labels";
import { useScopeOptions } from "./use-scope-options";

// Mesmas regras do backend (env_variable_service.normalize_name): a prévia só avisa,
// quem decide é a API.
const NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const RESERVED_PREFIX = "ORKAFLOW_";
const RESERVED_NAMES = new Set([
  "PATH", "PATHEXT", "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "TEMP", "TMP",
  "USERPROFILE", "USERNAME", "USERDOMAIN", "HOME", "HOMEDRIVE", "HOMEPATH", "APPDATA",
  "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMDATA", "COMPUTERNAME", "OS",
  "PROCESSOR_ARCHITECTURE", "NUMBER_OF_PROCESSORS", "PYTHONPATH", "PYTHONHOME",
  "VIRTUAL_ENV", "LD_PRELOAD", "LD_LIBRARY_PATH",
]);

// Global não é mais oferecido: variáveis ficam sempre ligadas a um bot, automação ou máquina.
const SCOPES: EnvScopeType[] = ["automation", "bot", "runner"];

type Row = {
  line: number;
  name: string;
  value: string;
  secret: boolean;
  include: boolean;
  problem: string | null;
};

function nameProblem(name: string): string | null {
  if (name.length > 120) return "Nome com mais de 120 caracteres.";
  if (!NAME_PATTERN.test(name)) return "Nome inválido: use letras, números e _.";
  if (name.startsWith(RESERVED_PREFIX)) return `${RESERVED_PREFIX}* é reservado do orquestrador.`;
  if (RESERVED_NAMES.has(name)) return "Variável do sistema, não pode ser sobrescrita.";
  return null;
}

function buildRows(text: string): { rows: Row[]; ignored: DotEnvIgnored[] } {
  const { entries, ignored } = parseDotEnv(text);
  const seen = new Map<string, number>();

  const rows = entries.map((entry) => {
    const name = entry.name.toUpperCase();
    let problem = nameProblem(name);
    if (!problem && seen.has(name)) problem = `Repetida (já aparece na linha ${seen.get(name)}).`;
    if (!problem) seen.set(name, entry.line);
    const secret = looksSecret(name);
    if (!problem && secret && !entry.value) problem = "Parece secreta, mas está sem valor.";
    return { line: entry.line, name, value: entry.value, secret, include: !problem, problem };
  });

  return { rows, ignored };
}

const chip = (active: boolean) =>
  `h-9 border px-3 text-sm font-medium transition ${
    active
      ? "border-slate-950 bg-slate-950 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  }`;

export function ImportEnvDialog({
  open,
  onClose,
  initialScope,
  initialTargetId,
}: {
  open: boolean;
  onClose: () => void;
  initialScope?: EnvScopeType;
  initialTargetId?: number | "";
}) {
  const queryClient = useQueryClient();
  const { byScope, loading } = useScopeOptions();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [scope, setScope] = useState<EnvScopeType>(
    initialScope && initialScope !== "global" ? initialScope : "automation",
  );
  const [targetId, setTargetId] = useState<number | "">(initialTargetId ?? "");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [ignored, setIgnored] = useState<DotEnvIgnored[]>([]);
  const [overwrite, setOverwrite] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [result, setResult] = useState<ImportEnvVariablesResult | null>(null);

  const needsTarget = scope !== "global";
  const scopeReady = !needsTarget || targetId !== "";

  // Variáveis que já existem no escopo escolhido (para a prévia dizer o que acontece com cada uma).
  const existingQuery = useQuery({
    queryKey: ["env-variables", "import-existing", scope, targetId],
    queryFn: () =>
      listEnvVariables({
        scope_type: scope,
        scope_id: needsTarget ? Number(targetId) : undefined,
      }),
    enabled: open && scopeReady,
  });
  const existingNames = useMemo(
    () => new Set((existingQuery.data ?? []).map((v) => v.name)),
    [existingQuery.data],
  );

  const importMutation = useMutation({
    mutationFn: () =>
      importEnvVariables({
        scope_type: scope,
        scope_id: needsTarget ? Number(targetId) : null,
        overwrite,
        variables: rows
          .filter((r) => r.include && !r.problem)
          .map((r) => ({ name: r.name, value: r.value, is_secret: r.secret })),
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["env-variables"] });
      queryClient.invalidateQueries({ queryKey: ["env-variables-effective"] });
      toast.success(
        `Importação concluída: ${data.created} criada(s), ${data.updated} atualizada(s), ` +
          `${data.skipped} mantida(s)${data.errors ? `, ${data.errors} com erro` : ""}.`,
      );
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Não foi possível importar as variáveis."));
    },
  });

  function loadText(text: string) {
    const built = buildRows(text);
    setRows(built.rows);
    setIgnored(built.ignored);
    setResult(null);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    file.text().then(loadText);
  }

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function setAllSecret(secret: boolean) {
    setRows((current) => current.map((row) => (row.problem ? row : { ...row, secret })));
  }

  function situation(row: Row): { text: string; tone: string } {
    if (row.problem) return { text: row.problem, tone: "text-red-700" };
    if (!scopeReady) return { text: "—", tone: "text-slate-400" };
    if (existingNames.has(row.name)) {
      return overwrite
        ? { text: "Já existe: será atualizada", tone: "text-amber-700" }
        : { text: "Já existe: será mantida", tone: "text-slate-500" };
    }
    return { text: "Nova", tone: "text-emerald-700" };
  }

  const selectable = rows.filter((r) => !r.problem);
  const toImport = selectable.filter((r) => r.include);
  const canImport = scopeReady && toImport.length > 0 && !importMutation.isPending;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9000]">
      <div className="absolute inset-0 bg-slate-950/55" onClick={() => !importMutation.isPending && onClose()} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative z-10 flex max-h-[92vh] w-full max-w-5xl flex-col border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Importar arquivo .env</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Cada linha NOME=valor vira uma variável no escopo escolhido. Comentários (#) e linhas
                em branco são ignorados.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={importMutation.isPending}
              className="p-1 text-slate-500 hover:text-slate-900"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <section className="space-y-3">
              <span className="block text-sm font-medium text-slate-700">1. Onde criar as variáveis</span>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={chip(scope === s)}
                    onClick={() => {
                      setScope(s);
                      setTargetId("");
                      setResult(null);
                    }}
                  >
                    {SCOPE_LABELS[s]}
                  </button>
                ))}
              </div>
              {needsTarget && (
                <div className="max-w-md">
                  <SearchableSelect<number>
                    value={targetId}
                    onChange={(value) => {
                      setTargetId(value);
                      setResult(null);
                    }}
                    options={byScope[scope].map((o) => ({ value: o.id, label: o.label }))}
                    placeholder={`Selecione ${SCOPE_LABELS[scope].toLowerCase()}`}
                    searchPlaceholder="Digite para buscar..."
                    loading={loading[scope]}
                  />
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700">2. Arquivo</span>
                <button
                  type="button"
                  onClick={() => setPasteMode((v) => !v)}
                  className="text-sm font-medium text-slate-600 underline hover:text-slate-950"
                >
                  {pasteMode ? "Escolher arquivo" : "Colar o conteúdo"}
                </button>
              </div>

              {pasteMode ? (
                <div className="space-y-2">
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    placeholder={"SAP_URL=https://...\nSAP_USUARIO=robo\nSAP_SENHA=..."}
                    className="min-h-[140px] w-full border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => loadText(pasted)}
                    disabled={!pasted.trim()}
                    className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Ler conteúdo
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFile(e.dataTransfer.files?.[0]);
                  }}
                  className="flex flex-col items-center justify-center gap-2 border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600"
                >
                  <FileUp className="h-6 w-6 text-slate-400" />
                  <span>{fileName ? `Arquivo: ${fileName}` : "Arraste o arquivo .env aqui ou"}</span>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {fileName ? "Escolher outro arquivo" : "Escolher arquivo"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      onFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </section>

            {rows.length > 0 && !result && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">
                    3. Conferir ({toImport.length} de {selectable.length} marcadas
                    {rows.length > selectable.length ? `, ${rows.length - selectable.length} com problema` : ""})
                  </span>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <button type="button" onClick={() => setAllSecret(true)} className="text-slate-600 underline hover:text-slate-950">
                      Todas secretas
                    </button>
                    <button type="button" onClick={() => setAllSecret(false)} className="text-slate-600 underline hover:text-slate-950">
                      Nenhuma secreta
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowValues((v) => !v)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-950"
                    >
                      {showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      {showValues ? "Ocultar valores" : "Mostrar valores"}
                    </button>
                  </div>
                </div>

                <div className="max-h-[40vh] overflow-auto border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="w-10 px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label="Marcar todas"
                            checked={selectable.length > 0 && toImport.length === selectable.length}
                            onChange={(e) =>
                              setRows((current) =>
                                current.map((r) => (r.problem ? r : { ...r, include: e.target.checked })),
                              )
                            }
                          />
                        </th>
                        <th className="px-3 py-2">Nome</th>
                        <th className="px-3 py-2">Valor</th>
                        <th className="w-20 px-3 py-2">Secreta</th>
                        <th className="px-3 py-2">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => {
                        const info = situation(row);
                        return (
                          <tr key={`${row.line}-${row.name}`} className="border-t border-slate-100 align-top">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={row.include}
                                disabled={!!row.problem}
                                onChange={(e) => updateRow(index, { include: e.target.checked })}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-900">
                              {row.name}
                              <span className="ml-1 text-slate-400">(linha {row.line})</span>
                            </td>
                            <td className="max-w-[280px] px-3 py-2 font-mono text-xs text-slate-700">
                              <span className="block truncate" title={showValues || !row.secret ? row.value : undefined}>
                                {row.value === ""
                                  ? <span className="text-slate-400">(vazio)</span>
                                  : row.secret && !showValues
                                    ? "••••••••"
                                    : row.value}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={row.secret}
                                disabled={!!row.problem}
                                onChange={(e) => updateRow(index, { secret: e.target.checked })}
                              />
                            </td>
                            <td className={`px-3 py-2 text-xs ${info.tone}`}>{info.text}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {ignored.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Linhas ignoradas (fora do formato NOME=valor): {ignored.map((i) => i.line).join(", ")}.
                  </p>
                )}

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                  Atualizar o valor das variáveis que já existem neste escopo
                </label>
              </section>
            )}

            {result && (
              <section className="space-y-2 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {result.created} criada(s), {result.updated} atualizada(s), {result.skipped} mantida(s)
                  {result.errors ? `, ${result.errors} com erro` : ""}.
                </p>
                {result.results.filter((r) => r.status === "error").length > 0 && (
                  <ul className="list-disc pl-5 text-xs text-red-700">
                    {result.results
                      .filter((r) => r.status === "error")
                      .map((r) => (
                        <li key={r.name}>
                          <span className="font-mono">{r.name}</span>: {r.message}
                        </li>
                      ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={importMutation.isPending}
              className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {result ? "Fechar" : "Cancelar"}
            </button>
            {!result && (
              <button
                type="button"
                onClick={() => importMutation.mutate()}
                disabled={!canImport}
                title={!scopeReady ? "Escolha o alvo do escopo" : undefined}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? "Importando..." : `Importar ${toImport.length} variável(is)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
