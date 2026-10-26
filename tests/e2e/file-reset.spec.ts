import { closeSync, ftruncateSync, mkdirSync, mkdtempSync, openSync, rmSync, utimesSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { todayLocal } from "../../src/lib/dates";
import { sampleFiles } from "../support/files-sample-data";
import { expect, test } from "./fixtures";
import type { Download, Page } from "@playwright/test";

const text = async (d: Download) => { let s = ""; for await (const c of await d.createReadStream()) s += c; return s; };
/**
 * A real folder on disk laid out like the messy sample: files with the same `hash` have identical
 * contents, every other file differs, and sizes and dates match. Contents are a short key padded
 * out (sparse) to the listed size.
 */
function makeMessyFolder(): { root: string; dir: string } {
  const root = mkdtempSync(join(tmpdir(), "messy-"));
  const dir = join(root, "Client Files");
  for (const f of sampleFiles(todayLocal())) {
    const full = join(dir, f.path);
    mkdirSync(join(full, ".."), { recursive: true });
    const fd = openSync(full, "w");
    writeSync(fd, `${f.hash}\n`);
    ftruncateSync(fd, Math.max(f.size, `${f.hash}\n`.length));
    closeSync(fd);
    const when = new Date(`${f.modified}T12:00:00`);
    utimesSync(full, when, when);
  }
  return { root, dir };
}

let messy: { root: string; dir: string };
test.beforeAll(() => { messy = makeMessyFolder(); });
test.afterAll(() => { rmSync(messy.root, { recursive: true, force: true }); });

const sample = async (page: Page) => {
  await page.goto("/app/file-reset");
  await page.getByLabel("Choose a folder").setInputFiles(messy.dir);
  await expect(page.getByRole("status").filter({ hasText: "Loaded 20 files from your folder." })).toBeVisible({ timeout: 30_000 });
};
const row = (page: Page, from: string) => page.getByTestId("change-row").filter({ hasText: from });

test.describe("business file reset module", () => {
  test("starts with a clear promise, then reads a folder", async ({ page }) => {
    await page.goto("/app/file-reset");
    await expect(page.getByRole("note")).toContainText("never uploaded");
    await expect(page.getByText("Nothing is uploaded, and nothing on your computer is changed or deleted.")).toBeVisible();
    await page.getByLabel("Choose a folder").setInputFiles(messy.dir);
    await expect(page.getByRole("status").filter({ hasText: "Loaded 20 files from your folder." })).toBeVisible({ timeout: 30_000 });
    const summary = page.getByRole("region", { name: "Summary", exact: true });
    await expect(summary).toContainText("Duplicates (1.3 MB)");
    await expect(summary).toContainText("Misplaced");
    await expect(page.getByTestId("change-row").first()).toBeVisible();
  });

  test("explains each change and shows the folders that result", async ({ page }) => {
    await sample(page);
    const dup = row(page, "Invoices/Invoice_03-14-2026_Acme (1).pdf");
    await expect(dup).toContainText("_Duplicates (review)/Invoices/Invoice 2026-03-14 Acme (1).pdf");
    await expect(dup).toContainText("Identical to Invoices/Invoice_03-14-2026_Acme.pdf");
    const misplaced = row(page, "Invoices/contract_northwind_2026.pdf");
    await expect(misplaced).toContainText("03 Contracts/contract northwind 2026.pdf");
    await expect(misplaced).toContainText('Looks like a contract, but is in "Invoices"');
    await expect(row(page, "Desktop/scan_0034 .PDF")).toContainText("Desktop/scan 0034.pdf");
    await expect(row(page, "Presentations/Sales deck.pptx")).toHaveCount(0); // already tidy
    const layout = page.getByTestId("layout");
    await expect(layout).toContainText("_Duplicates (review)");
    await expect(layout).toContainText("03 Contracts");
  });

  test("options change the plan", async ({ page }) => {
    await sample(page);
    const rows = page.getByTestId("change-row");
    const before = await rows.count();
    await page.getByLabel("Standardize file names").uncheck();
    await expect(row(page, "Desktop/scan_0034 .PDF")).toHaveCount(0);
    await page.getByLabel("Set duplicates aside for review").uncheck();
    await page.getByLabel("Move misplaced files").uncheck();
    await expect(page.getByText("Nothing to change with these options")).toBeVisible();
    await page.getByLabel("Standardize file names").check();
    expect(await rows.count()).toBeGreaterThan(0);
    expect(await rows.count()).toBeLessThan(before);

    await page.getByLabel("Sort everything into the suggested folders").check();
    await expect(row(page, "Desktop/IMG_2231.JPG")).toContainText("06 Photos & Images/IMG 2231.jpg");
    await expect(row(page, "Downloads/setup_notes.txt")).toContainText("00 To Sort/setup notes.txt");
  });

  test("approval is required before anything can be downloaded", async ({ page }) => {
    await sample(page);
    await expect(page.getByRole("button", { name: /Plan \(CSV\)/ })).toHaveCount(0);
    await expect(page.getByTestId("approved")).toHaveCount(0);

    await page.getByRole("button", { name: "Select none" }).click();
    await expect(page.getByRole("button", { name: /^Approve 0 changes/ })).toBeDisabled();

    await page.getByRole("button", { name: "Select all" }).click();
    await page.getByLabel("Apply the change to Desktop/scan_0034 .PDF").uncheck();
    const approve = page.getByRole("button", { name: /^Approve \d+ change/ });
    await approve.click();
    await expect(page.getByTestId("approved")).toContainText("Still nothing has been moved");

    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Plan \(CSV\)/ }).click();
    const csv = await text(await download);
    expect(csv.split("\r\n")[0]).toBe("From,To,Why");
    expect(csv).toContain("Invoices/contract_northwind_2026.pdf,03 Contracts/contract northwind 2026.pdf");
    expect(csv).not.toContain("scan_0034"); // unticked, so not approved

    download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Move script/ }).click();
    const move = await text(await download);
    expect(move.startsWith("#!/bin/sh\n")).toBe(true);
    expect(move).toContain("move './Invoices/contract_northwind_2026.pdf' './03 Contracts/contract northwind 2026.pdf'");
    expect(move).not.toMatch(/\brm\b/);
    expect(move).not.toContain("scan_0034");

    download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Undo script/ }).click();
    const undo = await text(await download);
    expect(undo).toContain("move './03 Contracts/contract northwind 2026.pdf' './Invoices/contract_northwind_2026.pdf'");

    await page.getByRole("button", { name: "Change selection" }).click();
    await expect(page.getByTestId("approved")).toHaveCount(0);
  });

  test("changing the selection after approving asks for approval again", async ({ page }) => {
    await sample(page);
    await page.getByRole("button", { name: /^Approve \d+ change/ }).click();
    await expect(page.getByTestId("approved")).toBeVisible();
    await page.getByLabel("Apply the change to Misc/resume_priya_shah.docx").uncheck();
    await expect(page.getByTestId("approved")).toHaveCount(0);
    await page.getByLabel("Set duplicates aside for review").uncheck();
    await expect(page.getByTestId("approved")).toHaveCount(0);
  });

  test("a real folder: identical contents are duplicates, same names with different contents are not", async ({ page }) => {
    const root = mkdtempSync(join(tmpdir(), "client-"));
    const dir = join(root, "Client Files");
    try {
      for (const [p, content] of [
        ["Invoices/Invoice_03-14-2026_Acme.pdf", "same bytes"], ["Invoices/Invoice_03-14-2026_Acme (1).pdf", "same bytes"],
        ["Invoices/contract_northwind.pdf", "contract"], ["Desktop/scan_0034 .PDF", "scan"], ["Desktop/.DS_Store", "junk"],
        ["Downloads/notes.txt", "version one"], ["Downloads/notes - Copy.txt", "version TWO, edited"],
      ]) {
        mkdirSync(join(dir, p, ".."), { recursive: true });
        writeFileSync(join(dir, p), content);
      }
      await page.goto("/app/file-reset");
      await page.getByLabel("Choose a folder").setInputFiles(dir);
      await expect(page.getByRole("status").filter({ hasText: "Loaded 6 files from your folder." })).toBeVisible();
      await expect(page.getByRole("region", { name: "Notes" })).toContainText("Skipped Desktop/.DS_Store: System file.");

      const dup = row(page, "Invoices/Invoice_03-14-2026_Acme (1).pdf");
      await expect(dup).toContainText("Identical to Invoices/Invoice_03-14-2026_Acme.pdf");
      // Same-looking names but different contents: a different version, so no change is proposed at all.
      await expect(row(page, "Downloads/notes - Copy.txt")).toHaveCount(0);
      await expect(row(page, "Downloads/notes.txt")).toHaveCount(0);
      await expect(row(page, "Invoices/contract_northwind.pdf")).toContainText("03 Contracts/contract northwind.pdf");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a pasted list: bad lines are reported and likely duplicates are labelled as likely", async ({ page }) => {
    await page.goto("/app/file-reset");
    await page.getByRole("button", { name: "Paste a list of files" }).click();
    await page.getByLabel(/One file per line/).fill([
      "Docs/Report.pdf | 5000", "Docs/Report (1).pdf | 5000", "Docs/Notes_final.txt", "../outside.txt", "C:\\Windows\\x.txt", "Docs/Report.pdf", "Docs/Budget_03-14-2026.xlsx | many",
    ].join("\n"));
    await page.getByRole("button", { name: "Load list" }).click();
    await expect(page.getByRole("status")).toContainText("Loaded 3 files from your list.");
    const notes = page.getByRole("region", { name: "Notes" });
    await expect(notes).toContainText("not read (too big, or a list)");
    await expect(notes).toContainText("Skipped ../outside.txt");
    await expect(notes).toContainText("Skipped Docs/Report.pdf: Listed twice");
    await expect(row(page, "Docs/Report (1).pdf")).toContainText("Looks like a copy of Docs/Report.pdf");
    await expect(row(page, "Docs/Notes_final.txt")).toContainText("Docs/Notes final.txt");
  });

  test("a list with nothing usable shows a message", async ({ page }) => {
    await page.goto("/app/file-reset");
    await page.getByRole("button", { name: "Paste a list of files" }).click();
    await page.getByLabel(/One file per line/).fill("../a\n../b");
    await page.getByRole("button", { name: "Load list" }).click();
    await expect(page.getByRole("status")).toContainText("None of those lines could be used.");
    await expect(page.getByLabel("Choose a folder")).toBeAttached();
  });

  test("start over clears the plan", async ({ page }) => {
    await sample(page);
    await page.getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("button", { name: "Choose a folder" }).or(page.getByLabel("Choose a folder"))).toBeVisible();
    await expect(page.getByTestId("change-row")).toHaveCount(0);
  });

  test("fits a phone screen without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await sample(page);
    await expect(page.getByTestId("change-row").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/file-reset");
    await expect(page.getByRole("heading", { level: 1, name: "Tidy up files" })).toBeVisible();
    // A one-time tool: not in the menu, reached from Documents and from setup.
    await expect(page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Tidy up files" })).toHaveCount(0);
    await page.goto("/app");
    await page.getByRole("link", { name: "Tidy up files" }).click();
    await expect(page).toHaveURL(/\/app\/file-reset$/);
  });
});
