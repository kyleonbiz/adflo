export interface TargetField {
  key: string;
  label: string;
  /** Other header names that mean the same thing, e.g. "E-mail" for email. */
  aliases?: string[];
  required?: boolean;
}

/** Target field key -> index of the source column, or null when the field is not mapped. */
export type Mapping = Record<string, number | null>;

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Suggests which column feeds each target field. Exact matches on the key, label or an alias win;
 * a second pass accepts headers that contain a longer alias ("Primary Email Address" for "email").
 * A column is never used for two fields.
 */
export function suggestMapping(headers: string[], targets: TargetField[]): Mapping {
  const norm = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: Mapping = Object.fromEntries(targets.map((t) => [t.key, null]));
  const names = (t: TargetField) => [t.key, t.label, ...(t.aliases ?? [])].map(normalizeHeader).filter(Boolean);

  for (const t of targets) {
    const i = norm.findIndex((h, idx) => !used.has(idx) && names(t).includes(h));
    if (i >= 0) { mapping[t.key] = i; used.add(i); }
  }
  for (const t of targets) {
    if (mapping[t.key] !== null) continue;
    const i = norm.findIndex((h, idx) => !used.has(idx) && h !== "" && names(t).some((n) => n.length >= 4 && h.includes(n)));
    if (i >= 0) { mapping[t.key] = i; used.add(i); }
  }
  return mapping;
}

export function missingRequired(mapping: Mapping, targets: TargetField[]): TargetField[] {
  return targets.filter((t) => t.required && mapping[t.key] === null);
}

/** Turns spreadsheet rows into records keyed by target field. Unmapped fields become "". */
export function mapRows(rows: string[][], mapping: Mapping): Record<string, string>[] {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(mapping).map(([key, col]) => [key, col === null ? "" : (row[col] ?? "")])),
  );
}
