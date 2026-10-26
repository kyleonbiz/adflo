import { expect, test } from "@playwright/test";

test.describe("invoices module", () => {
  test("summary, attention list and status filter", async ({ page }) => {
    await page.goto("/app/invoices");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("invoice-card")).toHaveCount(7);
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("$5,855.00"); // outstanding: 1850 + 625 + 2400 + 980
    await expect(summary).toContainText("$2,475.00"); // overdue: 1850 + 625

    const attention = page.getByRole("region", { name: "Needs attention" });
    await expect(attention).toContainText("INV-0041");
    await expect(attention).toContainText("10 days overdue");
    await expect(attention).not.toContainText("INV-0044"); // not due for 25 days

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Overdue" }).click();
    await expect(page.getByTestId("invoice-card")).toHaveCount(2);

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Sent (unpaid)" }).click();
    await expect(page.getByTestId("invoice-card")).toHaveCount(4); // includes overdue and due-soon
  });

  test("mark sent, mark paid and create the next recurring invoice", async ({ page }) => {
    await page.goto("/app/invoices");
    const draft = page.getByTestId("invoice-card").filter({ hasText: "INV-0045" });
    await draft.getByRole("button", { name: "Mark sent" }).click();
    await expect(page.getByRole("status")).toContainText("INV-0045 marked as sent");

    const overdue = page.getByTestId("invoice-card").filter({ hasText: "INV-0041" });
    await overdue.getByRole("button", { name: "Mark paid" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark paid" }).click();
    await expect(overdue.getByText("Paid", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Needs attention" })).not.toContainText("INV-0041");

    await overdue.getByRole("button", { name: "Create next" }).click();
    await expect(page.getByRole("status")).toContainText("Draft INV-0046");
    await expect(page.getByTestId("invoice-card")).toHaveCount(8);
  });

  test("create with validation, edit, void and delete", async ({ page }) => {
    await page.goto("/app/invoices");
    await page.getByRole("button", { name: "New invoice" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Invoice number")).toHaveValue(/^INV-\d{6}-\d{4}$/);
    const number = await dialog.getByLabel("Invoice number").inputValue();
    await dialog.getByRole("button", { name: "Create invoice" }).click();
    await expect(dialog.getByRole("alert").first()).toBeVisible();

    await dialog.getByLabel("Business name").fill("Sample Co");
    await dialog.getByLabel("Client", { exact: true }).fill("Globex Corp");
    await dialog.getByLabel("Description", { exact: true }).fill("Setup");
    await dialog.getByLabel("Rate", { exact: true }).fill("abc");
    await dialog.getByRole("button", { name: "Create invoice" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Enter a rate like 45.00");
    await dialog.getByLabel("Rate", { exact: true }).fill("1,250.50");
    await dialog.getByLabel("Tax rate (%)").fill("10");
    await expect(dialog.getByRole("list", { name: "Totals" }).or(dialog.getByLabel("Totals"))).toContainText("$1,375.55");
    await dialog.getByRole("button", { name: "Create invoice" }).click();

    // creating opens the invoice view
    const view = page.getByRole("dialog");
    await expect(view).toContainText("INVOICE");
    await expect(view).toContainText("Total Due:");
    await expect(view).toContainText("$1,375.55");
    const download = page.waitForEvent("download");
    await view.getByRole("button", { name: "Download invoice" }).click();
    expect((await download).suggestedFilename()).toMatch(/^invoice-INV-.*\.html$/);
    await view.getByRole("button", { name: "Close" }).click();
    await expect(view).toBeHidden();

    const card = page.getByTestId("invoice-card").filter({ hasText: "Globex Corp" });
    await expect(card).toContainText("$1,375.55");
    await expect(card.getByText("Draft", { exact: true })).toBeVisible();

    await card.getByRole("button", { name: `Edit ${number}` }).click();
    await page.getByRole("dialog").getByLabel("Client", { exact: true }).fill("Globex Inc");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("invoice-card").filter({ hasText: "Globex Inc" })).toBeVisible();

    await page.getByRole("button", { name: `Void ${number}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Void" }).click();
    const voided = page.getByTestId("invoice-card").filter({ hasText: "Globex Inc" });
    await expect(voided.getByText("Void", { exact: true })).toBeVisible();

    await voided.getByRole("button", { name: "Reopen" }).click();
    await expect(voided.getByText("Draft", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Void ${number}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Void" }).click();

    await page.getByRole("button", { name: `Delete ${number}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("invoice-card")).toHaveCount(7);
  });

  test("exports the filtered list as CSV", async ({ page }) => {
    await page.goto("/app/invoices");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^invoice-report-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await file.createReadStream();
    let text = "";
    for await (const chunk of stream) text += chunk;
    expect(text.split("\r\n")[0]).toBe("Number,Client,Description,Amount,Issued,Due,Status,Days overdue,Paid on,Recurrence");
    expect(text).toContain("INV-0041,Northwind Traders");
  });

  test("fits a phone screen without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/invoices");
    await expect(page.getByTestId("invoice-card").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/invoices");
    await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
