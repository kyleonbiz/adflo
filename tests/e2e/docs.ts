import { expect } from "./fixtures";
import type { Page } from "@playwright/test";

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

/** Leading bytes the server checks against the extension: PDFs start `%PDF-`, Office files are zip archives. */
const bytesFor = (name: string) => (/\.(docx|xlsx)$/i.test(name) ? Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(name)]) : Buffer.from(`%PDF-1.4 ${name}`));

/** A few typical files, so a test has something to look at in an otherwise empty workspace. */
export const SOME_DOCUMENTS = [
  "Invoice_INV-2041_Northwind.pdf",
  "Master_Services_Agreement_Harbor.pdf",
  "NDA_Summit_Property_Group.docx",
  "AR_Aging_Report_Oct.xlsx",
];

/** Uploads files through the Upload dialog, as a person would, and waits for each to finish. */
export async function addDocuments(page: Page, names: string[] = SOME_DOCUMENTS) {
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("file-input").setInputFiles(
    names.map((name) => ({ name, mimeType: MIME[name.split(".").pop()!] ?? "application/pdf", buffer: bytesFor(name) })),
  );
  await expect(dialog.getByTestId("upload-row")).toHaveCount(names.length);
  for (let i = 0; i < names.length; i++) await expect(dialog.getByTestId("upload-row").nth(i)).toHaveAttribute("data-status", "success", { timeout: 20_000 });
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("document-card")).toHaveCount(names.length);
}
