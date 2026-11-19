import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv } from "@/lib/csv";
import { DOCUMENTS_BUCKET } from "@/lib/dms/supabase/storage";
import { PERSISTED_KINDS, createSupabaseBackend } from "@/lib/records/supabase-backend";
import type { RecordKind } from "@/lib/records/storage";
import { recordsToCsv } from "./records-csv";
import { safeSegment, uniquePath, zipStream, type ZipDocument } from "./zip-stream";

const PAGE = 1000;
const DEFAULT_MAX_BYTES = 1.5 * 1024 ** 3;
/** The most stored data one export will carry. Past this the stream could outlast the function, so the owner is asked to contact support. */
const exportMaxBytes = (env: Record<string, string | undefined> = process.env): number => {
  const n = Number(env.DMS_EXPORT_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
};

type Row = Record<string, unknown>;

async function pages(query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error("export_read_failed");
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/** How much an export would carry, without reading any file: for the "is it too big" check before a download starts. */
export async function exportSize(db: SupabaseClient, workspaceId: string, maxBytes = exportMaxBytes()): Promise<{ documents: number; bytes: number; tooLarge: boolean }> {
  const docs = await pages((a, b) => db.from("documents").select("id, size_bytes").eq("workspace_id", workspaceId).eq("status", "ready").is("deleted_at", null).order("id").range(a, b));
  const bytes = docs.reduce((n, d) => n + Number(d.size_bytes ?? 0), 0);
  return { documents: docs.length, bytes, tooLarge: bytes > maxBytes };
}

interface WorkspaceExport {
  tooLarge: boolean;
  totalBytes: number;
  documentCount: number;
  filename: string;
  /** Present unless `tooLarge`. */
  stream?: ReadableStream<Uint8Array>;
}

/**
 * Everything a workspace holds, as one zip: each service's saved records (JSON and CSV), the activity trail, the team, an index of
 * the documents and the document files themselves. Read with the caller's own session, so the database decides what they may see.
 * Documents in the trash are left out.
 */
export async function buildWorkspaceExport(
  db: SupabaseClient,
  ws: { id: string; name: string },
  now = new Date(),
  maxBytes = exportMaxBytes(),
): Promise<WorkspaceExport> {
  const day = now.toISOString().slice(0, 10);
  const filename = `adflo-export-${safeSegment(ws.name, "workspace").replace(/\s+/g, "-").toLowerCase()}-${day}.zip`;

  const [folders, docs, versions] = await Promise.all([
    pages((a, b) => db.from("document_folders").select("id, name").eq("workspace_id", ws.id).order("id").range(a, b)),
    pages((a, b) => db.from("documents")
      .select("id, display_name, original_name, mime_type, size_bytes, category, folder_id, created_at, uploaded_by_name, current_version, expires_at")
      .eq("workspace_id", ws.id).eq("status", "ready").is("deleted_at", null).order("id").range(a, b)),
    pages((a, b) => db.from("document_versions").select("document_id, version_number, storage_key").eq("workspace_id", ws.id).eq("status", "ready").order("id").range(a, b)),
  ]);
  const totalBytes = docs.reduce((n, d) => n + Number(d.size_bytes ?? 0), 0);
  if (totalBytes > maxBytes) return { tooLarge: true, totalBytes, documentCount: docs.length, filename };

  const folderName = new Map(folders.map((f) => [String(f.id), String(f.name)]));
  const keyOf = new Map(versions.map((v) => [`${v.document_id}:${v.version_number}`, String(v.storage_key)]));
  const used = new Set<string>();
  const documents: ZipDocument[] = [];
  const index: (string | number)[][] = [["Path in this export", "Name", "Folder", "Category", "Type", "Size (bytes)", "Uploaded by", "Uploaded", "Expires"]];
  for (const d of docs) {
    const key = keyOf.get(`${d.id}:${d.current_version}`);
    if (!key) continue;
    const folder = d.folder_id ? folderName.get(String(d.folder_id)) ?? "" : "";
    const path = `documents/${uniquePath(used, folder, String(d.original_name || d.display_name))}`;
    documents.push({ path, key });
    index.push([path, String(d.display_name), folder, String(d.category), String(d.mime_type), Number(d.size_bytes ?? 0), String(d.uploaded_by_name ?? ""), String(d.created_at ?? ""), String(d.expires_at ?? "")]);
  }

  const backend = createSupabaseBackend(db, ws.id);
  const files: { path: string; text: string }[] = [];
  const counts: string[] = [];
  for (const kind of PERSISTED_KINDS) {
    const { records } = await backend.load(kind as RecordKind);
    if (records.length === 0) continue;
    files.push({ path: `records/${kind}.json`, text: JSON.stringify(records, null, 2) });
    files.push({ path: `records/${kind}.csv`, text: recordsToCsv(records as Row[]) });
    counts.push(`  ${kind}: ${records.length}`);
  }
  const activity = await pages((a, b) => db.from("workspace_activity").select("at, data").eq("workspace_id", ws.id).order("at").range(a, b));
  if (activity.length) files.push({ path: "records/activity.json", text: JSON.stringify(activity, null, 2) });
  const members = await pages((a, b) => db.from("workspace_members").select("display_name, email, role, created_at").eq("workspace_id", ws.id).order("created_at").range(a, b));
  files.push({ path: "team.csv", text: toCsv([["Name", "Email", "Role", "Joined"], ...members.map((m) => [String(m.display_name ?? ""), String(m.email ?? ""), String(m.role), String(m.created_at ?? "")])]) });
  files.push({ path: "documents/index.csv", text: toCsv(index) });
  files.unshift({
    path: "README.txt",
    text: [
      `AdFlo export of "${ws.name}"`,
      `Made on ${day}.`,
      "",
      "What is in this file:",
      "  team.csv                 who has access and their role",
      "  records/<service>.json   everything saved in each service (full detail)",
      "  records/<service>.csv    the same records as a spreadsheet",
      "  records/activity.json    the activity trail",
      "  documents/index.csv      one row for every document, with where it is in this export",
      "  documents/<folder>/...   the document files themselves (latest version of each)",
      "",
      "Saved records:",
      ...(counts.length ? counts : ["  none"]),
      `Documents: ${documents.length}`,
      "",
      "Documents in the trash and older versions of a document are not included.",
      "Files kept only in a browser (such as a scan attached to a vendor's document) are not part of your workspace and are not included.",
    ].join("\r\n") + "\r\n",
  });

  const bucket = db.storage.from(DOCUMENTS_BUCKET);
  const stream = zipStream({
    files,
    documents,
    open: async (key) => {
      const { data } = await bucket.createSignedUrl(key, 600);
      if (!data) return null;
      const res = await fetch(data.signedUrl, { cache: "no-store" });
      return res.ok ? res.body : null;
    },
  });
  return { tooLarge: false, totalBytes, documentCount: documents.length, filename, stream };
}
