export type BotListItem = {
  id: number;
  name: string;
  description?: string | null;
  repository_id: number;
  repository_name?: string | null;
  execution_mode: string;
  current_version?: string | null;
  release_version?: string | null;
  active: boolean;
  auto_update: boolean;
  reads_task_file_arg?: boolean;
  created_at: string;
};

export type BotListResponse = {
  items: BotListItem[];
  total: number;
};

export type BotRead = {
  id: number;
  name: string;
  description?: string | null;
  technology: string;
  repository_id: number;
  repository_name?: string | null;
  source_type: string;
  execution_mode: string;
  source_url?: string | null;
  entrypoint: string;
  requirements_file?: string | null;
  timeout_default: number;
  active: boolean;
  auto_update: boolean;
  /** Robô antigo lê o caminho do JSON da task em sys.argv[1]; com maestro não precisa. */
  reads_task_file_arg?: boolean;
  current_version?: string | null;
  release_version?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type BotCreatePayload = {
  name: string;
  description?: string | null;
  initial_version: string;
  technology: string;
  repository_id: number;
  source_type: string;
  execution_mode: string;
  source_url?: string | null;
  entrypoint: string;
  requirements_file?: string | null;
  timeout_default: number;
  active: boolean;
  auto_update?: boolean;
  reads_task_file_arg?: boolean;
};

export type BotUpdatePayload = {
  name?: string;
  description?: string | null;
  technology?: string;
  repository_id?: number;
  source_type?: string;
  execution_mode?: string;
  source_url?: string | null;
  entrypoint?: string;
  requirements_file?: string | null;
  timeout_default?: number;
  release_version?: string;
  active?: boolean;
  auto_update?: boolean;
  reads_task_file_arg?: boolean;
};

export type BotFilters = {
  skip?: number;
  limit?: number;
  search?: string;
  repository_id?: number;
  active?: boolean;
};

export type RepositoryOption = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

export type CreateBotPayload = BotCreatePayload;
export type UpdateBotPayload = BotUpdatePayload;

/** Resposta de POST /bots/inspect-source: o que o Git sabe sobre o link, antes de salvar. */
export type BotSourceInspection = {
  name: string;
  description: string | null;
  branch: string;
  repository: string;
  head: { hash: string; short: string; author: string; committed_at: string; message: string };
  latest_tag: string | null;
  suggested_version: string;
};
