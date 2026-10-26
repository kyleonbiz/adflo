import type { ExtractedLicense } from "./parse";

export const LICENSE_UPLOAD_ACCEPT = ".pdf,.docx,.txt,.csv";

/** Sends a file to be read and returns what was found, or throws an Error with a message fit to show the user. */
export async function readLicenseFile(file: File): Promise<{ fields: ExtractedLicense; found: number }> {
  const body = new FormData();
  body.append("file", file);
  let res: Response;
  try {
    res = await fetch("/api/licenses/parse", { method: "POST", body });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as
    | { ok: true; data: { fields: ExtractedLicense; found: number } }
    | { ok: false; error: { message: string } }
    | null;
  if (!json) throw new Error("Something went wrong reading that file.");
  if (!json.ok) throw new Error(json.error.message);
  return json.data;
}
