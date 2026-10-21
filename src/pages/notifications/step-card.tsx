import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import type { StepMethod } from "@/services/api/notifications";
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

const inputClass =
  "h-10 w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-900";
const iconBtn =
  "inline-flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

export function StepCard({ step, index, total, onChange, onRemove, onMove }: Props) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof StepForm>(k: K, v: StepForm[K]) => onChange({ ...step, [k]: v });

  return (
    <div className="border border-slate-200 bg-white">
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
        <button type="button" className={`${iconBtn} text-red-600 hover:bg-red-50`} title="Remover etapa" onClick={onRemove}>
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
              className={inputClass}
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
            <span className="mb-2 block text-sm font-medium text-slate-700">Cabeçalhos</span>
            <HeadersEditor rows={step.headers} onChange={(rows) => set("headers", rows)} />
          </div>
          <div className="md:col-span-2">
            <Label text="Corpo">
              <textarea
                value={step.body_template}
                onChange={(e) => set("body_template", e.target.value)}
                spellCheck={false}
                className="min-h-[120px] w-full border border-slate-300 bg-white px-3 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-slate-900"
                placeholder={'{\n  "usuario": "...",\n  "senha": "..."\n}'}
              />
            </Label>
          </div>
          <div className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Guardar da resposta</span>
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
      <span className="mb-2 block text-sm font-medium text-slate-700">{text}</span>
      {children}
    </label>
  );
}
