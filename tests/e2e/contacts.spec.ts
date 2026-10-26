import { expect, test, type Page } from "@playwright/test";

const row = (page: Page, name: string) => page.getByTestId("contact-row").filter({ hasText: name });

const CSV = [
  "Full Name,E-mail,Mobile,Organization,Type,Comments",
  "Ann Lee,ann@x.co,555-010-1111,Acme,Lead,",
  "Bad Email,nope,,,,",
  "ANN LEE,Ann@X.co,,,,",
  "Pat Lee,pat@northwind.example,,,Customer,Updated note",
  "Dee,,,,Boss,",
].join("\n");

async function openImport(page: Page) {
  await page.goto("/app/contacts");
  await page.getByRole("button", { name: "Import CSV" }).click();
  return page.getByRole("dialog");
}

test.describe("CRM & data module", () => {
  test("summary, duplicates, search and filter", async ({ page }) => {
    await page.goto("/app/contacts");
    await expect(page.getByRole("note")).toContainText("never leave your browser");
    await expect(page.getByTestId("contact-row")).toHaveCount(7);
    const dupes = page.getByRole("region", { name: "Possible duplicates" });
    await expect(dupes.getByTestId("duplicate-pair")).toHaveCount(1);
    await expect(dupes).toContainText("Pat Lee and Patrick Lee");
    await expect(dupes).toContainText("Same email");

    await page.getByRole("textbox", { name: "Search contacts" }).fill("globex");
    await expect(page.getByTestId("contact-row")).toHaveCount(1);
    await page.getByRole("textbox", { name: "Search contacts" }).fill("");
    await page.getByRole("combobox", { name: "Filter by category" }).click();
    await page.getByRole("option", { name: "Lead" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(2);
  });

  test("merging duplicates keeps one contact with the combined details", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("button", { name: "Merge Patrick Lee into Pat Lee" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(6);
    await expect(row(page, "Patrick Lee")).toHaveCount(0);
    await expect(row(page, "Pat Lee")).toContainText("Prefers email.");
    await expect(page.getByRole("region", { name: "Possible duplicates" })).toContainText("No duplicate contacts found");
  });

  test("add with validation, edit and delete", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("button", { name: "Add contact" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Name is required");
    await dialog.getByLabel("Name").fill("  zed   quill ");
    await dialog.getByLabel("Email").fill("ZED@Example.COM");
    await dialog.getByLabel("Phone").fill("abc");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog.getByRole("alert")).toContainText("not a valid phone number");
    await dialog.getByLabel("Phone").fill("(555) 010-4242");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog).toBeHidden();

    await expect(row(page, "zed quill")).toContainText("zed@example.com");
    await row(page, "zed quill").getByRole("button", { name: "Edit zed quill" }).click();
    await page.getByRole("dialog").getByLabel("Company").fill("Quill & Co");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, "zed quill")).toContainText("Quill & Co");

    await page.getByRole("button", { name: "Delete zed quill" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(7);
  });

  test("import wizard: map, review problems and duplicates, then import (skip mode)", async ({ page }) => {
    const dialog = await openImport(page);
    const next = dialog.getByRole("button", { name: "Next" });
    await expect(next).toBeDisabled();
    await dialog.getByLabel("Or paste CSV text").fill(CSV);
    await next.click();

    // The headers use different names; the engine should have matched all of them.
    await expect(dialog.getByRole("combobox", { name: "Column for Name" })).toContainText("Full Name");
    await expect(dialog.getByRole("combobox", { name: "Column for Email" })).toContainText("E-mail");
    await expect(dialog.getByRole("combobox", { name: "Column for Phone" })).toContainText("Mobile");
    await expect(dialog.getByRole("combobox", { name: "Column for Company" })).toContainText("Organization");
    await dialog.getByRole("button", { name: "Review" }).click();

    await expect(dialog.getByTestId("count-accepted")).toHaveText("1");
    await expect(dialog.getByTestId("count-duplicates")).toHaveText("2");
    await expect(dialog.getByTestId("count-rejected")).toHaveText("2");
    const rejected = dialog.getByTestId("rejected-list");
    await expect(rejected).toContainText("Line 3:");
    await expect(rejected).toContainText('"nope" is not a valid email');
    await expect(rejected).toContainText("Line 6:");
    await expect(rejected).toContainText('Unknown category "Boss"');

    await dialog.getByRole("button", { name: "Import 1 contact" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Imported: 1 added, 0 updated, 2 skipped, 2 need fixing.");
    await expect(page.getByTestId("contact-row")).toHaveCount(8);
    await expect(row(page, "Ann Lee")).toContainText("Acme");
    await expect(row(page, "Pat Lee").first()).not.toContainText("Updated note");
  });

  test("import wizard: update mode overwrites matching contacts", async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByLabel("Or paste CSV text").fill(CSV);
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByRole("button", { name: "Review" }).click();
    await dialog.getByLabel("Update existing contacts with the new values").check();
    await dialog.getByRole("button", { name: "Import 2 contacts" }).click();
    await expect(page.getByRole("status")).toContainText("1 added, 1 updated, 1 skipped");
    await expect(row(page, "Pat Lee").first()).toContainText("Updated note");
  });

  test("import wizard: fixing the column mapping by hand and going back", async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByLabel("Or paste CSV text").fill("Person;Where to write\nAnn Lee;ann@x.co\nBo Ng;bo@x.co");
    await dialog.getByRole("button", { name: "Next" }).click();
    const review = dialog.getByRole("button", { name: "Review" });
    await expect(review).toBeDisabled();
    await expect(dialog.getByRole("alert")).toContainText("Choose a column for: Name");
    await dialog.getByRole("combobox", { name: "Column for Name" }).click();
    await page.getByRole("option", { name: "Person" }).click();
    await expect(review).toBeEnabled();
    await expect(dialog.getByRole("combobox", { name: "Column for Email" })).toContainText("Don't Import");
    await dialog.getByRole("combobox", { name: "Column for Email" }).click();
    await page.getByRole("option", { name: "Where to write" }).click();
    await review.click();
    await expect(dialog.getByTestId("count-accepted")).toHaveText("2");
    await dialog.getByRole("button", { name: "Back" }).click();
    await expect(dialog.getByRole("combobox", { name: "Column for Name" })).toContainText("Person");
    await expect(dialog.getByRole("combobox", { name: "Column for Email" })).toContainText("Where to write");
  });

  test("import wizard: file upload, template download and unreadable input", async ({ page }) => {
    const dialog = await openImport(page);
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download template" }).click();
    const tpl = await download;
    expect(tpl.suggestedFilename()).toBe("contacts-template.csv");
    let text = "";
    for await (const chunk of await tpl.createReadStream()) text += chunk;
    expect(text).toBe("Name,Email,Phone,Company,Category,Notes\r\n");

    await dialog.getByLabel("Choose a CSV file").setInputFiles({ name: "people.csv", mimeType: "text/csv", buffer: Buffer.from("Name,Email\nCy Young,cy@x.co\n") });
    await expect(dialog.getByText("people.csv")).toBeVisible();
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByRole("button", { name: "Review" }).click();
    await expect(dialog.getByTestId("count-accepted")).toHaveText("1");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Import CSV" }).click();
    await page.getByRole("dialog").getByLabel("Or paste CSV text").fill('Name,Email\n"Unclosed,x@y.co');
    await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("starting on line 2 is never closed");
  });

  test("import wizard: warns about rows with extra values and refuses an oversized file", async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByLabel("Or paste CSV text").fill("Name,Email\nAnn Lee,ann@x.co,surprise\n");
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByRole("note")).toContainText("1 row has more values than there are headers (first on line 2)");
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.getByLabel("Choose a CSV file").setInputFiles({ name: "big.csv", mimeType: "text/csv", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, "a") });
    await expect(dialog.getByRole("alert")).toContainText("larger than 2 MB");
  });

  test("exports the filtered contacts as CSV", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("textbox", { name: "Search contacts" }).fill("northwind");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^contacts-\d{4}-\d{2}-\d{2}\.csv$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    const lines = text.trimEnd().split("\r\n");
    expect(lines[0]).toBe("Name,Email,Phone,Company,Category,Notes");
    expect(lines).toHaveLength(3);
  });

  test("fits a phone screen without horizontal scroll, including the import dialog", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/contacts");
    await expect(page.getByTestId("contact-row").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Import CSV" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Or paste CSV text").fill(CSV);
    await dialog.getByRole("button", { name: "Next" }).click();
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/contacts");
    await expect(page.getByRole("heading", { level: 1, name: "CRM & Data" })).toBeVisible();
    await expect(page.getByRole("link", { name: "CRM & Data", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
