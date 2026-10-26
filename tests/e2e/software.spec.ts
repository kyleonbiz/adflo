import { expect, test } from "@playwright/test";

test.describe("AdFlo opens as software, not a website", () => {
  test("the site address goes straight into the app, on the Home screen with the sidebar", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/app\/overview$/);
    await expect(page).toHaveTitle("Home · AdFlo");
    await expect(page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1, name: "Your back office" })).toBeVisible();
    await expect(page.getByTestId("dashboard")).toBeVisible();
  });

  test("there is no marketing page: no pitch, no demo labels, no sign-up detour", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Your back office, in one place.")).toHaveCount(0);
    await expect(page.getByText("Try the demo")).toHaveCount(0);
    await expect(page.getByText("Open workspace")).toHaveCount(0);
    await expect(page.getByText("Demo", { exact: true })).toHaveCount(0);
  });

  test("without a database it says so plainly and still works", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByText("Preview · sample data")).toBeVisible();
    await expect(page.getByText("Not configured")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Services" }).getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
  });

  test("Documents is the app's front page and runs on sample data in the browser", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("heading", { name: "Document Management", exact: true })).toBeVisible();
    await expect(page.getByTestId("document-card").first()).toBeVisible();
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
