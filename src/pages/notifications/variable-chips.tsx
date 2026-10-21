import type { NotificationVariable } from "@/services/api/notifications";

type Props = {
  variables: NotificationVariable[];
  loading?: boolean;
  error?: boolean;
  onInsert: (token: string) => void;
};

export function VariableChips({ variables, loading, error, onInsert }: Props) {
  if (loading) return <p className="text-xs text-slate-500">Carregando variáveis...</p>;
  if (error)
    return (
      <p className="text-xs text-amber-700">
        Não foi possível carregar a lista de variáveis. Você ainda pode digitar {"{{erro}}"} manualmente.
      </p>
    );

  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={v.name}
          type="button"
          // mouseDown evita perder o foco/posição do cursor no textarea
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(`{{${v.name}}}`)}
          title={`${v.description}\nExemplo: ${v.example}`}
          className="border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700 transition hover:border-slate-900 hover:bg-white"
        >
          {`{{${v.name}}}`}
        </button>
      ))}
    </div>
  );
}
