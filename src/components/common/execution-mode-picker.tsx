import { Monitor, Server } from "lucide-react";

import { cn } from "@/lib/utils";

export type ExecutionMode = "background" | "foreground";

const OPTIONS: Array<{ value: ExecutionMode; title: string; summary: string; icon: typeof Server }> = [
  {
    value: "background",
    title: "Background",
    summary: "Sem tela: API, arquivos, banco, integrações.",
    icon: Server,
  },
  {
    value: "foreground",
    title: "Foreground",
    summary: "Usa a tela: abre sistema, clica, digita, foca janela.",
    icon: Monitor,
  },
];

const HINT: Record<ExecutionMode, string> = {
  background: "Se o robô precisar de janela ativa ou sessão logada, ele não vai funcionar neste modo.",
  foreground: "O worker roda o robô na área de trabalho da máquina, com a sessão do usuário aberta.",
};

type ExecutionModePickerProps = {
  value: ExecutionMode;
  onChange: (mode: ExecutionMode) => void;
};

// Escolha do modo de execução do bot: dois cartões curtos e uma linha de aviso para o modo escolhido.
export function ExecutionModePicker({ value, onChange }: ExecutionModePickerProps) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de execução">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
                active ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">{option.title}</span>
                <span className="block text-[13px] leading-5 text-slate-600">{option.summary}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-5 text-slate-500">{HINT[value]}</p>
    </div>
  );
}
