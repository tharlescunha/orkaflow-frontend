import type { CreateTaskPayload, TaskRead } from "@/services/api/tasks";

type RunnableAutomation = {
  id: number;
  default_priority?: number | null;
  default_parameters_json?: Record<string, unknown> | null;
  default_runtime_parameters_json?: Record<string, unknown> | null;
};

function hasKeys(value?: Record<string, unknown> | null) {
  return Boolean(value && Object.keys(value).length > 0);
}

// "Executar agora": task manual com os parâmetros padrão da automação (mesma regra do MCP criar_task).
export function runNowPayload(automation: RunnableAutomation): CreateTaskPayload {
  const parameters: NonNullable<CreateTaskPayload["parameters"]> = [];
  if (hasKeys(automation.default_parameters_json)) {
    parameters.push({ parameter_name: "parameters_json", parameter_value: JSON.stringify(automation.default_parameters_json) });
  }
  if (hasKeys(automation.default_runtime_parameters_json)) {
    parameters.push({
      parameter_name: "runtime_parameters_json",
      parameter_value: JSON.stringify(automation.default_runtime_parameters_json),
    });
  }
  return { automation_id: automation.id, priority: automation.default_priority ?? 5, execution_mode: "manual", parameters };
}

// "Rodar de novo": nova task com os mesmos parâmetros da original, ligada a ela por parent_task_id.
export function rerunPayload(task: TaskRead): CreateTaskPayload {
  return {
    automation_id: task.automation_id,
    priority: task.priority,
    execution_mode: "reprocess",
    parent_task_id: task.id,
    parameters: (task.parameters ?? []).map((p) => ({
      parameter_name: p.parameter_name,
      parameter_value: p.parameter_value ?? null,
      is_secret: p.is_secret ?? false,
      resolved_from_credential_item_id: p.resolved_from_credential_item_id ?? null,
    })),
  };
}
