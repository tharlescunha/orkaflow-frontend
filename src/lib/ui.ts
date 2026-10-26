// Linguagem visual única do painel. Todas as telas usam estas classes em vez de montar as suas.
// Direção "claro e leve": fundo branco-azulado, cartões brancos com cantos grandes e sombra suave,
// azul do logo (blue-600) como destaque, filtros em chips, foco visível.

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

const buttonBase = `inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export const btn = {
  /** Ação principal da tela (uma por tela): Nova task, Salvar, Executar. */
  primary: `${buttonBase} bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:-translate-y-px hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/25 active:translate-y-0`,
  /** Ações comuns: Atualizar, Voltar, Cancelar. */
  secondary: `${buttonBase} border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50`,
  /** Ações destrutivas: Apagar, Parada forçada, Revogar. */
  danger: `${buttonBase} bg-red-600 text-white shadow-md shadow-red-600/20 hover:bg-red-700`,
  /** Variante contornada da destrutiva (dentro de tabelas). */
  dangerOutline: `${buttonBase} border border-red-200 bg-white text-red-700 hover:bg-red-50`,
  /** Confirmações positivas: Ativar, Reativar. */
  success: `${buttonBase} bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700`,
  /** Sem borda, para ações discretas. */
  ghost: `${buttonBase} text-slate-600 hover:bg-slate-100 hover:text-slate-900`,
  /** Botão só com ícone (menu de ações, fechar). */
  icon: `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 ${focusRing}`,
  /** Tamanho menor para linhas de tabela. */
  sm: "h-8 px-3 text-xs",
} as const;

export const input = `h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 disabled:text-slate-500`;
export const inputWithIcon = `${input} pl-9`;
export const select = input;
export const textarea = `min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`;
export const label = "mb-1.5 block text-sm font-medium text-slate-700";
export const hint = "mt-1 text-xs text-slate-500";
export const fieldError = "mt-1 text-xs font-medium text-red-600";

/** Cartão/seção: branco, cantos grandes, sombra suave. */
export const card = "rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-14px_rgba(15,23,42,0.2)]";
export const cardHeader = "flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3";
export const cardTitle = "text-sm font-semibold uppercase tracking-wide text-slate-600";
export const cardBody = "px-5 py-5";
/** Cartão que levanta no hover (listas de cards, KPIs). */
export const cardHover = `${card} transition duration-150 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_28px_-14px_rgba(15,23,42,0.28)]`;

/** Link em texto (ids, nomes clicáveis). */
export const link = `font-medium text-blue-600 underline-offset-2 hover:underline ${focusRing} rounded-sm`;

export const table = {
  wrap: "overflow-x-auto",
  table: "min-w-full border-collapse text-sm",
  thead: "bg-slate-50",
  th: "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-slate-500",
  thRight: "whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide text-slate-500",
  tr: "border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50",
  trClickable: "cursor-pointer border-b border-slate-100 transition-colors last:border-b-0 hover:bg-slate-50",
  td: "px-4 py-3.5 align-middle text-[14px] text-slate-700",
  tdMuted: "px-4 py-3.5 align-middle text-[14px] text-slate-500",
  tdStrong: "px-4 py-3.5 align-middle text-[14px] font-medium text-slate-900",
  tdRight: "px-4 py-3.5 text-right align-middle",
  /** Nomes longos: largura máxima + reticências; o title mostra o nome inteiro. */
  truncate: "block max-w-[280px] truncate",
} as const;

/** Chip/badge neutro (contagens, rótulos). */
export const chip = "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700";

/** Tons semânticos para badges de estado genéricos (ativo/inativo, online/offline...). */
export const tone = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

export const badge = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium";

/** Chip de filtro (Tudo / Rodando / Erro...): ativo escuro, inativo discreto. */
export const filterChip = (active: boolean) =>
  `inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${focusRing} ${
    active ? "bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
  }`;
