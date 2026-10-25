import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SearchableSelect } from "@/components/common/searchable-select";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/store/toast-store";
import {
  createEnvVariable,
  updateEnvVariable,
  type EnvScopeType,
  type EnvVariableRead,
} from "@/services/api/env-variables";
import { SCOPE_LABELS } from "./scope-labels";
import { useScopeOptions } from "./use-scope-options";

const NAME_PATTERN = /^[A-Z_][A-Z0-9_]*$/;
const input =
  "w-full border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-500";
const label = "mb-1 block text-sm font-medium text-slate-700";

type Props = {
  open: boolean;
  /** null = criando. */
  editing: EnvVariableRead | null;
  defaultScope?: EnvScopeType;
  defaultScopeId?: number | null;
  onClose: () => void;
};

// Clique/Esc dentro da lista do SearchableSelect (portal) não deve fechar o Sheet.
function isInsideSelectPanel(target: EventTarget | null) {
  return target instanceof Element && target.closest('[role="listbox"]') !== null;
}

export function VariableFormSheet(props: Props) {
  const { open, editing, onClose } = props;
  return (
    // modal={false}: o SearchableSelect abre a lista num portal em document.body,
    // fora do Sheet. Em modo modal o Radix bloqueia ponteiro (pointer-events:none
    // no body) e prende o foco no conteúdo, deixando a lista inutilizável.
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
      {open && (
        // Fundo escurecido (o overlay do Radix só existe em modo modal).
        // Clique fora fecha pelo próprio Radix (onInteractOutside).
        <div aria-hidden className="fixed inset-0 z-50 bg-black/10" />
      )}
      <SheetContent
        className="w-full overflow-y-auto border-slate-200 bg-white text-slate-900 shadow-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        onInteractOutside={(event) => {
          if (isInsideSelectPanel(event.target)) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isInsideSelectPanel(event.target)) event.preventDefault();
        }}
      >
        <SheetHeader className="border-b border-slate-200">
          <SheetTitle className="text-slate-900">
            {editing ? `Editar ${editing.name}` : "Nova variável"}
          </SheetTitle>
          <SheetDescription className="text-slate-500">
            O worker injeta esta variável no ambiente do robô ao executar.
          </SheetDescription>
        </SheetHeader>
        <VariableForm {...props} />
      </SheetContent>
    </Sheet>
  );
}

function VariableForm({
  editing,
  defaultScope,
  defaultScopeId,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const { byScope, loading } = useScopeOptions();

  // Global não é mais oferecido para variáveis novas (só bot, automação e máquina);
  // as globais que já existem continuam editáveis.
  const [scopeType, setScopeType] = useState<EnvScopeType>(
    editing?.scope_type ??
      (defaultScope && defaultScope !== "global" ? defaultScope : "automation"),
  );
  const [scopeId, setScopeId] = useState<number | "">(
    editing
      ? editing.scope_type === "global"
        ? ""
        : editing.scope_id
      : defaultScope && defaultScope !== "global" && defaultScopeId
        ? defaultScopeId
        : "",
  );
  const [name, setName] = useState(editing?.name ?? "");
  const [value, setValue] = useState(
    editing && !editing.is_secret ? (editing.value ?? "") : "",
  );
  const [isSecret, setIsSecret] = useState(editing?.is_secret ?? false);
  const [showValue, setShowValue] = useState(false);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const nameValid = NAME_PATTERN.test(name);
  const keepSecret = Boolean(editing?.is_secret && isSecret);
  const mutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const sendValue = !(keepSecret && value === "");
        return updateEnvVariable(editing.id, {
          name,
          is_secret: isSecret,
          description: description.trim() || null,
          active,
          ...(sendValue ? { value } : {}),
        });
      }
      return createEnvVariable({
        name,
        scope_type: scopeType,
        scope_id: scopeType === "global" ? null : Number(scopeId),
        value,
        is_secret: isSecret,
        description: description.trim() || null,
        active,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Variável atualizada." : "Variável criada.");
      queryClient.invalidateQueries({ queryKey: ["env-variables"] });
      queryClient.invalidateQueries({ queryKey: ["env-variables-effective"] });
      onClose();
    },
    onError: (error) => {
      const message = getApiErrorMessage(
        error,
        "Não foi possível salvar a variável.",
      );
      setFormError(message);
      toast.error(message);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!nameValid) {
      setFormError(
        "Nome inválido: use letras maiúsculas, números e _, sem começar por número.",
      );
      return;
    }
    if (scopeType !== "global" && scopeId === "") {
      setFormError("Selecione o alvo do escopo.");
      return;
    }
    mutation.mutate();
  }

  const options = byScope[scopeType];
  const targetOptions = options.map((o) => ({ value: o.id, label: o.label }));
  // Alvo apagado/fora da lista: mantém exibível ao editar.
  if (
    editing &&
    editing.scope_type !== "global" &&
    !options.some((o) => o.id === editing.scope_id)
  ) {
    targetOptions.push({
      value: editing.scope_id,
      label: editing.scope_label,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 px-4 pb-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Escopo</label>
          <select
            className={`${input} h-10`}
            value={scopeType}
            disabled={Boolean(editing)}
            onChange={(e) => {
              setScopeType(e.target.value as EnvScopeType);
              setScopeId("");
            }}
          >
            {(Object.keys(SCOPE_LABELS) as EnvScopeType[])
              .filter((s) => s !== "global" || editing?.scope_type === "global")
              .map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABELS[s]}
                </option>
              ))}
          </select>
        </div>
        {scopeType !== "global" && (
          <div>
            <label className={label}>Alvo</label>
            <SearchableSelect<number>
              value={scopeId}
              onChange={setScopeId}
              options={targetOptions}
              placeholder="Selecione..."
              disabled={Boolean(editing)}
              loading={loading[scopeType]}
            />
          </div>
        )}
      </div>
      {editing && (
        <p className="-mt-2 text-xs text-slate-500">
          O escopo não pode ser alterado depois de criada.
        </p>
      )}

      <div>
        <label className={label}>Nome</label>
        <input
          className={`${input} h-10 font-mono`}
          value={name}
          onChange={(e) =>
            setName(e.target.value.toUpperCase().replace(/\s/g, "_"))
          }
          placeholder="SAP_URL"
          autoComplete="off"
          spellCheck={false}
        />
        {name && !nameValid && (
          <p className="mt-1 text-xs text-red-600">
            Use apenas letras, números e _, sem começar por número.
          </p>
        )}
      </div>

      <div>
        <label className={label}>Valor</label>
        <div className="flex items-start gap-2">
          {isSecret && !showValue ? (
            <input
              type="password"
              className={`${input} h-10`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                keepSecret ? "Deixe em branco para manter o valor atual" : ""
              }
              autoComplete="new-password"
            />
          ) : (
            <textarea
              rows={isSecret ? 1 : 3}
              className={`${input} py-2 font-mono`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                keepSecret ? "Deixe em branco para manter o valor atual" : ""
              }
            />
          )}
          {isSecret && (
            <button
              type="button"
              onClick={() => setShowValue((v) => !v)}
              title={showValue ? "Ocultar" : "Mostrar"}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            >
              {showValue ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isSecret}
            onChange={(e) => {
              setIsSecret(e.target.checked);
              setShowValue(false);
            }}
          />
          Secreta
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Criptografada; depois de salva não pode ser vista, só substituída.
        </p>
        {editing && !editing.is_secret && isSecret && (
          <p className="mt-1 text-xs text-amber-700">
            Informe o valor para salvá-lo criptografado.
          </p>
        )}
        {editing?.is_secret && !isSecret && (
          <p className="mt-1 text-xs text-amber-700">
            Ao deixar de ser secreta é obrigatório informar o novo valor.
          </p>
        )}
      </div>

      <div>
        <label className={label}>Descrição</label>
        <input
          className={`${input} h-10`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Ativa
      </label>

      {formError && (
        <div
          role="alert"
          className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {formError}
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={mutation.isPending}
          className="h-10 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar
        </button>
      </div>
    </form>
  );
}
