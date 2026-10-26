export type RowResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export interface ImportOutcome<T> {
  accepted: { line: number; value: T }[];
  rejected: { line: number; errors: string[] }[];
  /** Valid rows whose key matches an earlier row in the file or a record that already exists. */
  duplicates: { line: number; key: string; of: "file" | "existing"; value: T }[];
}

/**
 * Validates every record and sorts it into accepted, rejected or duplicate. `keyOf` returns a
 * normalized identity, or several (any one matching counts), or "" for none; the first row with a key wins, later ones are duplicates.
 */
export function runImport<T>(
  records: Record<string, string>[],
  lines: number[],
  parse: (record: Record<string, string>) => RowResult<T>,
  keyOf: (value: T) => string | string[],
  existingKeys: ReadonlySet<string> = new Set(),
): ImportOutcome<T> {
  const out: ImportOutcome<T> = { accepted: [], rejected: [], duplicates: [] };
  const seen = new Set<string>();
  records.forEach((record, i) => {
    const line = lines[i];
    const result = parse(record);
    if (!result.ok) { out.rejected.push({ line, errors: result.errors }); return; }
    const raw = keyOf(result.value);
    const keys = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    const inExisting = keys.find((k) => existingKeys.has(k));
    const inFile = keys.find((k) => seen.has(k));
    if (inExisting) out.duplicates.push({ line, key: inExisting, of: "existing", value: result.value });
    else if (inFile) out.duplicates.push({ line, key: inFile, of: "file", value: result.value });
    else { for (const k of keys) seen.add(k); out.accepted.push({ line, value: result.value }); }
  });
  return out;
}
