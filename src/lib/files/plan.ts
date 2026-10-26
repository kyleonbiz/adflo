import { stripCopyMarker, standardizeName } from "./naming";
import { DUPLICATES_FOLDER, FOLDER_FOR, LABEL_FOR, misplacedCategory, suggestedFolder } from "./classify";
import { joinPath, normalizePath, splitName, splitPath } from "./paths";
import type { Change, FileEntry, PlanOptions, SkippedFile } from "./types";

export interface DuplicateGroup {
  kind: "identical" | "likely";
  keep: string;
  others: string[];
}

const depth = (p: string) => p.split("/").length;
const lower = (s: string) => s.toLowerCase();

function copyInfo(path: string) {
  const { dir, name } = splitPath(path);
  const { base, ext } = splitName(name);
  const stripped = stripCopyMarker(base);
  return { dir, ext: lower(ext), plainBase: lower(stripped.base), isCopy: stripped.isCopy };
}

/** Which of several duplicates to keep: not a copy, then the oldest, then the shallowest, then by name. */
function pickKeeper(files: FileEntry[]): FileEntry {
  return [...files].sort(
    (a, b) =>
      Number(copyInfo(a.path).isCopy) - Number(copyInfo(b.path).isCopy) ||
      (a.modified ?? "9999").localeCompare(b.modified ?? "9999") ||
      depth(a.path) - depth(b.path) ||
      a.path.localeCompare(b.path),
  )[0];
}

/**
 * Finds files that are the same: identical contents when they were hashed, otherwise the same size and
 * name apart from a copy marker ("(1)", "- Copy"). Without sizes only a copy marker next to its original
 * in one folder counts. Different contents are never duplicates, whatever the names say.
 */
export function findDuplicateGroups(files: FileEntry[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();
  const add = (members: FileEntry[], kind: DuplicateGroup["kind"]) => {
    if (members.length < 2) return;
    const keep = pickKeeper(members);
    groups.push({ kind, keep: keep.path, others: members.filter((m) => m !== keep).map((m) => m.path).sort() });
    members.forEach((m) => used.add(m.path));
  };

  const byHash = new Map<string, FileEntry[]>();
  for (const f of files) if (f.hash && f.size > 0) byHash.set(f.hash, [...(byHash.get(f.hash) ?? []), f]);
  for (const members of byHash.values()) add(members, "identical");

  const loose = new Map<string, FileEntry[]>();
  for (const f of files) {
    if (used.has(f.path) || f.hash) continue; // hashed files with different contents are not duplicates
    const c = copyInfo(f.path);
    const key = f.size > 0 ? `s|${f.size}|${c.plainBase}|${c.ext}` : `n|${c.dir}|${c.plainBase}|${c.ext}`;
    loose.set(key, [...(loose.get(key) ?? []), f]);
  }
  for (const [key, members] of loose) {
    if (key.startsWith("n|") && !members.some((m) => copyInfo(m.path).isCopy)) continue; // no size and no copy marker: not enough
    add(members, "likely");
  }
  return groups.sort((a, b) => a.keep.localeCompare(b.keep));
}

export interface Plan {
  changes: Change[];
  skipped: SkippedFile[];
  duplicateGroups: DuplicateGroup[];
  /** Bytes freed if every duplicate were later removed (known sizes only). */
  duplicateBytes: number;
}

/**
 * Works out, for every file, where it should end up and why. Nothing is deleted: duplicates move into a
 * review folder that mirrors their old location. Two files never get the same destination, and no
 * destination equals any other file's current path, so the order the moves run in does not matter.
 */
export function buildPlan(input: FileEntry[], options: PlanOptions): Plan {
  const skipped: SkippedFile[] = [];
  const files: FileEntry[] = [];
  for (const f of input) {
    const path = normalizePath(f.path);
    if (path) files.push({ ...f, path });
    else skipped.push({ path: f.path.replace(/[\u0000-\u001f\u007f]/g, "?").slice(0, 80), reason: "Unusual characters in the path" });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));

  const duplicateGroups = options.duplicates ? findDuplicateGroups(files) : [];
  const duplicateOf = new Map<string, { keep: string; kind: DuplicateGroup["kind"] }>();
  for (const g of duplicateGroups) for (const o of g.others) duplicateOf.set(o, { keep: g.keep, kind: g.kind });

  const wanted = files.map((f) => {
    const { dir, name } = splitPath(f.path);
    const reasons: Change["reasons"] = [];
    let newName = name;
    if (options.rename) {
      newName = standardizeName(name);
      if (newName !== name) reasons.push({ kind: "rename", detail: `${name} → ${newName}` });
    }
    let newDir = dir;
    const dup = duplicateOf.get(f.path);
    const misplaced = options.misplaced ? misplacedCategory(f.path) : null;
    if (dup) {
      newDir = joinPath(DUPLICATES_FOLDER, dir);
      reasons.push({ kind: "duplicate", detail: `${dup.kind === "identical" ? "Identical to" : "Looks like a copy of"} ${dup.keep}` });
    } else if (options.reorganize) {
      const target = suggestedFolder(f.path);
      if (dir !== target) {
        newDir = target;
        reasons.push({ kind: "reorganize", detail: `Suggested folder: ${target}` });
      }
    } else if (misplaced) {
      newDir = FOLDER_FOR[misplaced];
      reasons.push({ kind: "misplaced", detail: `Looks like a ${LABEL_FOR[misplaced]}, but is in "${dir}"` });
    }
    return { file: f, newDir, newName, reasons };
  });

  // Destinations must be unique and must never land on another file's current path.
  const taken = new Set(files.map((f) => lower(f.path)));
  const changes: Change[] = [];
  for (const w of wanted) {
    if (w.reasons.length === 0) continue;
    const { base, ext } = splitName(w.newName);
    let to = joinPath(w.newDir, w.newName);
    for (let n = 2; taken.has(lower(to)) && lower(to) !== lower(w.file.path); n++) {
      to = joinPath(w.newDir, `${base} (${n})${ext ? `.${ext}` : ""}`);
    }
    if (to === w.file.path) continue;
    taken.add(lower(to));
    changes.push({ from: w.file.path, to, reasons: w.reasons });
  }

  const duplicateBytes = duplicateGroups.reduce((sum, g) => sum + g.others.reduce((s, p) => s + (files.find((f) => f.path === p)?.size ?? 0), 0), 0);
  return { changes, skipped, duplicateGroups, duplicateBytes };
}

/** How many files end up in each top-level folder if the given changes are applied. */
export function layoutAfter(files: FileEntry[], changes: Change[]): { folder: string; count: number }[] {
  const moved = new Map(changes.map((c) => [c.from, c.to]));
  const counts = new Map<string, number>();
  for (const f of files) {
    const final = moved.get(f.path) ?? f.path;
    const top = final.includes("/") ? final.slice(0, final.indexOf("/")) : "(top level)";
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  return [...counts.entries()].map(([folder, count]) => ({ folder, count })).sort((a, b) => a.folder.localeCompare(b.folder));
}

