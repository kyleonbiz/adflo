import { expect, test } from "./fixtures";

test.describe("Landing page and the app", () => {
  test("the site address shows the landing page, and Open workspace goes into the app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your Business Operations. Under Control." })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Open workspace" }).click();
    await expect(page).toHaveURL(/\/app$/, { timeout: 30_000 });
  });

  test("the landing page covers the platform, the human and AI approach, and the footer links work", async ({ page }) => {
    await page.goto("/");
    for (const h of ["One Platform. Better-Controlled Operations.", "AI Does the Repetitive Work. Your People Stay in Control.", "More Organization. Less Administrative Overhead.", "Take Control of Your Business Operations."]) {
      await expect(page.getByRole("heading", { name: h })).toBeAttached();
    }
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test("the product showcase switches screens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Invoice tracking" }).click();
    await expect(page.getByRole("tab", { name: "Invoice tracking" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toContainText("#1042");
    await expect(page.getByText("Invoices stay open, then overdue")).toBeVisible();
  });

  test("the demo form checks its fields, and says plainly when demo requests are not switched on", async ({ page }) => {
    await page.goto("/");
    const form = page.getByRole("form", { name: "Book a demo" });
    await form.getByRole("button", { name: "Schedule your AdFlo demo" }).click();
    await expect(form.getByText("Enter your full name.")).toBeVisible();
    await form.getByLabel("Full name").fill("Ada Lovelace");
    await form.getByLabel("Business email").fill("ada@example.com");
    await form.getByLabel("Company name").fill("Analytical Co");
    await form.getByLabel("Company size").selectOption("11-50");
    await form.getByRole("button", { name: "Schedule your AdFlo demo" }).click();
    await expect(form.getByRole("alert")).toContainText("not switched on");
  });

  test("without a database it says so plainly and still works", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByText("Preview", { exact: true })).toBeVisible();
    await expect(page.getByText("Not configured")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("saved in this browser only");
  });

  test("Documents is the app's front page and starts empty, in the browser", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Document Management", exact: true })).toBeVisible();
    await expect(page.getByText("No documents yet")).toBeVisible();
    await expect(page.getByRole("note").filter({ hasText: "not saved or uploaded anywhere" })).toBeVisible();
  });

  test("old /demo links still work by redirecting into the app", async ({ request }) => {
    const cases: [string, string][] = [
      ["/demo", "/app/overview"], ["/demo/overview", "/app/overview"], ["/demo/invoices", "/app/invoices"],
      ["/demo/file-reset", "/app/file-reset"], ["/demo/documents", "/app"],
    ];
    for (const [from, to] of cases) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status(), from).toBe(308);
      expect(new URL(res.headers().location, "http://x").pathname, from).toBe(to);
    }
  });

  test("the old demo pages are really gone, and a redirect lands on a working page", async ({ page }) => {
    await page.goto("/demo/vendors");
    await expect(page).toHaveURL(/\/app\/vendors$/);
    await expect(page.getByRole("heading", { level: 1, name: "Vendors" })).toBeVisible();
  });

  test("the sign-in page is still there for when a database is connected", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Access your AdFlo workspace.")).toBeVisible();
  });
});
