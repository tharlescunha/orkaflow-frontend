import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Save, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, chip, fieldError, hint, input, label, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listPermissions, type PermissionRead } from "@/services/api/permissions";
import { createProfile, type CreateProfilePayload } from "@/services/api/profiles";
import { toast } from "@/store/toast-store";

type FormState = {
  name: string;
  description: string;
  active: boolean;
  permission_ids: number[];
};

type FormErrors = {
  name?: string;
  submit?: string;
};

export function ProfileCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    active: true,
    permission_ids: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
  });

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionRead[]>();
    (permissionsQuery.data ?? []).forEach((permission) => {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissionsQuery.data]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateProfilePayload) => createProfile(payload),
    onSuccess: (profile) => {
      toast.success(`Perfil ${profile.name} criado.`);
      navigate(`/profiles/${profile.id}`);
    },
    onError: (error) => {
      setErrors((prev) => ({
        ...prev,
        submit: getApiErrorMessage(error, "Não foi possível criar o perfil. Verifique os dados e tente de novo."),
      }));
    },
  });

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors({});
  }

  function togglePermission(permissionId: number) {
    setForm((prev) => {
      const exists = prev.permission_ids.includes(permissionId);
      return {
        ...prev,
        permission_ids: exists ? prev.permission_ids.filter((id) => id !== permissionId) : [...prev.permission_ids, permissionId],
      };
    });
  }

  function toggleModule(modulePermissions: PermissionRead[]) {
    const ids = modulePermissions.map((item) => item.id);
    setForm((prev) => {
      const allSelected = ids.every((id) => prev.permission_ids.includes(id));
      return {
        ...prev,
        permission_ids: allSelected
          ? prev.permission_ids.filter((id) => !ids.includes(id))
          : Array.from(new Set([...prev.permission_ids, ...ids])),
      };
    });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.name.trim()) {
      setErrors({ name: "Informe o nome do perfil." });
      return;
    }

    createMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      permission_ids: form.permission_ids,
    });
  }

  const selectedCount = form.permission_ids.length;

  return (
    <section className={card}>
      <PageHeader
        title="Novo perfil"
        description="Dê um nome ao perfil e marque o que quem tiver esse perfil pode fazer no painel."
        backTo="/profiles"
        backLabel="Voltar para perfis"
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5">
        <div className={card}>
          <div className={cardHeader}>
            <h2 className={cardTitle}>Dados do perfil</h2>
          </div>
          <div className={cn(cardBody, "grid gap-5 md:grid-cols-2")}>
            <label className="block">
              <span className={label}>
                Nome <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className={input}
                placeholder="Ex.: Operador de automações"
                autoFocus
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <p className={fieldError}>{errors.name}</p>}
            </label>

            <label className="block">
              <span className={label}>Status</span>
              <select
                value={form.active ? "true" : "false"}
                onChange={(e) => setField("active", e.target.value === "true")}
                className={select}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              <p className={hint}>Perfil inativo não pode ser vinculado a novos usuários.</p>
            </label>

            <label className="block md:col-span-2">
              <span className={label}>Descrição</span>
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                className={cn(textarea, "min-h-[90px]")}
                placeholder="Para que serve este perfil (opcional)"
              />
            </label>
          </div>
        </div>

        <div className={card}>
          <div className={cardHeader}>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-600" />
              <h2 className={cardTitle}>Permissões</h2>
            </div>
            <span className={chip}>{selectedCount === 1 ? "1 selecionada" : `${selectedCount} selecionadas`}</span>
          </div>
          <div className={cardBody}>
            {permissionsQuery.isLoading ? (
              <DetailSkeleton fields={6} />
            ) : permissionsQuery.isError ? (
              <QueryError
                error={permissionsQuery.error}
                what="as permissões"
                onRetry={() => permissionsQuery.refetch()}
                retrying={permissionsQuery.isFetching}
              />
            ) : groupedPermissions.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma permissão cadastrada no sistema.</p>
            ) : (
              <div className="space-y-4">
                {groupedPermissions.map(([module, permissions]) => {
                  const allSelected = permissions.every((permission) => form.permission_ids.includes(permission.id));
                  const someSelected = !allSelected && permissions.some((permission) => form.permission_ids.includes(permission.id));

                  return (
                    <fieldset key={module} className="rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                            }}
                            onChange={() => toggleModule(permissions)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-800">{module}</span>
                          <span className="text-xs text-slate-500">
                            {permissions.length === 1 ? "1 permissão" : `${permissions.length} permissões`}
                          </span>
                        </label>
                        <span className="text-xs text-slate-500">
                          {allSelected ? "Todas marcadas" : someSelected ? "Parte marcada" : "Nenhuma marcada"}
                        </span>
                      </div>

                      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                        {permissions.map((permission) => {
                          const checked = form.permission_ids.includes(permission.id);
                          return (
                            <label
                              key={permission.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition",
                                checked ? "border-blue-200 bg-blue-50/60" : "border-slate-200 bg-white hover:bg-slate-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(permission.id)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="min-w-0">
                                <span className="block font-medium text-slate-800">{permission.action}</span>
                                <span className="block text-xs text-slate-500">
                                  {permission.description || `${module}:${permission.action}`}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {errors.submit && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errors.submit}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={() => navigate("/profiles")} className={btn.secondary} disabled={createMutation.isPending}>
            Cancelar
          </button>
          <button type="submit" disabled={createMutation.isPending} className={btn.primary}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {createMutation.isPending ? "Salvando..." : "Salvar perfil"}
          </button>
        </div>
      </form>
    </section>
  );
}
