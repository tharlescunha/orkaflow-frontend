import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { withApiDetail } from "@/lib/api-error";
import { unblockCredential } from "@/services/api/credentials";
import { toast } from "@/store/toast-store";

export type UnblockTarget = { id: number; label: string; schedulesPaused?: number };

/**
 * Desbloqueio manual de credencial (usado na lista de bloqueadas e no detalhe da credencial).
 * Devolve `request(alvo)` para abrir a confirmação e `dialog` para renderizar na tela.
 */
export function useUnblockCredential() {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<UnblockTarget | null>(null);

  const mutation = useMutation({
    mutationFn: (credentialId: number) => unblockCredential(credentialId),
    onSuccess: async (result) => {
      const reactivated = result.schedules_reactivated;
      toast.success(
        reactivated > 0
          ? `Credencial desbloqueada. ${reactivated} agendamento${reactivated === 1 ? "" : "s"} reativado${reactivated === 1 ? "" : "s"}.`
          : "Credencial desbloqueada."
      );
      setTarget(null);
      await Promise.all(
        ["credentials", "credentials-blocked", "credential-detail", "automation-health", "automation-detail", "schedules"].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] })
        )
      );
    },
    onError: (error) => {
      toast.error(withApiDetail("Não foi possível desbloquear a credencial.", error));
    },
  });

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title="Desbloquear credencial"
      description={
        target
          ? `A credencial "${target.label}" volta para "não verificada"` +
            (target.schedulesPaused ? ` e ${target.schedulesPaused} agendamento${target.schedulesPaused === 1 ? "" : "s"} pausado${target.schedulesPaused === 1 ? "" : "s"} por ela reativa${target.schedulesPaused === 1 ? "" : "m"}` : "") +
            ".\n\nConfirme que a senha já foi corrigida no sistema de destino (SAP) e no cofre onde ela é guardada. Se ainda estiver errada, o robô tenta de novo e pode bloquear o usuário outra vez."
          : undefined
      }
      confirmLabel="Desbloquear"
      tone="warning"
      isPending={mutation.isPending}
      onConfirm={() => target && mutation.mutate(target.id)}
      onCancel={() => {
        if (!mutation.isPending) setTarget(null);
      }}
    />
  );

  return { request: setTarget, dialog, isPending: mutation.isPending };
}
