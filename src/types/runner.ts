export type RunnerConfig = {
  id: number;
  runner_id: number;
  max_concurrency: number;
  allowed_parallel_bots?: Record<string, unknown> | unknown[] | null;
  polling_interval: number;
  auto_update_bots: boolean;
  install_all_bots_on_register: boolean;
  maintenance_mode: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type Runner = {
  id: number;
  uuid: string;
  name: string;
  label?: string | null;
  host_name?: string | null;
  ip?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  cpu_arch?: string | null;
  memory_total?: number | null;
  access_remote: boolean;
  enabled: boolean;
  status: string;
  last_heartbeat?: string | null;
  created_at: string;
  updated_at?: string | null;
  config?: RunnerConfig | null;

  linked_tasks_count?: number;
  running_tasks_count?: number;
};
