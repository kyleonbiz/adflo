import { z } from "zod";
import { canExtract, extractText } from "@/lib/dms/extract";
import { REASON_LABELS } from "@/lib/dms/extract/errors";
import { DmsError } from "@/lib/dms/errors";
import { route } from "@/lib/dms/server/respond";
import { foundCount, parseLicenseText, withIssueDate } from "@/lib/licenses/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 10 * 1024 * 1024;
const file = z.instanceof(File);

/**
 * Reads an uploaded license, permit or policy and returns the details it found so the add form can be
 * pre-filled. Nothing is stored: the user reviews the fields and saves the license themselves.
 */
export function POST(req: Request) {
  return route(
    req,
    async () => {
      // Refuse an oversized body before buffering it.
      if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES + 64 * 1024) {
        throw new DmsError("validation", "That file is too large. Use one under 10 MB.");
      }
      let form: FormData;
      try { form = await req.formData(); } catch { throw new DmsError("validation", "Choose a file to upload."); }
      const parsed = file.safeParse(form.get("file"));
      if (!parsed.success || parsed.data.size === 0) throw new DmsError("validation", "Choose a file to upload.");
      const upload = parsed.data;
      if (upload.size > MAX_BYTES) throw new DmsError("validation", "That file is too large. Use one under 10 MB.");
      if (!canExtract(upload.name)) {
        throw new DmsError("validation", "Photos and scans can't be read yet. Upload a PDF, Word, text or CSV file, or enter the details by hand.");
      }
      const result = await extractText({ bytes: new Uint8Array(await upload.arrayBuffer()), fileName: upload.name, mimeType: upload.type });
      if (result.status !== "indexed") {
        throw new DmsError("validation", (result.reason && REASON_LABELS[result.reason]) || "That file could not be read.");
      }
      const fields = withIssueDate(parseLicenseText(result.text));
      return { fields, found: foundCount(fields) };
    },
    { rate: { name: "license-parse", max: 20, windowMs: 60_000 } },
  );
}
