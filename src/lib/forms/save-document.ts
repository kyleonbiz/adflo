import { createHttpApi } from "@/lib/dms/client/http-api";

/** The result of a Save press: whether it worked, and the sentence to show the person. */
export type SaveResult = { ok: boolean; message: string };

/** Files a generated PDF in the workspace's Documents. Needs a connected workspace (the no-database preview has no shared Documents). */
export async function savePdfToDocuments(pdf: Uint8Array, fileName: string): Promise<void> {
  const file = new File([pdf as BlobPart], fileName, { type: "application/pdf" });
  await createHttpApi("live").uploadFile({ file, folderId: null, category: "other" });
}
