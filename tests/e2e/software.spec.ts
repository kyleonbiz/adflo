import { expect, test } from "./fixtures";

test.describe("Landing page and the app", () => {
  test("the site address shows the landing page, and /login Log in enters the demo app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your business administration, finally organized." })).toBeVisible();
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/app\/overview$/);
  });

  test("the landing page at / shows the hero, and Log in goes to the log in screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your business administration, finally organized." })).toBeVisible();
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Log in", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("the landing page keeps its hero and demo, and adds the story and demo request form below", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your business administration, finally organized." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AI does the repetitive work. Your people stay in control." })).toBeVisible();
    await page.getByRole("link", { name: "Book a demo" }).first().click();
    const form = page.getByRole("form", { name: "Request a demo" });
    await expect(form).toBeVisible();
    for (const label of ["Full name", "Business email", "Company name", "Company size", "Message"]) {
      await expect(form.getByLabel(label)).toBeVisible();
    }
  });

  test("the landing page shows the one plan and its price", async ({ page }) => {
    await page.goto("/");
    const pricing = page.locator("#pricing");
    await expect(pricing.getByRole("heading", { name: "One plan. Everything included." })).toBeVisible();
    await expect(pricing).toContainText("$99");
    await expect(pricing).toContainText("$10 a month each");
    await expect(pricing).toContainText("$990 a year");
    await expect(pricing).toContainText("$139 a month");
    await expect(pricing).toContainText("$300 to $500");
    await expect(pricing.getByRole("heading", { name: "Custom package" })).toBeVisible();
    await expect(pricing.getByRole("link", { name: "Request a custom quote" })).toBeVisible();
    await expect(pricing.getByRole("link", { name: "Start your free 3-day trial" })).toHaveAttribute("href", "/signup");
  });

  test("the demo request form sends to the server and confirms on the page", async ({ page }) => {
    let posted: Record<string, string> | null = null;
    await page.route("**/api/demo-request", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.goto("/");
    const form = page.getByRole("form", { name: "Request a demo" });
    await form.getByLabel("Full name").fill("Pat Lee");
    await form.getByLabel("Business email").fill("pat@example.com");
    await form.getByLabel("Company name").fill("Lee Co");
    await form.getByLabel("Company size").selectOption("1–10");
    await form.getByRole("button", { name: "Schedule your AdFlo demo" }).click();
    await expect(form.getByRole("status")).toContainText("We received your request");
    expect(posted).toMatchObject({ name: "Pat Lee", email: "pat@example.com", company: "Lee Co" });
  });

  test("the landing page has an admin cost calculator that works out the visitor's own numbers", async ({ page }) => {
    await page.goto("/");
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
    await expect(page.getByText("Welcome back. Log in to continue.")).toBeVisible();
  });
});
