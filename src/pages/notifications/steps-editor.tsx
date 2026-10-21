import { Plus } from "lucide-react";
import { StepCard } from "./step-card";
import { MAX_STEPS, newStep, type StepForm } from "./step-utils";

type Props = { steps: StepForm[]; onChange: (steps: StepForm[]) => void };

export function StepsEditor({ steps, onChange }: Props) {
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Use para autenticar antes de abrir o chamado: guarde o token em uma variável e use{" "}
        {"{{token}}"} nos cabeçalhos do envio principal.
      </p>
      {steps.length === 0 && <p className="text-xs text-slate-500">Nenhuma etapa anterior ao envio.</p>}
      {steps.map((s, i) => (
        <StepCard
          key={s.id}
          step={s}
          index={i}
          total={steps.length}
          onChange={(ns) => onChange(steps.map((x) => (x.id === s.id ? ns : x)))}
          onRemove={() => onChange(steps.filter((x) => x.id !== s.id))}
          onMove={(d) => move(i, d)}
        />
      ))}
      <button
        type="button"
        disabled={steps.length >= MAX_STEPS}
        onClick={() => onChange([...steps, newStep(steps.length === 0)])}
        className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Adicionar etapa
      </button>
      {steps.length >= MAX_STEPS && (
        <span className="ml-2 text-xs text-slate-500">Limite de {MAX_STEPS} etapas.</span>
      )}
    </div>
  );
}
