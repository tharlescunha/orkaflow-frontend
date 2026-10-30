import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, GitBranch, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { TableSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { EMPTY, formatDate } from "@/lib/format";
import { badge, btn, card, input, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  createGitEnvironment,
  deleteGitEnvironment,
  listGitEnvironments,
  updateGitEnvironment,
  type GitEnvironment,
  type GitEnvironmentPayload,
} from "@/services/api/settings";
import { toast } from "@/store/toast-store";

import { WorkersTab } from "./workers-tab";

const QUERY_KEY = ["git-environments"];

type FormState = {
  name: string;
  url_prefix: string;
  username: string;
  token: string;
  expires_at: string; // AAAA-MM-DD
  active: boolean;
};

const emptyForm: FormState = { name: "", url_prefix: "", username: "", token: "", expires_at: "", active: true };

function toForm(env: GitEnvironment): FormState {
  return {
    name: env.name,
    url_prefix: env.url_prefix,
    username: env.username ?? "",
    token: "",
    expires_at: env.expires_at ? env.expires_at.slice(0, 10) : "",
    active: env.active,
  };
}

function toPayload(form: FormState): GitEnvironmentPayload {
  return {
    name: form.name.trim(),
    url_prefix: form.url_prefix.trim(),
    username: form.username.trim() || null,
    token: form.token.trim() || null,
    // Fim do dia, no horário local de quem cadastra.
    expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
    active: form.active,
  };
}

const EXPIRY_LABEL: Record<GitEnvironment["expiry_status"], { text: string; className: string }> = {
  valido: { text: "Válido", className: tone.success },
  vence_em_breve: { text: "Vence em breve", className: tone.warning },
  vencido: { text: "Vencido", className: tone.danger },
};

const TABS = [
  { key: "ambientes", label: "Ambientes" },
  { key: "works", label: "Works" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Configurações gerais (admin): Ambientes de Git (token por começo de link) e Works (versão dos workers). */
export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabKey = params.get("aba") === "works" ? "works" : "ambientes";

  return (
    <div className="space-y-5">
      <section className={card}>
        <PageHeader title="Configurações" />
        <div className="space-y-5 p-5 md:p-6">
          <div role="tablist" aria-label="Seções de configurações" className="flex gap-1 border-b border-slate-200">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setParams(item.key === "ambientes" ? {} : { aba: item.key }, { replace: true })}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
                  tab === item.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "ambientes" ? <GitEnvironmentsCard /> : <WorkersTab />}
        </div>
      </section>
    </div>
  );
}

function GitEnvironmentsCard() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<GitEnvironment | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleting, setDeleting] = useState<GitEnvironment | null>(null);

  const envsQuery = useQuery({ queryKey: QUERY_KEY, queryFn: listGitEnvironments });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const saveMutation = useMutation({
    mutationFn: (payload: GitEnvironmentPayload) =>
      editing && editing !== "new" ? updateGitEnvironment(editing.id, payload) : createGitEnvironment(payload),
    onSuccess: async () => {
      toast.success(editing === "new" ? "Ambiente cadastrado." : "Ambiente atualizado.");
      setEditing(null);
      setForm(emptyForm);
      await invalidate();
      queryClient.invalidateQueries({ queryKey: ["git-url-check"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível salvar o ambiente.")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteGitEnvironment(id),
    onSuccess: async () => {
      toast.success("Ambiente removido.");
      setDeleting(null);
      await invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível remover o ambiente.")),
  });

  function startNew() {
    setForm(emptyForm);
    setEditing("new");
  }

  function startEdit(env: GitEnvironment) {
    setForm(toForm(env));
    setEditing(env);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim() || !form.url_prefix.trim()) return;
    if (editing === "new" && !form.token.trim()) return;
    saveMutation.mutate(toPayload(form));
  }

  const envs = envsQuery.data ?? [];
  const isNew = editing === "new";

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Ambientes de Git</h2>
        </div>
        {editing === null && (
          <button type="button" onClick={startNew} className={cn(btn.primary, "h-9 px-3")}>
            <Plus className="h-4 w-4" />
            Novo ambiente
          </button>
        )}
      </div>

      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-500">
          Token por começo de link. Bot cadastrado com o link limpo (sem token) usa o token do ambiente que cobre o endereço;
          link com token dentro continua valendo como está. No DevOps um ambiente cobre a organização inteira
          (<code className="font-mono text-xs">https://dev.azure.com/alzgraos/</code>); no GitHub é um por conta
          (<code className="font-mono text-xs">https://github.com/tharlescunha/</code>).
        </p>

        {editing !== null && (
          <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
            <Field label="Nome">
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={120} placeholder="Ex.: DevOps · ALZ Grãos" className={input} />
            </Field>
            <Field label="Começo do link (prefixo)">
              <input
                value={form.url_prefix}
                onChange={(e) => setForm({ ...form, url_prefix: e.target.value })}
                maxLength={500}
                placeholder="https://dev.azure.com/alzgraos/"
                className={cn(input, "font-mono")}
                inputMode="url"
              />
            </Field>
            <Field label={isNew ? "Token" : "Novo token (vazio mantém o atual)"}>
              <input
                type="password"
                autoComplete="new-password"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                maxLength={2000}
                placeholder={isNew ? "Cole o token" : "••••••••"}
                className={cn(input, "font-mono")}
              />
            </Field>
            <Field label="Usuário (opcional)">
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                maxLength={150}
                placeholder="Só se o Git exigir user:token"
                className={input}
              />
            </Field>
            <Field label="Vence em (opcional)">
              <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className={input} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Ativo
            </label>
            <div className="flex gap-2 md:col-span-2 md:justify-end">
              <button type="button" onClick={() => setEditing(null)} className={btn.secondary} disabled={saveMutation.isPending}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending || !form.name.trim() || !form.url_prefix.trim() || (isNew && !form.token.trim())}
                className={btn.primary}
              >
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isNew ? "Cadastrar" : "Salvar"}
              </button>
            </div>
          </form>
        )}

        {envsQuery.isLoading ? (
          <TableSkeleton rows={2} columns={5} />
        ) : envsQuery.isError ? (
          <QueryError error={envsQuery.error} what="os ambientes de Git" onRetry={() => envsQuery.refetch()} retrying={envsQuery.isFetching} />
        ) : envs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum ambiente cadastrado. Enquanto isso, o link do bot precisa vir com o token dentro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 pr-3 font-semibold">Começo do link</th>
                  <th className="py-2 pr-3 font-semibold">Token</th>
                  <th className="py-2 pr-3 font-semibold">Vence em</th>
                  <th className="py-2 pr-3 font-semibold">Situação</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {envs.map((env) => {
                  const expiry = EXPIRY_LABEL[env.expiry_status];
                  return (
                    <tr key={env.id} className={cn("border-b border-slate-200/80 last:border-b-0", !env.active && "opacity-60")}>
                      <td className="py-2 pr-3 font-medium text-slate-900">{env.name}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-700">{env.url_prefix}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-600">{env.token_hint ? `••••${env.token_hint}` : "••••"}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-600">
                        {env.expires_at ? formatDate(env.expires_at) : EMPTY}
                        {env.days_to_expire != null && env.expiry_status !== "vencido" ? (
                          <span className="ml-1 text-xs text-slate-400">({env.days_to_expire} d)</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="flex flex-wrap gap-1">
                          {!env.active ? <span className={cn(badge, tone.neutral)}>Inativo</span> : null}
                          <span className={cn(badge, expiry.className)}>
                            {env.expiry_status !== "valido" ? <AlertTriangle className="h-3 w-3" /> : null}
                            {expiry.text}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <span className="inline-flex gap-1">
                          <button type="button" onClick={() => startEdit(env)} className={cn(btn.icon, "h-8 w-8")} aria-label={`Editar ${env.name}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => setDeleting(env)} className={cn(btn.icon, "h-8 w-8 text-red-700 hover:bg-red-50")} aria-label={`Remover ${env.name}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {deleting && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>
              Remover <strong>{deleting.name}</strong>? Bots cadastrados com link limpo desse endereço param de clonar até outro ambiente cobrir.
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleting(null)} disabled={deleteMutation.isPending} className={cn(btn.secondary, "h-9 border-red-200 text-red-800 hover:bg-red-100")}>
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button type="button" onClick={() => deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending} className={cn(btn.danger, "h-9 px-3")}>
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Remover
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
