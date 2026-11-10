import { expect, test } from "./fixtures";

test.describe("sample data", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { (window as unknown as { __E2E_SEED__: unknown }).__E2E_SEED__ = {}; });
  });

  test("an empty Dashboard offers sample sets; loading one fills every service, and clearing returns to blank", async ({ page }) => {
    await page.goto("/app/overview");
    const picker = page.getByTestId("sample-picker");
    await expect(picker).toContainText("Small shop");
    await expect(picker).toContainText("Large regulated company");

    await page.getByTestId("sample-large").getByRole("button", { name: /Load large regulated company sample/ }).click();
    await expect(page.getByTestId("sample-loaded")).toContainText("sample data");
    await expect(page.getByTestId("sample-picker")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).not.toContainText("$0.00");
    await expect(page.getByTestId("attention-item").first()).toBeVisible();

    await page.goto("/app/vendors");
    await expect(page.getByTestId("vendor-card").first()).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("vendor-card").first()).toBeVisible(); // still there after a reload

    await page.goto("/app/overview");
    await page.getByRole("button", { name: "Clear sample data" }).click();
    await expect(page.getByTestId("sample-picker")).toBeVisible();
    await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$0.00");
  });

  test("Settings > Demo data loads the small set and asks before replacing saved records", async ({ page }) => {
    await page.goto("/app/setup?tab=demo");
    await page.getByTestId("sample-small").getByRole("button", { name: /Load small shop sample/ }).click();
    await page.goto("/app/invoices");
    await expect(page.getByTestId("invoice-card")).toHaveCount(5);

    await page.goto("/app/setup?tab=demo");
    await page.getByTestId("sample-large").getByRole("button", { name: /Load large regulated company sample/ }).click();
    await expect(page.getByText("This replaces the records you have saved.")).toBeVisible();
    await page.getByRole("button", { name: "Replace my records" }).click();
    await page.goto("/app/invoices");
    await expect(page.getByTestId("invoice-card").first()).toBeVisible();
    expect(await page.getByTestId("invoice-card").count()).toBeGreaterThan(5);

    await page.goto("/app/setup?tab=demo");
    await page.getByRole("button", { name: "Clear sample data" }).click();
    await page.getByRole("button", { name: "Yes, clear everything" }).click();
    await page.goto("/app/invoices");
    await expect(page.getByTestId("invoice-card")).toHaveCount(0);
  });
});
