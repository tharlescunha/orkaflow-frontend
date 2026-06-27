import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Save, X } from "lucide-react";

import { createBotVersion, type CreateBotVersionPayload } from "@/services/api/bot-versions";
import { getBot, listBots } from "@/services/api/bots";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type CreateBotVersionFormState = {
  bot_id: string;
  version: string;
  storage_type: string;
  artifact_path: string;
  changelog: string;
  checksum: string;
  is_active: boolean;
};

const initialFormState: CreateBotVersionFormState = {
  bot_id: "",
  version: "1.0.0",
  storage_type: "local",
  artifact_path: "",
  changelog: "",
  checksum: "",
  is_active: true,
};

export function BotVersionCreatePage() {
  const navigate = useNavigate();

  const [toast, setToast] = useState<ToastState>(null);
  const [form, setForm] = useState<CreateBotVersionFormState>(initialFormState);

  const botsQuery = useQuery({
    queryKey: ["bots-select-for-create-version"],
    queryFn: () => listBots({ skip: 0, limit: 100 }),
  });

  const selectedBotId = Number(form.bot_id);

  const selectedBotQuery = useQuery({
    queryKey: ["bot-for-version-create", selectedBotId],
    queryFn: () => getBot(selectedBotId),
    enabled: Number.isFinite(selectedBotId) && selectedBotId > 0,
  });

  const sortedBots = useMemo(() => {
    return [...(botsQuery.data?.items ?? [])].sort((a, b) => {
      if (a.active !== b.active) return Number(b.active) - Number(a.active);
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [botsQuery.data]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!selectedBotQuery.data) return;

    setForm((prev) => ({
      ...prev,
      artifact_path: selectedBotQuery.data.source_url ?? "",
    }));
  }, [selectedBotQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateBotVersionPayload) => createBotVersion(payload),
    onSuccess: () => {
      setToast({
        type: "success",
        message: "Versão cadastrada com sucesso.",
      });

      setTimeout(() => {
        navigate("/bot-versions");
      }, 800);
    },
    onError: () => {
      setToast({
        type: "error",
        message: "Não foi possível cadastrar a versão.",
      });
    },
  });

  function handleChangeField<K extends keyof CreateBotVersionFormState>(
    field: K,
    value: CreateBotVersionFormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSelectBot(botId: string) {
    setForm((prev) => ({
      ...prev,
      bot_id: botId,
      artifact_path: "",
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload: CreateBotVersionPayload = {
      bot_id: Number(form.bot_id),
      version: form.version.trim(),
      storage_type: form.storage_type.trim(),
      artifact_path: form.artifact_path.trim() || null,
      changelog: form.changelog.trim() || null,
      is_active: form.is_active,
    };

    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      {toast ? (
        <div
          className={`fixed right-6 top-20 z-[80] flex items-start gap-3 border px-4 py-3 shadow-lg ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <X className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div className="pr-4 text-sm font-medium">{toast.message}</div>

          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 transition hover:text-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => navigate("/bot-versions")}
                className="mb-4 inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar para versões
              </button>

              <h1 className="text-2xl font-semibold text-slate-950">
                Nova Versão de Bot
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Cadastro de nova versão vinculada a um bot existente.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 px-6 py-6">
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Dados principais
                </h2>
              </div>

              <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                <FormField label="Bot">
                  <select
                    value={form.bot_id}
                    onChange={(e) => handleSelectBot(e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    required
                    disabled={botsQuery.isLoading}
                  >
                    <option value="">Selecione</option>
                    {sortedBots.map((bot) => (
                      <option key={bot.id} value={bot.id} disabled={!bot.active}>
                        {bot.name} {!bot.active ? "(Inativo)" : ""}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Versão">
                  <input
                    value={form.version}
                    onChange={(e) => handleChangeField("version", e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder="1.0.0"
                    required
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Changelog">
                    <textarea
                      value={form.changelog}
                      onChange={(e) => handleChangeField("changelog", e.target.value)}
                      className="min-h-[110px] w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="Descreva o que mudou nesta versão"
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Configuração
                </h2>
              </div>

              <div className="grid gap-5 px-5 py-5 md:grid-cols-2">
                <FormField label="Storage type">
                  <input
                    value={form.storage_type}
                    onChange={(e) => handleChangeField("storage_type", e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder="local"
                    required
                  />
                </FormField>

                <FormField label="Checksum">
                  <input
                    value={form.checksum}
                    onChange={(e) => handleChangeField("checksum", e.target.value)}
                    className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder="hash/checksum"
                  />
                </FormField>

                <div className="md:col-span-2">
                  <FormField label="Artifact path">
                    <input
                      value={form.artifact_path}
                      onChange={(e) => handleChangeField("artifact_path", e.target.value)}
                      className="h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                      placeholder="URL/caminho do artefato"
                      required
                    />
                  </FormField>
                </div>

                <div className="md:col-span-2">
                  <label className="inline-flex items-center gap-3 text-sm text-slate-700">
                    <input
                      checked={form.is_active}
                      onChange={(e) => handleChangeField("is_active", e.target.checked)}
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Versão ativa
                  </label>
                </div>

                {selectedBotQuery.data?.source_url ? (
                  <div className="md:col-span-2 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    URL do bot carregada automaticamente ao selecionar o bot.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => navigate("/bot-versions")}
              className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-slate-900">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
