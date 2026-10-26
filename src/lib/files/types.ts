/** One file in the folder being cleaned. `path` is relative to that folder, with `/` separators. */
export interface FileEntry {
  path: string;
  /** Bytes; 0 when unknown (a pasted list without sizes). */
  size: number;
  /** `YYYY-MM-DD`, or null when unknown. */
  modified: string | null;
  /** SHA-256 of the contents when the file was read in the browser. */
  hash?: string;
}

export type ChangeKind = "rename" | "duplicate" | "misplaced" | "reorganize";

export interface Change {
  from: string;
  to: string;
  reasons: { kind: ChangeKind; detail: string }[];
}

export interface PlanOptions {
  rename: boolean;
  duplicates: boolean;
  misplaced: boolean;
  /** Move every file into the suggested folders, not only duplicates and misplaced ones. */
  reorganize: boolean;
}

export interface SkippedFile { path: string; reason: string }
