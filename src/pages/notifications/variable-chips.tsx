import type { NotificationVariable } from "@/services/api/notifications";

type Props = {
  variables: NotificationVariable[];
  /** Variáveis definidas em "Guardar da resposta" das etapas. */
  stepVariables?: string[];
  loading?: boolean;
  error?: boolean;
  onInsert: (token: string) => void;
};

export function VariableChips({ variables, stepVariables = [], loading, error, onInsert }: Props) {
  return (
    <div className="space-y-2">
      {loading ? (
        <p className="text-xs text-slate-500">Carregando variáveis...</p>
      ) : error ? (
        <p className="text-xs text-amber-700">
          Não foi possível carregar a lista de variáveis. Você ainda pode digitar {"{{erro}}"} manualmente.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v) => (
            <button
              key={v.name}
              type="button"
              // mouseDown evita perder o foco/posição do cursor no textarea
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(`{{${v.name}}}`)}
              title={`${v.description}\nExemplo: ${v.example}`}
              className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700 transition hover:border-blue-500 hover:bg-white hover:text-blue-700"
            >
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      )}

      {stepVariables.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">da etapa</span>
          {stepVariables.map((name) => (
            <button
              key={name}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onInsert(`{{${name}}}`)}
              title="Variável guardada da resposta de uma etapa anterior (o valor nunca é exibido)"
              className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1 font-mono text-xs text-blue-800 transition hover:border-blue-600 hover:bg-white"
            >
              {`{{${name}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
