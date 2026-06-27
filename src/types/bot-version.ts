export type BotVersion = {
  id: number;
  bot_id: number;
  bot_name?: string;
  bot_source_url?: string;
  bot_active?: boolean;

  version: string;
  storage_type: string;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;

  is_active: boolean;
  created_by?: number | null;

  created_at: string;
  updated_at?: string | null;
};

export type CreateBotVersionPayload = {
  bot_id: number;
  version: string;
  storage_type: string;
  artifact_path?: string | null;
  changelog?: string | null;
  checksum?: string | null;
  created_by?: number | null;
  is_active: boolean;
};
