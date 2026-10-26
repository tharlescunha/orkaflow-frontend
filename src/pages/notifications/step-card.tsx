import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { StepMethod } from "@/services/api/notifications";
import { btn, card, input, label, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { HeadersEditor } from "./headers-editor";
import { ExtractEditor } from "./extract-editor";
import { STEP_METHODS, type StepForm } from "./step-utils";

type Props = {
  step: StepForm;
  index: number;
  total: number;
  onChange: (step: StepForm) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
};

const inputClass = input;
const iconBtn = cn(btn.icon, "h-8 w-8");

export function StepCard({ step, index, total, onChange, onRemove, onMove }: Props) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof StepForm>(k: K, v: StepForm[K]) => onChange({ ...step, [k]: v });

  return (
    <div className={cn(card, "overflow-hidden")}>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-800"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>
            {index + 1}. {step.name.trim() || "Etapa sem nome"}
          </span>
          <span className="font-mono text-xs font-normal text-slate-500">{step.method}</span>
        </button>
        <button type="button" className={iconBtn} title="Mover para cima" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={iconBtn}
          title="Mover para baixo"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
        <button type="button" className={cn(iconBtn, "text-red-600 hover:bg-red-50 hover:text-red-700")} title="Remover etapa" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="grid gap-4 px-4 py-4 md:grid-cols-[1fr_160px]">
          <Label text="Nome">
            <input
              className={inputClass}
              value={step.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Autenticar"
            />
          </Label>
          <Label text="Método">
            <select
              className={select}
              value={step.method}
              onChange={(e) => set("method", e.target.value as StepMethod)}
            >
              {STEP_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Label>
          <div className="md:col-span-2">
            <Label text="URL">
              <input
                className={inputClass}
                value={step.url}
                onChange={(e) => set("url", e.target.value)}
                placeholder="https://desk.exemplo.com/api/login"
                inputMode="url"
              />
            </Label>
          </div>
          <div className="md:col-span-2">
            <span className={label}>Cabeçalhos</span>
            <HeadersEditor rows={step.headers} onChange={(rows) => set("headers", rows)} />
          </div>
          <div className="md:col-span-2">
            <Label text="Corpo">
              <textarea
                value={step.body_template}
                onChange={(e) => set("body_template", e.target.value)}
                spellCheck={false}
                className={cn(textarea, "font-mono")}
                placeholder={'{\n  "usuario": "...",\n  "senha": "..."\n}'}
              />
            </Label>
          </div>
          <div className="md:col-span-2">
            <span className={label}>Guardar da resposta</span>
            <ExtractEditor rows={step.extract} onChange={(rows) => set("extract", rows)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-slate-900">
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}
