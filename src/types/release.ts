/** Uma atualização do sistema, como o backend lê do ATUALIZACOES.md. */
export type ReleaseType = "geral" | "melhoria" | "correcao";

export type ReleaseCommit = { repo: string; hash: string };

export type ReleaseFile = {
  // A novo | M alterado | D removido | R renomeado
  status: string;
  repo: string;
  path: string;
};

export type ReleaseItem = {
  version: string;
  type: ReleaseType;
  type_label: string;
  // ISO com fuso de Brasília, ex.: 2026-11-17T14:20:00-03:00
  released_at: string;
  title: string;
  requester?: string | null;
  commits: ReleaseCommit[];
  problem: string;
  solution: string;
  files: ReleaseFile[];
};

export type ReleaseNotes = {
  total: number;
  current_version: string | null;
  last_release_at: string | null;
  counts: Record<ReleaseType, number>;
  items: ReleaseItem[];
};

/** Só a versão atual (rota pública, usada no selo do login). */
export type ReleaseVersion = {
  version: string | null;
  released_at: string | null;
};
