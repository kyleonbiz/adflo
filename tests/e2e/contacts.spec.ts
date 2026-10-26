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

  test("merging duplicates: review, choose the record to keep, then undo", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("button", { name: "Review merge of Patrick Lee and Pat Lee" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("radio", { name: "Keep Pat Lee" })).toBeChecked();
    await expect(dialog).toContainText("Result: Pat Lee");
    await dialog.getByRole("radio", { name: "Keep Patrick Lee" }).check();
    await expect(dialog).toContainText("Result: Patrick Lee");
    await dialog.getByRole("radio", { name: "Keep Pat Lee" }).check();
    await dialog.getByRole("button", { name: "Merge" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(6);
    await expect(row(page, "Patrick Lee")).toHaveCount(0);
    await expect(row(page, "Pat Lee")).toContainText("Prefers email.");
    await expect(page.getByRole("region", { name: "Possible duplicates" })).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Merged Patrick Lee into Pat Lee.");

    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(7);
    await expect(page.getByRole("region", { name: "Possible duplicates" }).getByTestId("duplicate-pair")).toHaveCount(1);
  });

  test("tiles filter the list, with a result count, sort and clear", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("button", { name: /Missing email/ }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(2);
    await expect(page.getByTestId("result-count")).toContainText("Showing 2 of 7 contacts.");
    await page.getByRole("button", { name: /No contact in 90\+ days/ }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(4);
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByTestId("contact-row")).toHaveCount(7);

    await page.getByRole("textbox", { name: "Search contacts" }).fill("zzz");
    await expect(page.getByText("No contacts match these filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(7);

    await page.getByRole("combobox", { name: "Sort contacts" }).click();
    await page.getByRole("option", { name: "Sort: Newest first" }).click();
    await expect(page.getByTestId("contact-row").first()).toContainText("Sam Rivera");
  });

  test("selecting contacts: change category, delete in bulk, and undo", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("checkbox", { name: "Select Marta Gill" }).check();
    await page.getByRole("checkbox", { name: "Select Sam Rivera" }).check();
    const bar = page.getByRole("toolbar", { name: "Actions for selected contacts" });
    await expect(bar).toContainText("2 selected");
    await bar.getByRole("combobox", { name: "Set category for selected" }).click();
    await page.getByRole("option", { name: "Customer" }).click();
    await expect(page.getByRole("status")).toContainText("2 contacts set to Customer.");
    await expect(row(page, "Sam Rivera")).toContainText("Customer");

    await page.getByRole("checkbox", { name: "Select Marta Gill" }).check();
    await page.getByRole("checkbox", { name: "Select Sam Rivera" }).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(5);
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(7);
  });

  test("logging a contact today updates the follow-up count", async ({ page }) => {
    await page.goto("/app/contacts");
    await expect(row(page, "Hank Scorpio")).toContainText("Never contacted");
    await page.getByRole("button", { name: "Mark Hank Scorpio contacted today" }).click();
    await expect(row(page, "Hank Scorpio")).toContainText("Contacted today");
    await expect(page.getByRole("button", { name: /No contact in 90\+ days/ })).toContainText("3");
  });

  test("email and phone are links", async ({ page }) => {
    await page.goto("/app/contacts");
    await expect(row(page, "Priya Shah").getByRole("link", { name: "priya@contoso.example" })).toHaveAttribute("href", "mailto:priya@contoso.example");
    await expect(row(page, "Dana Whitfield").getByRole("link", { name: "(555) 010-2200" })).toHaveAttribute("href", "tel:5550102200");
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

    await expect(row(page, "Zed Quill")).toContainText("zed@example.com");
    await row(page, "Zed Quill").getByRole("button", { name: "Edit Zed Quill" }).click();
    await page.getByRole("dialog").getByLabel("Company").fill("Quill & Co");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, "Zed Quill")).toContainText("Quill & Co");

    await page.getByRole("button", { name: "Delete Zed Quill" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(7);
  });

  test("saving a contact that matches someone warns first, and the first invalid field gets focus", async ({ page }) => {
    await page.goto("/app/contacts");
    await page.getByRole("button", { name: "Add contact" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill("bad");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog.getByLabel("Name")).toBeFocused();
    await dialog.getByLabel("Name").fill("Pat L");
    await dialog.getByLabel("Email").fill("pat@northwind.example");
    await dialog.getByRole("button", { name: "Add contact" }).click();
    await expect(dialog.getByRole("alert")).toContainText("This looks like someone already in your list");
    await expect(dialog.getByRole("alert")).toContainText("Pat Lee");
    await expect(page.getByTestId("contact-row")).toHaveCount(7);
    await dialog.getByRole("button", { name: "Save anyway" }).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(8);
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

    await expect(dialog.getByTestId("count-accepted")).toHaveText("2");
    await expect(dialog.getByTestId("count-duplicates")).toHaveText("2");
    await expect(dialog.getByTestId("count-rejected")).toHaveText("1");
    const rejected = dialog.getByTestId("rejected-list");
    await expect(rejected).toContainText("Line 3:");
    await expect(rejected).toContainText('"nope" is not a valid email');
    await dialog.getByText("See which rows match").click();
    await expect(dialog.getByTestId("match-list")).toContainText("Line 4: Ann Lee — repeats an earlier row in the file; skipped");
    await expect(dialog.getByTestId("match-list")).toContainText("Line 5: Pat Lee — matches Pat Lee; skipped");
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download all 1" }).click();
    expect((await download).suggestedFilename()).toBe("import-problems.csv");

    await dialog.getByRole("button", { name: "Import 2 contacts" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("status")).toContainText("Imported: 2 added, 0 updated, 2 skipped, 1 need fixing.");
    await expect(page.getByTestId("contact-row")).toHaveCount(9);
    await expect(row(page, "Ann Lee")).toContainText("Acme");
    await expect(row(page, "Pat Lee").first()).not.toContainText("Updated note");
  });

  test("import wizard: update mode overwrites matching contacts", async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByLabel("Or paste CSV text").fill(CSV);
    await dialog.getByRole("button", { name: "Next" }).click();
    await dialog.getByRole("button", { name: "Review" }).click();
    await dialog.getByLabel("Update existing contacts with the new values").check();
    await dialog.getByText("See which rows match").click();
    await expect(dialog.getByTestId("match-list")).toContainText("would change notes");
    await dialog.getByRole("button", { name: "Import 3 contacts" }).click();
    await expect(page.getByRole("status")).toContainText("2 added, 1 updated, 1 skipped");
    await expect(row(page, "Pat Lee").first()).toContainText("Updated note");
  });

  test("import wizard: unrecognised category values are mapped instead of rejecting the rows", async ({ page }) => {
    const dialog = await openImport(page);
    await dialog.getByLabel("Or paste CSV text").fill("Name,Type\nDee Fox,Prospect\nEli Ray,Prospect\nFay Moe,Lead");
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByRole("group", { name: /Category values we don't recognise/ })).toContainText("Prospect");
    await dialog.getByRole("combobox", { name: "Category for Prospect" }).click();
    await page.getByRole("option", { name: "Partner" }).click();
    await expect(dialog.getByRole("table")).toContainText("Dee Fox");
    await dialog.getByRole("button", { name: "Review" }).click();
    await expect(dialog.getByTestId("count-accepted")).toHaveText("3");
    await expect(dialog.getByTestId("count-rejected")).toHaveText("0");
    await dialog.getByRole("button", { name: "Import 3 contacts" }).click();
    await expect(row(page, "Dee Fox")).toContainText("Partner");
    await expect(row(page, "Fay Moe")).toContainText("Lead");
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
    await expect(dialog.getByRole("combobox", { name: "Column for Email" })).toContainText("Don't import");
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
    expect(text).toBe("Name,Email,Phone,Company,Category,Notes,Last contacted\r\n");

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
    await page.getByRole("button", { name: "Export CSV (2 shown)" }).click();
    const file = await download;
    await expect(page.getByRole("status")).toContainText("Exported 2 contacts (filtered list).");
    expect(file.suggestedFilename()).toMatch(/^contacts-\d{4}-\d{2}-\d{2}\.csv$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    const lines = text.trimEnd().split("\r\n");
    expect(lines[0]).toBe("Name,Email,Phone,Company,Category,Notes,Last contacted");
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
