// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadDialog } from "@/components/dms/upload-dialog";
import type { DmsApi } from "@/lib/dms/client/api";
import { defaultUploadLimits } from "@/lib/dms/config";
import type { DocumentRecord, FolderWithCount } from "@/lib/dms/types";

const insurance: FolderWithCount = { id: "f-ins", workspaceId: "w", name: "Insurance", color: "sky", isSystem: true, defaultCategory: "insurance", createdAt: "2026-11-01T00:00:00Z", documentCount: 0 };
const doc = (folderId: string | null) => ({ id: "d1", workspaceId: "w", folderId, originalName: "coi.pdf", displayName: "coi.pdf", category: folderId ? "insurance" : "other" }) as unknown as DocumentRecord;

function setup(returned: DocumentRecord, chosenFolder: string | null) {
  const api = { mode: "preview", capabilities: { share: false, team: false }, uploadFile: vi.fn(async () => returned) } as unknown as DmsApi;
  render(<UploadDialog open onOpenChange={() => undefined} api={api} limits={defaultUploadLimits()} folders={[insurance]} folderId={chosenFolder} onFolderChange={() => undefined} usage={{ usedBytes: 0, quotaBytes: 1_000_000_000 } as never} onUploaded={() => undefined} />);
  return api;
}
const pick = async () => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.upload(input, new File(["%PDF-1.4"], "coi.pdf", { type: "application/pdf" }));
};

describe("Upload dialog: automatic filing", () => {
  it("says where a file was filed when it was dropped into All files and sorted itself", async () => {
    setup(doc("f-ins"), null);
    await pick();
    await waitFor(() => expect(screen.getByText(/Uploaded and filed in Insurance/)).toBeInTheDocument());
  });

  it("just says Uploaded when the person chose the folder, or nothing was sorted", async () => {
    setup(doc("f-ins"), "f-ins");
    await pick();
    await waitFor(() => expect(screen.getByText(/· Uploaded$/)).toBeInTheDocument());
    expect(screen.queryByText(/filed in/)).toBeNull();
  });
});
