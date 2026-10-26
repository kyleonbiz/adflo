import { expect, test, type Page } from "@playwright/test";

const MODULE_NAMES = [
  "Documents", "Invoices", "Licenses & Renewals", "Vendors", "CRM & Data", "Projects", "Forms & Paperwork",
  "Data Entry & Reporting", "Admin Support", "Business File Reset", "Back Office Setup",
];
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("landing page", () => {
  test("says what AdFlo is and offers the two obvious next steps", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("AdFlo · Your back office in one place");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your back office, in one place.");
    await expect(page.getByText("AdFlo turns the paperwork, invoices, renewals and projects")).toBeVisible();
    await expect(page.getByText("No sign-up. The demo runs on sample data in your browser.")).toBeVisible();
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /Try the demo/ }).first()).toHaveAttribute("href", "/demo/overview");
    await expect(main.getByRole("link", { name: "Explore the modules" })).toHaveAttribute("href", "#modules");
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", "/app");
    await expect(page.getByRole("navigation", { name: "Modules" })).toHaveCount(0); // the sidebar belongs inside the product, not here
  });

  test("shows all eleven modules, each linking into its demo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "Eleven modules, one place" })).toBeVisible();
    const cards = page.getByTestId("module-card");
    const card = (name: string) => cards.filter({ has: page.getByText(name, { exact: true }) });
    await expect(cards).toHaveCount(11);
    for (const name of MODULE_NAMES) await expect(card(name)).toHaveCount(1);
    await expect(card("Invoices")).toHaveAttribute("href", "/demo/invoices");
    await expect(card("Documents")).toHaveAttribute("href", "/demo/documents");
    await expect(card("Business File Reset")).toHaveAttribute("href", "/demo/file-reset");

    await card("Vendors").click();
    await expect(page).toHaveURL(/\/demo\/vendors$/);
    await expect(page.getByRole("heading", { level: 1, name: "Vendors" })).toBeVisible();
  });

  test("every module card goes to a page that exists", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.getByTestId("module-card").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
    expect(new Set(hrefs).size).toBe(11);
    for (const href of hrefs) expect((await request.get(href!)).status(), href!).toBe(200);
  });

  test("explains how it works and how it stays careful", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("how-step")).toHaveCount(3);
    await expect(page.getByTestId("how-step").first()).toContainText("Tell us about your business");
    await expect(page.getByTestId("principle")).toHaveCount(4);
    await expect(page.getByTestId("principle").first()).toContainText("It never deletes");
    await expect(page.getByTestId("preview-note")).toContainText("nothing is saved yet");
  });

  test("the nav and hero links jump to their sections", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/#how$/);
    await expect(page.getByRole("heading", { name: "Up and running in three steps" })).toBeInViewport();
    await page.goto("/");
    await page.getByRole("link", { name: "Explore the modules" }).click();
    await expect(page.getByRole("heading", { name: "Eleven modules, one place" })).toBeInViewport();
  });

  test("the live document demo still works on the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Try the document manager right here" })).toBeVisible();
    await expect(page.getByTestId("document-card").first()).toBeVisible();
    await page.getByRole("searchbox").fill("northwind");
    await expect(page.getByTestId("document-card")).toHaveCount(1);
    await page.getByRole("link", { name: "See all the modules in the demo" }).click();
    await expect(page).toHaveURL(/\/demo\/overview$/);
  });

  test("keeps the company line in the footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("contentinfo")).toContainText("Aurum Ventura Enterprise LLC · Business Administrative Services");
  });

  for (const [name, width] of [["phone", 360], ["tablet", 820], ["laptop", 1280]] as const) {
    test(`fits a ${name} screen without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.getByTestId("module-card").first()).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      const box = await page.getByRole("link", { name: /Try the demo/ }).first().boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    });
  }
});
