import { expect, test } from "./fixtures";

test.describe("sidebar sections", () => {
  test("Reporting opens to Reports, Scheduled reports and Materials, and each link goes there", async ({ page }) => {
    await page.goto("/app/reporting");
    const nav = page.getByRole("navigation", { name: "Services" });
    const sections = nav.getByRole("list", { name: "Reporting sections" });
    await expect(sections.getByRole("link", { name: "Reports", exact: true })).toHaveAttribute("aria-current", "location");
    await sections.getByRole("link", { name: "Materials" }).click();
    await expect(page).toHaveURL(/section=materials/);
    await expect(page.getByRole("combobox", { name: "Reporting section" })).toContainText("Materials");
    await expect(sections.getByRole("link", { name: "Materials" })).toHaveAttribute("aria-current", "location");
  });

  test("Tasks and Contacts have their own sections; single-screen services have none", async ({ page }) => {
    await page.goto("/app/projects");
    const nav = page.getByRole("navigation", { name: "Services" });
    await nav.getByRole("list", { name: "Tasks sections" }).getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("tab", { name: "Projects" })).toHaveAttribute("aria-selected", "true");
    await page.goto("/app/contacts");
    await nav.getByRole("list", { name: "Contacts sections" }).getByRole("link", { name: "Vendors" }).click();
    await expect(page).toHaveURL(/\/app\/vendors/);
    await expect(nav.getByRole("button", { name: /Invoices sections/ })).toHaveCount(0);
  });

  test("the arrow shows and hides the sections of a service you are not on", async ({ page }) => {
    await page.goto("/app/overview");
    const nav = page.getByRole("navigation", { name: "Services" });
    await expect(nav.getByRole("list", { name: "Reporting sections" })).toHaveCount(0);
    await nav.getByRole("button", { name: "Show Reporting sections" }).click();
    await expect(nav.getByRole("list", { name: "Reporting sections" })).toBeVisible();
    await nav.getByRole("button", { name: "Hide Reporting sections" }).click();
    await expect(nav.getByRole("list", { name: "Reporting sections" })).toHaveCount(0);
  });
});
