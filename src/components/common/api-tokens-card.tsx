import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";

import { getApiErrorMessage } from "@/lib/api-error";
import { copyText } from "@/lib/clipboard";
import { badge, btn, card, input, select, tone } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast-store";
import {
  createApiToken,
  listApiTokens,
  revokeApiToken,
  type ApiToken,
  type ApiTokenCreated,
} from "@/services/api/integration";

const EXPIRY_OPTIONS = [
  { label: "30 dias", value: "30" },
  { label: "90 dias", value: "90" },
  { label: "1 ano", value: "365" },
  { label: "Sem expiração", value: "" },
];

const STATUS_STYLE: Record<ApiToken["status"], string> = {
  ativo: tone.success,
  revogado: tone.neutral,
  expirado: tone.warning,
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

type ApiTokensCardProps = {
  // Sem userId: tokens do próprio usuário. Com userId: administrador gerenciando outro usuário.
  userId?: number;
  userName?: string;
  // Na própria aba Integração: sem o link "Ver como configurar" e com o token novo preenchendo os exemplos.
  onCreated?: (token: string) => void;
  hideGuideLink?: boolean;
};

export function ApiTokensCard({ userId, userName, onCreated, hideGuideLink }: ApiTokensCardProps) {
  const queryClient = useQueryClient();
  const queryKey = ["api-tokens", userId ?? "me"];

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("365");
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const tokensQuery = useQuery({ queryKey, queryFn: () => listApiTokens(userId) });

  const createMutation = useMutation({
    mutationFn: () =>
      createApiToken({ name: name.trim(), expires_in_days: expiry ? Number(expiry) : null }, userId),
    onSuccess: async (token) => {
      setCreated(token);
      onCreated?.(token.token);
      setFormOpen(false);
      setName("");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível gerar o token.")),
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: number) => revokeApiToken(tokenId, userId),
    onSuccess: async () => {
      setRevoking(null);
      toast.success("Token revogado. Ele parou de funcionar.");
      await queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Não foi possível revogar o token.")),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  }

  const tokens = tokensQuery.data ?? [];
  const visible = showInactive ? tokens : tokens.filter((t) => t.status === "ativo");
  const hiddenCount = tokens.length - tokens.filter((t) => t.status === "ativo").length;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-700" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Tokens de integração</h2>
        </div>
        {!formOpen && (
          <button
            type="button"
            onClick={() => {
              setCreated(null);
              setFormOpen(true);
            }}
            className={cn(btn.primary, "h-9 px-3")}
          >
            <Plus className="h-4 w-4" />
            Gerar token
          </button>
        )}
      </div>

      <div className="space-y-4 p-4">
        <p className="text-sm text-slate-500">
          {userId
            ? `Tokens para ${userName ?? "este usuário"} usar o MCP do OrkaFlow numa IA (Claude, Cursor...) ou chamar a API. O token tem as mesmas permissões do usuário.`
            : "Use o token para conectar o MCP do OrkaFlow numa IA (Claude, Cursor...) ou chamar a API em scripts. Ele tem as mesmas permissões que você."}{" "}
          {!hideGuideLink && (
            <Link to="/integration/mcp" className="font-medium text-slate-900 underline underline-offset-2">
              Ver como configurar
            </Link>
          )}
        </p>

        {created && (
          <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 text-sm text-emerald-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Token <strong>{created.name}</strong> gerado. Copie agora: por segurança ele <strong>não aparece de novo</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCreated(null)}
                className="text-emerald-800/70 hover:text-emerald-900"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-stretch gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-900">
                {created.token}
              </code>
              <button
                type="button"
                onClick={() => copyText(created.token)}
                className={cn(btn.success, "px-3")}
              >
                <Copy className="h-4 w-4" />
                Copiar
              </button>
            </div>
          </div>
        )}

        {formOpen && (
          <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome</span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Claude do notebook"
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Validade</span>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className={select}
              >
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className={btn.secondary}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!name.trim() || createMutation.isPending}
                className={btn.primary}
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Gerar
              </button>
            </div>
          </form>
        )}

        {tokensQuery.isLoading ? (
          <p className="text-sm text-slate-500">Carregando tokens...</p>
        ) : tokensQuery.isError ? (
          <p className="text-sm text-red-700">{getApiErrorMessage(tokensQuery.error, "Não foi possível carregar os tokens.")}</p>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
            Nenhum token ativo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 pr-3 font-semibold">Token</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Criado</th>
                  <th className="py-2 pr-3 font-semibold">Expira</th>
                  <th className="py-2 pr-3 font-semibold">Último uso</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {visible.map((token) => (
                  <tr key={token.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="max-w-[220px] truncate py-2 pr-3 font-medium text-slate-900" title={token.name}>
                      {token.name}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-slate-600">{token.token_prefix}…</td>
                    <td className="py-2 pr-3">
                      <span className={`${badge} ${STATUS_STYLE[token.status]}`}>
                        {token.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatDateTime(token.created_at)}</td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">
                      {token.expires_at ? formatDateTime(token.expires_at) : "Nunca"}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{formatDateTime(token.last_used_at)}</td>
                    <td className="py-2 text-right">
                      {token.status === "ativo" && (
                        <button
                          type="button"
                          onClick={() => setRevoking(token)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-800"
          >
            {showInactive ? "Esconder revogados/expirados" : `Mostrar revogados/expirados (${hiddenCount})`}
          </button>
        )}

        {revoking && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>
              Revogar <strong>{revoking.name}</strong>? Quem estiver usando esse token perde o acesso na hora.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRevoking(null)}
                disabled={revokeMutation.isPending}
                className={cn(btn.secondary, "h-9 border-red-200 text-red-800 hover:bg-red-100")}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => revokeMutation.mutate(revoking.id)}
                disabled={revokeMutation.isPending}
                className={cn(btn.danger, "h-9 px-3")}
              >
                {revokeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Revogar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
