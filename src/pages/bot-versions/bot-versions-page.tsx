import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Eye, MoreVertical, Plus, RefreshCcw, Search } from "lucide-react";

import { listBotVersions } from "@/services/api/bot-versions";
import { listBots } from "@/services/api/bots";

const PAGE_SIZE = 10;

type BotVersionListItem = {
  id: number;
  bot_id: number;
  version: string;
  storage_type: string;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "---";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatActive(value: boolean) {
  return value ? "Ativo" : "Inativo";
}

export function BotVersionsPage() {
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [botFilter, setBotFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [actionMenuVersionId, setActionMenuVersionId] = useState<number | null>(null);

  const versionsQuery = useQuery({
    queryKey: ["bot-versions"],
    queryFn: listBotVersions,
  });

  const botsQuery = useQuery({
    queryKey: ["bots-select-for-versions"],
    queryFn: () => listBots({ skip: 0, limit: 100 }),
  });

  const versions = (versionsQuery.data ?? []) as BotVersionListItem[];
  const bots = [...(botsQuery.data?.items ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active)
  );

  const botNameMap = useMemo(() => {
    return new Map(bots.map((bot) => [bot.id, bot.name]));
  }, [bots]);

  const filteredItems = versions.filter((item) => {
    const botName = botNameMap.get(item.bot_id) ?? `Bot #${item.bot_id}`;

    const matchesSearch =
      !search ||
      item.version.toLowerCase().includes(search.toLowerCase()) ||
      botName.toLowerCase().includes(search.toLowerCase());

    const matchesBot = !botFilter || String(item.bot_id) === botFilter;

    const matchesActive =
      activeFilter === ""
        ? true
        : activeFilter === "true"
          ? item.is_active
          : !item.is_active;

    return matchesSearch && matchesBot && matchesActive;
  });

  const skip = (page - 1) * PAGE_SIZE;
  const paginatedItems = filteredItems.slice(skip, skip + PAGE_SIZE);
  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  function handleRefresh() {
    versionsQuery.refetch();
    botsQuery.refetch();
  }

  function openCreatePage() {
    navigate("/bot-versions/new");
  }

  function openInfo(versionId: number) {
    setActionMenuVersionId(null);
    navigate(`/bot-versions/${versionId}`);
  }

  return (
    <>
      {actionMenuVersionId ? (
        <button
          type="button"
          aria-label="Fechar menu de ações"
          onClick={() => setActionMenuVersionId(null)}
          className="fixed inset-0 z-10 bg-transparent"
        />
      ) : null}

      <div className="space-y-5">
        <section className="border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-950">
                  Bot Versions
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Controle de versões dos bots
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Atualizar
                </button>

                <button
                  type="button"
                  onClick={openCreatePage}
                  className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Nova versão
                </button>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-4">
            <div className="grid gap-3 lg:grid-cols-[280px_240px_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => {
                    setPage(1);
                    setSearch(e.target.value);
                  }}
                  placeholder="Buscar por versão ou bot"
                  className="h-10 w-full border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                  type="text"
                />
              </div>

              <select
                value={botFilter}
                onChange={(e) => {
                  setPage(1);
                  setBotFilter(e.target.value);
                }}
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os bots</option>
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} {!bot.active ? "(Inativo)" : ""}
                  </option>
                ))}
              </select>

              <select
                value={activeFilter}
                onChange={(e) => {
                  setPage(1);
                  setActiveFilter(e.target.value as "" | "true" | "false");
                }}
                className="h-10 border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
              >
                <option value="">Todos os status</option>
                <option value="true">Ativos</option>
                <option value="false">Inativos</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full">
              <thead className="bg-slate-100">
                <tr className="text-left">
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    ID
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Bot
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Versão
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Storage
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Status
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Criado em
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {versionsQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Carregando versões...
                    </td>
                  </tr>
                ) : versionsQuery.isError ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-red-600"
                    >
                      Erro ao carregar versões.
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-slate-500"
                    >
                      Nenhuma versão encontrada.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <BotVersionRow
                      key={item.id}
                      item={item}
                      botName={botNameMap.get(item.bot_id) ?? `Bot #${item.bot_id}`}
                      actionMenuVersionId={actionMenuVersionId}
                      setActionMenuVersionId={setActionMenuVersionId}
                      onOpenInfo={openInfo}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              {total === 0
                ? "0 resultados"
                : `${skip + 1} a ${Math.min(skip + PAGE_SIZE, total)} de ${total}`}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>

              <span className="px-2 text-sm text-slate-600">
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="h-9 border border-slate-300 bg-white px-3 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

type BotVersionRowProps = {
  item: BotVersionListItem;
  botName: string;
  actionMenuVersionId: number | null;
  setActionMenuVersionId: (id: number | null) => void;
  onOpenInfo: (versionId: number) => void;
};

function BotVersionRow({
  item,
  botName,
  actionMenuVersionId,
  setActionMenuVersionId,
  onOpenInfo,
}: BotVersionRowProps) {
  const isOpen = actionMenuVersionId === item.id;
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  function handleToggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();

    if (isOpen) {
      setActionMenuVersionId(null);
      setMenuPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.right - 192,
    });

    setActionMenuVersionId(item.id);
  }

  return (
    <tr className="border-b border-slate-200 transition hover:bg-slate-50/70">
      <td className="px-4 py-3 text-sm font-medium text-blue-700">
        <button
          type="button"
          onClick={() => onOpenInfo(item.id)}
          className="transition hover:text-blue-900"
        >
          {item.id}
        </button>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">
        <button
          type="button"
          onClick={() => onOpenInfo(item.id)}
          className="font-medium text-slate-900 transition hover:text-blue-700"
        >
          {botName}
        </button>
      </td>

      <td className="px-4 py-3 text-sm text-slate-700">{item.version}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{item.storage_type}</td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {formatActive(item.is_active)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-700">
        {formatDateTime(item.created_at)}
      </td>

      <td className="relative px-4 py-3">
        <button
          type="button"
          onClick={handleToggleMenu}
          className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isOpen && menuPosition
          ? createPortal(
              <div
                className="fixed z-[120] w-48 border border-slate-200 bg-white p-2 shadow-lg"
                style={{ top: menuPosition.top, left: menuPosition.left }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenInfo(item.id);
                    setActionMenuVersionId(null);
                    setMenuPosition(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  <Eye className="h-4 w-4" />
                  Informações
                </button>
              </div>,
              document.body
            )
          : null}
      </td>
    </tr>
  );
}
