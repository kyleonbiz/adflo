import { strFromU8, unzipSync } from "fflate";
import { expect, test, type Page } from "@playwright/test";

async function readDownload(download: import("@playwright/test").Download): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function loadSample(page: Page) {
  await page.goto("/demo/reporting");
  await page.getByRole("button", { name: "Load sample data" }).click();
}

test.describe("data entry & reporting module", () => {
  test("starts empty and loads the sample, setting aside bad and repeated rows", async ({ page }) => {
    await page.goto("/demo/reporting");
    await expect(page.getByRole("note")).toContainText("never uploaded");
    await expect(page.getByRole("heading", { name: "No data loaded" })).toBeVisible();
    await page.getByRole("button", { name: "Load sample data" }).click();

    await expect(page.getByRole("status")).toContainText('Loaded 8 rows into "Q3 expenses". 2 need fixing, 1 repeated.');
    await expect(page.getByTestId("record-row")).toHaveCount(8);
    const aside = page.getByTestId("set-aside-list");
    await expect(aside).toContainText("Line 6: Vendor is required");
    await expect(aside).toContainText('Line 9: Amount: "n/a" is not a number');
    const summary = page.getByRole("region", { name: "Summary", exact: true });
    await expect(summary).toContainText("Total Amount");
    await expect(summary).toContainText("6,907.64");
  });

  test("cleans values: dates become readable and money becomes numbers", async ({ page }) => {
    await loadSample(page);
    const first = page.getByTestId("record-row").first();
    await expect(first).toContainText("Jul 3, 2026");
    await expect(first).toContainText("1,240.50");
    await expect(page.getByTestId("record-row").nth(2)).toContainText("-150.25");
    await expect(page.getByTestId("record-row").nth(1)).toContainText("899.00"); // whole amounts line up with the cents
    const stats = page.getByTestId("column-stat");
    await expect(stats.filter({ hasText: "Amount" })).toContainText("Total 6,907.64 · average 863.46");
    await expect(stats.filter({ hasText: "Vendor" })).toContainText("4 distinct");
  });

  test("report builder: group, measure and calculate", async ({ page }) => {
    await loadSample(page);
    // Defaults: group by the first text column (Vendor), total of Amount.
    await page.getByLabel("Group by").click();
    await page.getByRole("option", { name: "Category" }).click();
    const rows = page.getByTestId("report-row");
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText("Services");
    await expect(rows.first()).toContainText("4,300");
    await expect(rows.first()).toContainText("2 rows");

    await page.getByLabel("Calculate").click();
    await page.getByRole("option", { name: "Average" }).click();
    await expect(rows.first()).toContainText("2,150");

    await page.getByLabel("Group by").click();
    await page.getByRole("option", { name: "Date (by month)" }).click();
    await page.getByLabel("Calculate").click();
    await page.getByRole("option", { name: "Total" }).click();
    await expect(rows.first()).toContainText("2026-08");
    await expect(rows.first()).toContainText("2,810");

    await page.getByLabel("Measure").click();
    await page.getByRole("option", { name: "Count of rows" }).click();
    await expect(page.getByLabel("Calculate")).toBeDisabled();
    await expect(rows.first()).toContainText("3 rows");
  });

  test("exports CSV, a real Excel workbook, and the report", async ({ page }) => {
    await loadSample(page);

    let download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    let file = await download;
    expect(file.suggestedFilename()).toMatch(/^q3-expenses-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = (await readDownload(file)).toString("utf8").trimEnd().split("\r\n");
    expect(csv[0]).toBe("Date,Vendor,Category,Amount,Notes");
    expect(csv).toHaveLength(9);
    expect(csv[1]).toBe("2026-07-03,Acme Office Supply,Supplies,1240.5,Printer paper");

    download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export Excel" }).click();
    file = await download;
    expect(file.suggestedFilename()).toMatch(/^q3-expenses-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const bytes = await readDownload(file);
    expect(bytes.subarray(0, 2).toString()).toBe("PK"); // a zip container
    const parts = unzipSync(new Uint8Array(bytes));
    expect(Object.keys(parts)).toContain("xl/worksheets/sheet1.xml");
    const sheet = strFromU8(parts["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('<c r="D2"><v>1240.5</v></c>');
    expect(sheet.match(/<row /g)).toHaveLength(9);

    download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download report" }).click();
    file = await download;
    expect((await readDownload(file)).toString("utf8").split("\r\n")[0]).toBe("Vendor,Rows,Total Amount");
  });

  test("scheduled summary: next date, recipient validation and preview", async ({ page }) => {
    await loadSample(page);
    const next = page.getByTestId("next-summary");
    await expect(next).toContainText("Next summary:");
    const weekly = await next.textContent();
    await page.getByLabel("How often").click();
    await page.getByRole("option", { name: "1st of the month" }).click();
    await expect(next).not.toHaveText(weekly!);

    await page.getByLabel("Send to").fill("nope");
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await page.getByLabel("Send to").fill("boss@company.com");
    await expect(next).toContainText("to boss@company.com");

    await page.getByRole("button", { name: "Preview summary" }).click();
    const text = page.getByTestId("summary-preview");
    await expect(text).toContainText("DATA SUMMARY: Q3 expenses");
    await expect(text).toContainText("8 rows, 5 columns");
    await expect(text).toContainText("Amount (number): 8 filled, total 6,907.64");
    await page.getByRole("button", { name: "Hide summary" }).click();
    await expect(text).toHaveCount(0);
  });

  test("import wizard: guessed types can be changed and required columns reject blanks", async ({ page }) => {
    await page.goto("/demo/reporting");
    await page.getByRole("button", { name: "Import CSV" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Or paste CSV text").fill("When,Who,Score\n3/4/2026,Ann,10\n3/5/2026,,20\n3/6/2026,Bo,oops\n3/7/2026,Cy,30");
    await dialog.getByRole("button", { name: "Next" }).click();

    await expect(dialog.getByTestId("column-row")).toHaveCount(3);
    await expect(dialog.getByRole("combobox", { name: "Type of When" })).toContainText("Date");
    await expect(dialog.getByRole("combobox", { name: "Type of Who" })).toContainText("Text");
    await expect(dialog.getByRole("combobox", { name: "Type of Score" })).toContainText("Text"); // 1 of 4 is not a number
    await dialog.getByRole("combobox", { name: "Type of Score" }).click();
    await page.getByRole("option", { name: "Number" }).click();
    await dialog.getByLabel("Who is required").check();
    await dialog.getByLabel("Name for this data").fill("Scores");
    await dialog.getByRole("button", { name: "Review" }).click();

    await expect(dialog.getByTestId("count-accepted")).toHaveText("2");
    await expect(dialog.getByTestId("count-rejected")).toHaveText("2");
    const rejected = dialog.getByTestId("rejected-list");
    await expect(rejected).toContainText("Line 3: Who is required");
    await expect(rejected).toContainText('Line 4: Score: "oops" is not a number');
    await dialog.getByRole("button", { name: "Load 2 rows" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Scores: columns" })).toBeVisible();
    await expect(page.getByTestId("record-row")).toHaveCount(2);
  });

  test("import wizard: the repeated-row option and an unreadable file", async ({ page }) => {
    await page.goto("/demo/reporting");
    await page.getByRole("button", { name: "Import CSV" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Choose a CSV file").setInputFiles({ name: "sales data.csv", mimeType: "text/csv", buffer: Buffer.from("Item,Qty\nPen,3\nPen,3\nCap,1\n") });
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByLabel("Name for this data")).toHaveValue("sales data");
    await dialog.getByRole("button", { name: "Review" }).click();
    await expect(dialog.getByTestId("count-accepted")).toHaveText("2");
    await expect(dialog.getByTestId("count-duplicates")).toHaveText("1");
    await dialog.getByLabel("Remove rows that exactly repeat an earlier row").uncheck();
    await expect(dialog.getByTestId("count-accepted")).toHaveText("3");
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.getByRole("button", { name: "Back" }).click();
    await dialog.getByLabel("Or paste CSV text").fill('A,B\n"broken,1');
    await dialog.getByRole("button", { name: "Next" }).click();
    await expect(dialog.getByRole("alert")).toContainText("never closed");
  });

  test("fits a phone screen without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await loadSample(page);
    await expect(page.getByTestId("record-row").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/reporting");
    await expect(page.getByRole("heading", { level: 1, name: "Data Entry & Reporting" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Data Entry & Reporting", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
