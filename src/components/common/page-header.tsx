import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  // Volta para a lista ("/automations"). Rende um link discreto acima do título.
  backTo?: string;
  backLabel?: string;
  // Botões da direita (Novo, Atualizar, ações do registro).
  actions?: ReactNode;
  // Linha extra abaixo do título (badges de status, chips).
  meta?: ReactNode;
};

// Cabeçalho padrão de todas as telas: mesmo tamanho de título, mesma posição dos botões.
export function PageHeader({ title, description, backTo, backLabel = "Voltar", actions, meta }: PageHeaderProps) {
  return (
    <div className="border-b border-slate-200 px-5 py-5 md:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {backTo && (
            <Link to={backTo} className="mb-3 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-slate-600 transition hover:text-blue-700">
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
