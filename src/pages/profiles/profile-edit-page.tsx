import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Shield } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getProfileById,
  updateProfile,
  type UpdateProfilePayload,
} from "@/services/api/profiles";
import {
  listPermissions,
  type PermissionRead,
} from "@/services/api/permissions";

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

const INITIAL_FORM: FormState = {
  name: "",
  description: "",
  active: true,
  permission_ids: [],
};

export function ProfileEditPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams<{ profileId: string }>();
  const profileId = Number(params.profileId);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [initialized, setInitialized] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => getProfileById(profileId),
    enabled: Number.isFinite(profileId) && profileId > 0,
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
  });

  useEffect(() => {
    if (!profileQuery.data || initialized) return;

    setForm({
      name: profileQuery.data.name ?? "",
      description: profileQuery.data.description ?? "",
      active: !!profileQuery.data.active,
      permission_ids: (profileQuery.data.permissions ?? []).map((item) => item.id),
    });

    setInitialized(true);
  }, [profileQuery.data, initialized]);

  const groupedPermissions = useMemo(() => {
    const permissions = permissionsQuery.data ?? [];
    const map = new Map<string, PermissionRead[]>();

    permissions.forEach((permission) => {
      if (!map.has(permission.module)) {
        map.set(permission.module, []);
      }
      map.get(permission.module)!.push(permission);
    });

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissionsQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateProfilePayload) =>
      updateProfile(profileId, payload),
    onSuccess: async (profile) => {
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", profileId] });
      navigate(`/profiles/${profile.id}`);
    },
    onError: (error: any) => {
      const detail =
        error?.response?.data?.detail ??
        "Não foi possível atualizar o perfil.";

      setErrors((prev) => ({
        ...prev,
        submit: String(detail),
      }));
    },
  });

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, submit: undefined }));
  }

  function togglePermission(permissionId: number) {
    setForm((prev) => {
      const exists = prev.permission_ids.includes(permissionId);

      return {
        ...prev,
        permission_ids: exists
          ? prev.permission_ids.filter((id) => id !== permissionId)
          : [...prev.permission_ids, permissionId],
      };
    });
  }

  function toggleModule(modulePermissions: PermissionRead[]) {
    const ids = modulePermissions.map((item) => item.id);
    const allSelected = ids.every((id) => form.permission_ids.includes(id));

    setForm((prev) => ({
      ...prev,
      permission_ids: allSelected
        ? prev.permission_ids.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev.permission_ids, ...ids])),
    }));
  }

  function validateForm() {
    const nextErrors: FormErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Informe o nome do perfil.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validateForm()) return;

    const payload: UpdateProfilePayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      active: form.active,
      permission_ids: form.permission_ids,
    };

    updateMutation.mutate(payload);
  }

  function goBack() {
    if (profileId) {
      navigate(`/profiles/${profileId}`);
      return;
    }
    navigate("/profiles");
  }

  if (!Number.isFinite(profileId) || profileId <= 0) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        ID de perfil inválido.
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-sm">
        Carregando perfil...
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Não foi possível carregar os dados do perfil.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <button
            onClick={goBack}
            className="mb-3 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <h1 className="text-2xl font-semibold text-slate-950">
            Editar Perfil
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Atualize os dados do perfil e suas permissões.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-5 p-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-5">
            <div className="border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Dados do perfil
                </h2>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <label className="block space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Nome <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                    className={inputClassName(errors.name)}
                    placeholder="Nome do perfil"
                  />
                  {errors.name ? (
                    <span className="text-xs text-red-600">{errors.name}</span>
                  ) : null}
                </label>

                <label className="block space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">
                    Descrição
                  </span>
                  <textarea
                    value={form.description}
                    onChange={(e) => setField("description", e.target.value)}
                    className="min-h-[110px] w-full border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900"
                    placeholder="Descrição do perfil"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    value={form.active ? "true" : "false"}
                    onChange={(e) => setField("active", e.target.value === "true")}
                    className={inputClassName()}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </label>

                <div className="flex items-end">
                  <div className="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    {form.permission_ids.length} permissões selecionadas
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-700" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    Permissões
                  </h2>
                </div>
              </div>

              <div className="space-y-4 p-4">
                {permissionsQuery.isLoading ? (
                  <div className="text-sm text-slate-500">
                    Carregando permissões...
                  </div>
                ) : permissionsQuery.isError ? (
                  <div className="text-sm text-red-600">
                    Não foi possível carregar as permissões.
                  </div>
                ) : groupedPermissions.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    Nenhuma permissão encontrada.
                  </div>
                ) : (
                  groupedPermissions.map(([module, permissions]) => {
                    const allSelected = permissions.every((permission) =>
                      form.permission_ids.includes(permission.id)
                    );

                    return (
                      <div key={module} className="border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-800">
                              {module}
                            </h3>
                            <p className="text-xs text-slate-500">
                              {permissions.length} permissões neste módulo
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleModule(permissions)}
                            className="border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            {allSelected ? "Desmarcar módulo" : "Marcar módulo"}
                          </button>
                        </div>

                        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                          {permissions.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex items-start gap-3 border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={form.permission_ids.includes(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="mt-0.5 h-4 w-4 border-slate-300"
                              />
                              <div>
                                <div className="font-medium text-slate-800">
                                  {permission.action}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {permission.description || `${module}:${permission.action}`}
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {errors.submit ? (
              <div className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errors.submit}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-10 items-center gap-2 border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Resumo
                </h2>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {form.name.trim() || "Perfil sem nome"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {form.description.trim() || "Sem descrição informada"}
                  </p>
                </div>

                <div className="grid gap-3 text-sm">
                  <SummaryItem
                    label="Status"
                    value={form.active ? "Ativo" : "Inativo"}
                  />
                  <SummaryItem
                    label="Permissões"
                    value={String(form.permission_ids.length)}
                  />
                </div>
              </div>
            </div>

            <div className="border border-amber-200 bg-amber-50">
              <div className="border-b border-amber-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-700" />
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
                    Atenção
                  </h2>
                </div>
              </div>

              <div className="space-y-3 px-4 py-4 text-sm text-amber-900">
                <p>
                  Alterar um perfil impacta todos os usuários vinculados a ele.
                </p>
                <p>
                  Se o perfil for marcado como <strong>inativo</strong>, ele
                  deixa de ser utilizável normalmente no sistema.
                </p>
                <p>
                  Revise as permissões com cuidado antes de salvar.
                </p>
              </div>
            </div>
          </aside>
        </form>
      </section>
    </div>
  );
}

function inputClassName(hasError?: string) {
  return [
    "h-10 w-full border bg-white px-3 text-sm text-slate-900 outline-none transition",
    hasError
      ? "border-red-300 focus:border-red-500"
      : "border-slate-300 focus:border-slate-900",
  ].join(" ");
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
