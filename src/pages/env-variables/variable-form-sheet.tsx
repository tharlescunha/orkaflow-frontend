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
import { btn, fieldError, hint, input, label as labelClass, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
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
        <div aria-hidden className="fixed inset-0 z-50 bg-slate-950/40" />
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
          <SheetTitle className="text-slate-950">
            {editing ? (
              <>
                Editar <span className="font-mono">{editing.name}</span>
              </>
            ) : (
              "Nova variável"
            )}
          </SheetTitle>
          <SheetDescription className="text-slate-500">
            O worker injeta esta variável no ambiente do robô ao executar.
          </SheetDescription>
        </SheetHeader>
        {/* key: cada abertura/registro monta o formulário do zero com os dados certos. */}
        {open && <VariableForm key={editing?.id ?? "new"} {...props} />}
      </SheetContent>
    </Sheet>
  );
}

function VariableForm({ editing, defaultScope, defaultScopeId, onClose }: Props) {
  const queryClient = useQueryClient();
  const { byScope, loading } = useScopeOptions();

  // Global não é mais oferecido para variáveis novas (só bot, automação e máquina);
  // as globais que já existem continuam editáveis.
  const [scopeType, setScopeType] = useState<EnvScopeType>(
    editing?.scope_type ?? (defaultScope && defaultScope !== "global" ? defaultScope : "automation")
  );
  const [scopeId, setScopeId] = useState<number | "">(
    editing
      ? editing.scope_type === "global"
        ? ""
        : editing.scope_id
      : defaultScope && defaultScope !== "global" && defaultScopeId
        ? defaultScopeId
        : ""
  );
  const [name, setName] = useState(editing?.name ?? "");
  // Valor secreto gravado nunca vem do servidor: o campo começa vazio (vazio = manter).
  const [value, setValue] = useState(editing && !editing.is_secret ? (editing.value ?? "") : "");
  const [isSecret, setIsSecret] = useState(editing?.is_secret ?? false);
  const [showValue, setShowValue] = useState(false);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [submitted, setSubmitted] = useState(false);

  const nameValid = NAME_PATTERN.test(name);
  const keepSecret = Boolean(editing?.is_secret && isSecret);
  // Deixou de ser secreta ou virou secreta: o valor precisa ser informado.
  const valueRequired = Boolean(editing && editing.is_secret !== isSecret);

  const errors = {
    name: !name ? "Informe o nome." : !nameValid ? "Use letras maiúsculas, números e _, sem começar por número." : null,
    scope: scopeType !== "global" && scopeId === "" ? "Selecione o alvo do escopo." : null,
    value: valueRequired && value === "" ? "Informe o valor para salvar com a nova configuração." : null,
  };
  const formValid = !errors.name && !errors.scope && !errors.value;

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
      toast.error(getApiErrorMessage(error, "Não foi possível salvar a variável."));
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!formValid) return;
    mutation.mutate();
  }

  const options = byScope[scopeType];
  const targetOptions = options.map((o) => ({ value: o.id, label: o.label }));
  // Alvo apagado/fora da lista: mantém exibível ao editar.
  if (editing && editing.scope_type !== "global" && !options.some((o) => o.id === editing.scope_id)) {
    targetOptions.push({ value: editing.scope_id, label: editing.scope_label });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-4 pb-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Escopo</label>
          <select
            className={select}
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
            <label className={labelClass}>Alvo</label>
            <SearchableSelect<number>
              value={scopeId}
              onChange={setScopeId}
              options={targetOptions}
              placeholder="Selecione..."
              disabled={Boolean(editing)}
              loading={loading[scopeType]}
            />
            {submitted && errors.scope ? <p className={fieldError}>{errors.scope}</p> : null}
          </div>
        )}
      </div>
      {editing && <p className={cn(hint, "-mt-2")}>O escopo não pode ser alterado depois de criada.</p>}

      <div>
        <label className={labelClass}>Nome</label>
        <input
          className={cn(input, "font-mono")}
          value={name}
          onChange={(e) => setName(e.target.value.toUpperCase().replace(/\s/g, "_"))}
          placeholder="SAP_URL"
          autoComplete="off"
          spellCheck={false}
          autoFocus={!editing}
        />
        {(submitted || name) && errors.name ? (
          <p className={fieldError}>{errors.name}</p>
        ) : (
          <p className={hint}>Como o robô vai ler: os.environ['{name || "NOME"}'].</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Valor</label>
        <div className="flex items-start gap-2">
          {isSecret && !showValue ? (
            <input
              type="password"
              className={input}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={keepSecret ? "Deixe em branco para manter o valor atual" : ""}
              autoComplete="new-password"
            />
          ) : (
            <textarea
              rows={isSecret ? 1 : 3}
              className={cn(textarea, "min-h-[80px] font-mono")}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={keepSecret ? "Deixe em branco para manter o valor atual" : ""}
            />
          )}
          {isSecret && (
            <button
              type="button"
              onClick={() => setShowValue((v) => !v)}
              title={showValue ? "Ocultar o que está digitando" : "Mostrar o que está digitando"}
              aria-label={showValue ? "Ocultar valor" : "Mostrar valor"}
              className={cn(btn.icon, "h-10 w-10")}
            >
              {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}
        </div>
        {submitted && errors.value ? (
          <p className={fieldError}>{errors.value}</p>
        ) : keepSecret ? (
          <p className={hint}>O valor gravado não pode ser visto, só substituído.</p>
        ) : null}
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={isSecret}
            onChange={(e) => {
              setIsSecret(e.target.checked);
              setShowValue(false);
            }}
          />
          Secreta
        </label>
        <p className={hint}>Criptografada; depois de salva não pode ser vista, só substituída.</p>
        {editing && !editing.is_secret && isSecret && (
          <p className="mt-1 text-xs text-amber-700">Informe o valor para salvá-lo criptografado.</p>
        )}
        {editing?.is_secret && !isSecret && (
          <p className="mt-1 text-xs text-amber-700">Ao deixar de ser secreta é obrigatório informar o novo valor.</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Descrição</label>
        <input
          className={input}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Ativa
      </label>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} disabled={mutation.isPending} className={btn.secondary}>
          Cancelar
        </button>
        <button type="submit" disabled={mutation.isPending || (submitted && !formValid)} className={btn.primary}>
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
