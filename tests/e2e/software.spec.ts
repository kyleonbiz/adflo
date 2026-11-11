import { expect, test } from "./fixtures";

test.describe("Landing page and the app", () => {
  test("the site address goes straight into the app", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/app\/overview$/);
  });

  test("the landing page at /landing shows the hero, and Open workspace goes into the app", async ({ page }) => {
    await page.goto("/landing");
    await expect(page.getByRole("heading", { level: 1, name: "Your back office, in one place" })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Open workspace" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("the landing page keeps its hero and demo, and adds the story and demo request form below", async ({ page }) => {
    await page.goto("/landing");
    await expect(page.getByRole("heading", { level: 1, name: "Your back office, in one place" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI does the repetitive work. Your people stay in control." })).toBeVisible();
    await page.getByRole("link", { name: "Book a demo" }).first().click();
    const form = page.getByRole("form", { name: "Request a demo" });
    await expect(form).toBeVisible();
    for (const label of ["Full name", "Business email", "Company name", "Company size", "Message"]) {
      await expect(form.getByLabel(label)).toBeVisible();
    }
  });

  test("the landing page has an admin cost calculator that works out the visitor's own numbers", async ({ page }) => {
    await page.goto("/landing");
    const section = page.locator("#admin-cost");
    await expect(section.getByRole("heading", { name: "How much time are you losing to admin work?" })).toBeVisible();
    // 10 hours a week at $100 an hour, 48 weeks: $48,000; 40% freed, half of it used: $9,600.
    await expect(section.getByTestId("admin-cost-annual")).toContainText("$48,000");
    await expect(section.getByTestId("admin-cost-recoverable")).toContainText("$9,600");

    await section.getByLabel("Hours a week on admin").fill("10");
    await section.getByLabel("Your hourly value ($)").fill("200");
    await expect(section.getByTestId("admin-cost-annual")).toContainText("$96,000");
    await expect(section.getByTestId("admin-cost-recoverable")).toContainText("$19,200");

    await section.getByText("My team’s time").click();
    await expect(section.getByLabel("Team hours a week on admin")).toBeVisible();

    await section.getByLabel("Team hours a week on admin").fill("");
    await expect(section.getByTestId("admin-cost-result")).toContainText("your numbers will appear here");

    await section.getByRole("link", { name: "See how AdFlo gets that time back" }).click();
    await expect(page.getByRole("form", { name: "Request a demo" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Log in to your account" })).toBeVisible();
    await expect(page.getByText("Access your AdFlo workspace.")).toBeVisible();
  });
});
