export type HeaderRow = { id: number; key: string; value: string };


let rowSeq = 1;

export function newHeaderRow(key = "", value = ""): HeaderRow {
  return { id: rowSeq++, key, value };
}

export function headersToRows(headers: Record<string, string> | null | undefined) {
  return Object.entries(headers ?? {}).map(([k, v]) => newHeaderRow(k, String(v)));
}

/** Converte linhas em objeto; ignora linhas totalmente vazias. */
export function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key && !row.value) continue;
    out[key] = row.value;
  }
  return out;
}

export function validateHeaderRows(rows: HeaderRow[]): string | null {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.key.trim() && !row.value) continue;
    if (!row.key.trim()) return "Há um cabeçalho com valor e sem nome.";
    const lower = row.key.trim().toLowerCase();
    if (seen.has(lower)) return `Cabeçalho duplicado: ${row.key.trim()}.`;
    seen.add(lower);
  }
  return null;
}
