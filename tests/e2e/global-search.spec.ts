import { expect, test } from "./fixtures";

test("the top bar search jumps to a service and fills in its own search", async ({ page }) => {
  await page.goto("/app/overview");
  const box = page.getByRole("combobox", { name: "Search Adflo" });
  await box.fill("projects");
  await page.getByRole("option", { name: /Search projects for/ }).click();
  await expect(page).toHaveURL(/\/app\/projects\?q=projects/);
  await expect(page.getByRole("textbox", { name: "Search projects" })).toHaveValue("projects");
});

test("the filter menu limits the search to one service", async ({ page }) => {
  await page.goto("/app/overview");
  await page.getByRole("button", { name: "Choose where to search" }).click();
  await page.getByRole("menuitem", { name: "Invoices" }).click();
  const box = page.getByRole("combobox", { name: "Search Adflo" });
  await expect(box).toHaveAttribute("placeholder", "Search Invoices");
  await box.fill("acme");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/app\/invoices\?q=acme/);
});

test("searching documents from the top bar fills in the document search", async ({ page }) => {
  await page.goto("/app/overview");
  await page.getByRole("combobox", { name: "Search Adflo" }).fill("lease");
  await page.getByRole("option", { name: /Search documents for/ }).click();
  await expect(page).toHaveURL(/\/app\?q=lease/);
  await expect(page.getByRole("searchbox")).toHaveValue("lease");
});

test("pressing / focuses the search box", async ({ page }) => {
  await page.goto("/app/overview");
  await page.locator("body").press("/");
  await expect(page.getByRole("combobox", { name: "Search Adflo" })).toBeFocused();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 360, height: 740 } });
  test("the search box sits under the top bar without sideways scrolling", async ({ page }) => {
    await page.goto("/app/overview");
    const box = page.getByRole("combobox", { name: "Search Adflo" });
    await expect(box).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await box.fill("vendors");
    await box.press("Enter");
    await expect(page).toHaveURL(/\/app\/vendors/);
  });
});

test("the notification bell opens and offers the dashboard", async ({ page }) => {
  await page.goto("/app/vendors");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByText("You're all caught up.")).toBeVisible();
  await page.getByRole("link", { name: "Open dashboard" }).click();
  await expect(page).toHaveURL(/\/app\/overview/);
});
