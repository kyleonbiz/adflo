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
