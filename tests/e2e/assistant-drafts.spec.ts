import { expect, test } from "./fixtures";

test.describe("assistant drafts", () => {
  test("a draft link opens the form with the details in, and nothing is saved until you save", async ({ page }) => {
    await page.goto("/app/invoices?new=1&client=Acme%20Co&clientEmail=ap%40acme.example&amount=250&dueOn=2027-01-15&recurrence=monthly");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Client", { exact: true })).toHaveValue("Acme Co");
    await expect(dialog.getByLabel(/Client email/i)).toHaveValue("ap@acme.example");
    await expect(dialog.getByLabel("Due on")).toHaveValue("2027-01-15");
    await expect(page.getByTestId("invoice-card").filter({ hasText: "Acme Co" })).toHaveCount(0);
  });

  test("values that look like card numbers or are not valid are left out of a typed link", async ({ page }) => {
    await page.goto("/app/contacts?add=1&name=Sam%20Ito&email=not-an-email&phone=4111111111111111");
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name")).toHaveValue("Sam Ito");
    await expect(dialog.getByLabel("Email")).toHaveValue("");
    await expect(dialog.getByLabel("Phone")).toHaveValue("");
  });

  test("a vendor draft never carries a tax ID, and requests, projects and licenses open prefilled", async ({ page }) => {
    await page.goto("/app/vendors?new=1&name=Blue%20Ridge&email=orders%40blueridge.example&taxId=12-3456789");
    await expect(page.getByRole("dialog").getByLabel("Vendor name")).toHaveValue("Blue Ridge");
    await expect(page.getByRole("dialog").getByLabel(/Tax ID/)).toHaveValue("");

    await page.goto("/app/admin?new=1&title=Order%20toner&priority=low");
    await expect(page.getByRole("dialog").getByLabel("Title")).toHaveValue("Order toner");

    await page.goto("/app/projects?new=1&name=Spring%20cleanup&client=Acme");
    await expect(page.getByRole("dialog").getByLabel("Project name")).toHaveValue("Spring cleanup");

    await page.goto("/app/licenses?new=1&name=Food%20permit&issuer=County%20Health");
    await expect(page.getByRole("dialog").getByLabel("License name")).toHaveValue("Food permit");
    await expect(page.getByRole("dialog").getByLabel("Issuing authority")).toHaveValue("County Health");
  });

  test("without the AI model, asking for a new invoice opens the blank form and refuses deleting", async ({ page }) => {
    await page.goto("/app/assistant");
    const box = page.getByLabel("Message the assistant");
    await box.fill("create a new invoice");
    await box.press("Enter");
    const link = page.getByRole("link", { name: "Open a draft invoice" });
    await expect(link).toBeVisible();
    await box.fill("delete all my invoices");
    await box.press("Enter");
    await expect(page.getByTestId("assistant-log")).toContainText("never delete, approve, pay or send");
    await link.click();
    await expect(page).toHaveURL(/\/app\/invoices\?new=1$/);
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
