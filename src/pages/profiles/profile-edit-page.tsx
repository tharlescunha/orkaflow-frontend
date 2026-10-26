import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Shield } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/query-error";
import { DetailSkeleton } from "@/components/common/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import { btn, card, cardBody, cardHeader, cardTitle, chip, fieldError, hint, input, label, select, textarea } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { listPermissions, type PermissionRead } from "@/services/api/permissions";
import { getProfileById, updateProfile, type ProfileRead, type UpdateProfilePayload } from "@/services/api/profiles";
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

export function ProfileEditPage() {
  const navigate = useNavigate();
  const params = useParams<{ profileId: string }>();
  const profileId = Number(params.profileId);
  const validId = Number.isFinite(profileId) && profileId > 0;

  const profileQuery = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfileById(profileId),
    enabled: validId,
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
  });

  const backTo = validId ? `/profiles/${profileId}` : "/profiles";

  if (!validId) {
    return (
      <section className={card}>
        <PageHeader title="Editar perfil" backTo="/profiles" backLabel="Voltar para perfis" />
        <div className="p-5">
          <QueryError error={new Error("ID de perfil inválido.")} what="o perfil" />
        </div>
      </section>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <section className={card}>
        <PageHeader title="Editar perfil" backTo={backTo} />
        <div className="p-5">
          <DetailSkeleton fields={4} />
        </div>
      </section>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <section className={card}>
        <PageHeader title="Editar perfil" backTo={backTo} />
        <div className="p-5">
          <QueryError error={profileQuery.error} what="o perfil" onRetry={() => profileQuery.refetch()} retrying={profileQuery.isFetching} />
        </div>
      </section>
    );
  }

  // O formulário só é montado quando o perfil chegou: o estado inicial vem direto dos dados,
  // sem efeito re-hidratando (que sobrescrevia o que a pessoa já tinha digitado).
  return (
    <ProfileEditForm
      key={profileQuery.data.id}
      initial={profileQuery.data}
      permissions={permissionsQuery.data ?? []}
      permissionsLoading={permissionsQuery.isLoading}
      permissionsError={permissionsQuery.isError ? permissionsQuery.error : null}
      onRetryPermissions={() => permissionsQuery.refetch()}
      onCancel={() => navigate(backTo)}
    />
  );
}

function ProfileEditForm({
  initial,
  permissions,
  permissionsLoading,
  permissionsError,
  onRetryPermissions,
  onCancel,
}: {
  initial: ProfileRead;
  permissions: PermissionRead[];
  permissionsLoading: boolean;
  permissionsError: unknown;
  onRetryPermissions: () => void;
  onCancel: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileId = initial.id;

  const [form, setForm] = useState<FormState>({
    name: initial.name ?? "",
    description: initial.description ?? "",
    active: Boolean(initial.active),
    permission_ids: (initial.permissions ?? []).map((item) => item.id),
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionRead[]>();
    permissions.forEach((permission) => {
      const list = map.get(permission.module) ?? [];
      list.push(permission);
      map.set(permission.module, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateProfilePayload) => updateProfile(profileId, payload),
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      toast.success("Perfil atualizado. Vale para todos os usuários vinculados.");
      navigate(`/profiles/${profile.id}`);
    },
    onError: (error) => {
      setErrors((prev) => ({
        ...prev,
        submit: getApiErrorMessage(error, "Não foi possível atualizar o perfil. Verifique os dados e tente de novo."),
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

    const payload: UpdateProfilePayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      permission_ids: form.permission_ids,
    };

    updateMutation.mutate(payload);
  }

  const selectedCount = form.permission_ids.length;

  return (
    <section className={card}>
      <PageHeader
        title={`Editar ${initial.name}`}
        description="Alterações valem na hora para todos os usuários com este perfil."
        backTo={`/profiles/${profileId}`}
        backLabel="Voltar para o perfil"
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
            {permissionsLoading ? (
              <DetailSkeleton fields={6} />
            ) : permissionsError ? (
              <QueryError error={permissionsError} what="as permissões" onRetry={onRetryPermissions} />
            ) : groupedPermissions.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma permissão cadastrada no sistema.</p>
            ) : (
              <div className="space-y-4">
                {groupedPermissions.map(([module, modulePermissions]) => {
                  const allSelected = modulePermissions.every((permission) => form.permission_ids.includes(permission.id));
                  const someSelected =
                    !allSelected && modulePermissions.some((permission) => form.permission_ids.includes(permission.id));

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
                            onChange={() => toggleModule(modulePermissions)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="font-semibold text-slate-800">{module}</span>
                          <span className="text-xs text-slate-500">
                            {modulePermissions.length === 1 ? "1 permissão" : `${modulePermissions.length} permissões`}
                          </span>
                        </label>
                        <span className="text-xs text-slate-500">
                          {allSelected ? "Todas marcadas" : someSelected ? "Parte marcada" : "Nenhuma marcada"}
                        </span>
                      </div>

                      <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
                        {modulePermissions.map((permission) => {
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
          <button type="button" onClick={onCancel} className={btn.secondary} disabled={updateMutation.isPending}>
            Cancelar
          </button>
          <button type="submit" disabled={updateMutation.isPending} className={btn.primary}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </section>
  );
}
