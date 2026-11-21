import { expect, test } from "./fixtures";
import type { Page } from "@playwright/test";

/** For each saved service: delete the first item, reload, leave and come back. It must stay deleted. */
async function deleteStays(page: Page, path: string, card: string, deleteButton: (first: ReturnType<Page["locator"]>) => ReturnType<Page["locator"]>, confirm = "Delete") {
  await page.goto(path);
  const items = page.getByTestId(card);
  await expect(items.first()).toBeVisible();
  const before = await items.count();
  await deleteButton(items.first()).click();
  await page.getByRole("dialog").getByRole("button", { name: confirm, exact: true }).click();
  await expect(items).toHaveCount(before - 1);
  await page.reload();
  await expect(items.first()).toBeVisible();
  await expect(items).toHaveCount(before - 1);
  await page.goto("/app/overview");
  await page.goto(path);
  await expect(items.first()).toBeVisible();
  await expect(items).toHaveCount(before - 1);
}

test.describe("deleted items stay deleted", () => {
  test("licenses", async ({ page }) => deleteStays(page, "/app/licenses", "license-card", (c) => c.getByRole("button", { name: /^Delete / })));
  test("vendors", async ({ page }) => deleteStays(page, "/app/vendors", "vendor-card", (c) => c.getByRole("button", { name: /^Delete / })));
  test("contacts", async ({ page }) => deleteStays(page, "/app/contacts", "contact-row", (c) => c.getByRole("button", { name: /^Delete / })));
  test("invoices", async ({ page }) =>
    deleteStays(page, "/app/invoices", "invoice-card", (c) => {
      // Delete lives in the card's More menu.
      return { click: async () => { await c.getByRole("button", { name: /^More actions for / }).click(); await page.getByRole("menuitem", { name: "Delete" }).click(); } } as never;
    }));
});
