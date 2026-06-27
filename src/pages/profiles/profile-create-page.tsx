import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { createProfile } from "@/services/api/profiles";
import { listPermissions, type PermissionRead } from "@/services/api/permissions";

type FormState = {
  name: string;
  description: string;
  active: boolean;
  permission_ids: number[];
};

export function ProfileCreatePage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    active: true,
    permission_ids: [],
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: listPermissions,
  });

  const permissions = permissionsQuery.data ?? [];

  const groupedPermissions = useMemo(() => {
    const map = new Map<string, PermissionRead[]>();

    permissions.forEach((p) => {
      if (!map.has(p.module)) {
        map.set(p.module, []);
      }
      map.get(p.module)!.push(p);
    });

    return Array.from(map.entries());
  }, [permissions]);

  const createMutation = useMutation({
    mutationFn: createProfile,
    onSuccess: (profile) => {
      navigate(`/profiles/${profile.id}`);
    },
  });

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  function goBack() {
    navigate("/profiles");
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

          <h1 className="text-2xl font-semibold">Criar Perfil</h1>
          <p className="text-sm text-slate-500">
            Defina permissões para controlar acesso ao sistema
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados */}
          <div className="grid gap-4 md:grid-cols-2">
            <input
              placeholder="Nome do perfil"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="h-10 border px-3"
            />

            <select
              value={form.active ? "true" : "false"}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  active: e.target.value === "true",
                }))
              }
              className="h-10 border px-3"
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>

          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, description: e.target.value }))
            }
            className="w-full border p-3"
          />

          {/* Permissões */}
          <div className="space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissões
            </h2>

            {groupedPermissions.map(([module, perms]) => (
              <div key={module} className="border p-4">
                <h3 className="font-medium mb-2">{module}</h3>

                <div className="grid gap-2 md:grid-cols-3">
                  {perms.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={form.permission_ids.includes(perm.id)}
                        onChange={() => togglePermission(perm.id)}
                      />
                      {perm.action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={goBack}
              className="border px-4 h-10"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="bg-black text-white px-4 h-10 flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
