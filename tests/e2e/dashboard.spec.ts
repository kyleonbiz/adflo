import { expect, test } from "./fixtures";

test.describe("dashboard", () => {
  test("shows three cards that link through, the charts, and today's to-do list", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByTestId("workload")).toBeVisible();
    await expect(page.getByTestId("upcoming")).toBeVisible();
    await expect(page.getByTestId("progress")).toContainText("ALL CLEAR");
    await expect(page.getByTestId("today-todos")).toBeVisible();
    await page.getByRole("link", { name: /Outstanding invoices/ }).click();
    await expect(page).toHaveURL(/\/app\/invoices$/);
  });

  test("Add new entry opens the matching form", async ({ page }) => {
    const add = async (item: string) => {
      await page.goto("/app/overview");
      await page.getByRole("button", { name: "Add new entry" }).click();
      await page.getByRole("menuitem", { name: item }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 }); // the first visit to a page compiles it in development
    };
    await add("New invoice");
    await expect(page).toHaveURL(/\/app\/invoices\?new=1$/);
    await add("Upload document");
  });

  test("the menu can be minimized to icons and expanded again", async ({ page }) => {
    await page.goto("/app/overview");
    const nav = page.getByRole("navigation", { name: "Services" });
    const home = nav.getByRole("link", { name: "Dashboard", exact: true });
    await expect(home).toHaveText("Dashboard");
    await page.getByRole("button", { name: "Minimize menu" }).click();
    await expect(nav).toBeVisible();
    await expect(home).toHaveText("");
    await expect.poll(async () => (await home.boundingBox())!.width).toBeLessThan(80); // after the width transition
    await page.reload();
    await expect(page.getByRole("button", { name: "Expand menu" })).toBeVisible(); // remembered
    await page.getByRole("button", { name: "Expand menu" }).click();
    await expect(home).toHaveText("Dashboard");
  });

  test.describe("with no records", () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => { (window as unknown as { __E2E_SEED__: unknown }).__E2E_SEED__ = {}; });
    });

    test("the Licenses & renewals tab opens and the Overview comes back", async ({ page }) => {
      await page.goto("/app/overview");
      await page.getByRole("tab", { name: "Licenses & renewals" }).click();
      await expect(page.getByTestId("licenses-tab")).toContainText("No licenses tracked yet");
      await page.getByRole("link", { name: "Start from a template" }).click();
      await expect(page).toHaveURL(/\/app\/licenses$/);
      await page.goto("/app/overview");
      await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    });

    test("starts empty: zeros, nothing needing attention, and an empty to-do list", async ({ page }) => {
      await page.goto("/app/overview");
      await expect(page.getByRole("link", { name: /Outstanding invoices/ })).toContainText("$0.00");
      await expect(page.getByRole("link", { name: /Needs attention/ })).toContainText("All clear");
      await expect(page.getByTestId("attention")).toContainText("You are all caught up.");
      await expect(page.getByTestId("today-todos")).toContainText("No to-dos yet");
    });

    test("an invoice you create is still there after leaving the page, and the Dashboard and the bell reflect it", async ({ page }) => {
      await page.goto("/app/invoices");
      await page.getByRole("button", { name: "New invoice" }).first().click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Business name").fill("Sample Co");
      await dialog.getByLabel("Client", { exact: true }).fill("Globex Corp");
      await dialog.getByLabel("Description", { exact: true }).fill("Setup");
      await dialog.getByLabel("Rate", { exact: true }).fill("1,250.50");
      await dialog.getByLabel("Issued on").fill("2020-01-01");
      await dialog.getByLabel("Due on").fill("2020-01-15");
      await dialog.getByRole("button", { name: "Create invoice" }).click();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("invoice-card")).toHaveCount(1);
      // Only sent invoices count as outstanding.
      await page.getByRole("button", { name: /^More actions for / }).click();
      await page.getByRole("menuitem", { name: "Mark sent" }).click();

      await page.reload();
      await expect(page.getByTestId("invoice-card")).toHaveCount(1);

      await page.goto("/app/overview");
      await expect(page.getByRole("link", { name: /Outstanding invoices/ })).not.toContainText("$0.00");
      await expect(page.getByTestId("attention")).toContainText("Globex Corp");
    });
  });
});
