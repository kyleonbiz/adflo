import { expect, test } from "@playwright/test";

// Without a database the Control center opens as a read-only preview with labelled sample clients.
test("control center preview: overview, clients and audit log open", async ({ page }) => {
  test.setTimeout(180_000); // a cold dev server compiles each of these pages on first visit
  await page.goto("/control");
  await expect(page.getByRole("heading", { name: "Control center" })).toBeVisible();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Control center" })).toBeVisible();

  // A cold dev server can drop a click that lands before hydration, so retry the first click until it navigates.
  await expect(async () => {
    await page.getByRole("link", { name: "Clients" }).first().click();
    await expect(page).toHaveURL(/\/control\/clients$/, { timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("cell", { name: "Sample: Acme Roofing" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add client" })).toHaveCount(0); // the preview cannot change anything

  await page.getByLabel("Search clients").fill("birch");
  await expect(page.getByRole("cell", { name: "Sample: Acme Roofing" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "Sample: Birch & Co" })).toBeVisible();

  await page.getByRole("link", { name: "Support" }).first().click();
  await expect(page.getByText("Cannot upload a PDF")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "New ticket" })).toHaveCount(0);

  await page.getByRole("link", { name: "Agreements" }).first().click();
  await expect(page.getByRole("heading", { name: "Agreements" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Terms of Service").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

  await page.getByRole("link", { name: "Plans & pricing" }).first().click();
  await expect(page.getByRole("heading", { name: "Plans & pricing" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "adflo", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add plan" })).toHaveCount(0);

  await page.getByRole("link", { name: "Team" }).first().click();
  await expect(page.getByText("Sample Owner")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Add to team" })).toHaveCount(0);

  await page.getByRole("link", { name: "Monitoring" }).first().click();
  await expect(page.getByRole("heading", { name: "Monitoring" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Answered in 42 ms.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark resolved" })).toHaveCount(0);

  await page.getByRole("link", { name: "Audit log" }).first().click();
  await expect(page.getByText("Nothing to show in the preview")).toBeVisible({ timeout: 30_000 });
});

test("control center API refuses writes without a database", async ({ request }) => {
  const res = await request.post("/api/control/clients", { data: { name: "Nope Co" } });
  expect(res.status()).toBe(503);
});

test("control center API refuses plan, team and checklist writes without a database", async ({ request }) => {
  expect((await request.post("/api/control/plans", { data: { name: "x" } })).status()).toBe(503);
  expect((await request.post("/api/control/tickets", { data: { subject: "x" } })).status()).toBe(503);
  expect((await request.post("/api/control/password-reset", { data: { email: "a@b.co" } })).status()).toBe(503);
  expect((await request.post("/api/control/agreements", { data: { title: "x", body: "y" } })).status()).toBe(503);
  expect((await request.post("/api/control/agreements/send", { data: {} })).status()).toBe(503);
  expect((await request.patch("/api/control/errors/1", { data: { resolved: true } })).status()).toBe(503);
  expect((await request.post("/api/control/staff", { data: { email: "a@b.co", role: "support" } })).status()).toBe(503);
  expect((await request.post("/api/control/clients/00000000-0000-4000-8000-000000000000/workspace", { data: { action: "provision" } })).status()).toBe(503);
  expect((await request.post("/api/control/clients/00000000-0000-4000-8000-000000000000/checklist", { data: { step: "workspace", done: true } })).status()).toBe(503);
});

test("agreements page shows a published agreement with headings and lists", async ({ page }) => {
  await page.goto("/control/agreements");
  await expect(page.getByRole("heading", { name: "Agreements", level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByText("v2 ·").click(); // open the sample agreement
  const published = page.getByRole("region", { name: "Published" });
  await expect(published.getByRole("heading", { name: "What you agree to" })).toBeVisible();
  const bullets = published.locator("ul ul");
  await expect(bullets.getByRole("listitem")).toHaveText(["Pay invoices when they are due", "Keep your account details up to date"]);
  await expect(published.locator("ol").getByRole("listitem")).toHaveText(["Read the terms", "Tick both boxes and accept"]);
});

const FAKE_LINK = `/agreement/${"FAKE".repeat(10)}FAK`;

test("client agreement page: formatted text, both boxes required, then accepted once", async ({ page, request }) => {
  await request.post("/api/agreement/accept", { data: { token: "FAKE".repeat(10) + "FAK", reset: true } });
  await page.goto(FAKE_LINK);
  await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Prepared for Sample: Acme Roofing")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What you agree to" })).toBeVisible();
  await expect(page.locator("ul").getByRole("listitem")).toHaveText(["Pay invoices when they are due", "Keep your account details up to date"]);
  await expect(page.locator("ol").getByRole("listitem")).toHaveText(["Read the terms", "Tick both boxes and accept"]);

  // Nothing filled in: every problem is named.
  await page.getByRole("button", { name: "Accept agreement" }).click();
  await expect(page.getByText("Enter your full name.")).toBeVisible();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(page.getByText("Tick both boxes to continue.")).toBeVisible();

  // One box is not enough.
  await page.getByLabel("Your full name").fill("Pat Lee");
  await page.getByLabel("Your email").fill("pat@example.com");
  await page.getByLabel("I have read and understood this agreement.").check();
  await page.getByRole("button", { name: "Accept agreement" }).click();
  await expect(page.getByText("Tick both boxes to continue.")).toBeVisible();

  await page.getByLabel(/I am authorized to accept it/).check();
  await page.getByRole("button", { name: "Accept agreement" }).click();
  await expect(page.getByText("Thank you. Your acceptance is recorded.")).toBeVisible();

  // The link now shows who accepted, with no form; a second accept is refused.
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Accepted by Pat Lee");
  await expect(page.getByRole("button", { name: "Accept agreement" })).toHaveCount(0);
  const again = await request.post("/api/agreement/accept", { data: { token: "FAKE".repeat(10) + "FAK", name: "Sam Roe", email: "sam@example.com", agree: true } });
  expect(again.status()).toBe(409);
});

test("agreement link with an unknown secret shows a plain not-valid page, and public accept refuses bad input", async ({ page, request }) => {
  await page.goto(`/agreement/${"A".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible({ timeout: 30_000 });
  expect((await request.post("/api/agreement/accept", { data: { token: "x" } })).status()).toBe(503);
});

test.describe("on a device set to dark mode", () => {
  test.use({ colorScheme: "dark" });
  test("control center is always Day and has no Appearance switch", async ({ page }) => {
    await page.goto("/control");
    await expect(page.getByRole("heading", { name: "Control center" })).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("link", { name: "Appearance" })).toHaveCount(0);
  });
});

test("billing: the same invoice screen as the client app, with a client picker, saved in this browser, export CSV", async ({ page }) => {
  await page.goto("/control/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expect(page.getByTestId("invoice-card")).toHaveCount(3); // labelled examples on first visit
  await expect(page.getByTestId("invoice-card").filter({ hasText: "INV-261003-1003" })).toContainText("Overdue");

  // A bad form is refused with reasons.
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("dialog").getByRole("alert").first()).toBeVisible();

  // Choosing an AdFlo client fills in their name and owner email; AdFlo is the sender.
  await page.getByLabel("AdFlo client").selectOption({ label: "Sample: Birch & Co" });
  await expect(page.getByLabel("Client", { exact: true })).toHaveValue("Sample: Birch & Co");
  await expect(page.getByLabel("Business name")).toHaveValue("AdFlo");
  await page.locator("#inv-item-0-description").fill("Custom setup day");
  await page.locator("#inv-item-0-rate").fill("1200.50");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("status")).toContainText("created as a draft");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("invoice-card")).toHaveCount(4);
  await expect(page.getByTestId("invoice-card").filter({ hasText: "Custom setup day" })).toContainText("$1,200.50");

  // It is still there after a reload (and the examples did not come back over it).
  await page.reload();
  await expect(page.getByTestId("invoice-card")).toHaveCount(4);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^invoice-report-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("client profile: everything about a client in one place, and New invoice opens for that client", async ({ page }) => {
  await page.goto("/control/clients");
  await page.getByRole("link", { name: "Sample: Acme Roofing" }).click();
  await expect(page.getByRole("heading", { name: "Sample: Acme Roofing", level: 1 })).toBeVisible();

  // The summary, the jump links and each section.
  await expect(page.getByText("Per month · standard")).toBeVisible();
  await expect(page.getByText("Open tickets")).toBeVisible();
  const jump = page.getByRole("navigation", { name: "On this page" });
  for (const name of ["Account", "Onboarding", "Billing", "Agreements", "Support", "History"]) await expect(jump.getByRole("link", { name })).toBeVisible();
  // The onboarding guide: eight steps, the finished ones ticked, each with instructions.
  const guide = page.getByRole("region", { name: "Onboarding" });
  await expect(guide.getByRole("heading", { name: "Onboarding guide" })).toBeVisible();
  await expect(guide).toContainText("8 of 8 done");
  await expect(guide.getByRole("checkbox", { checked: true })).toHaveCount(8);
  await guide.getByRole("button", { name: /Step 2.*Workspace created/ }).click();
  await expect(guide.getByText("Click Create workspace and invite owner")).toBeVisible();
  await expect(guide.getByRole("link", { name: "Go to AdFlo account" })).toHaveAttribute("href", "#account");
  await expect(page.getByRole("region", { name: "AdFlo account" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tickets" })).toContainText("Cannot upload a PDF");

  // This client's invoices only (the examples have two for Acme and one for Birch).
  const billing = page.getByRole("region", { name: "Billing" });
  await expect(billing.getByText("INV-261001-1001")).toBeVisible();
  await expect(billing.getByText("INV-261003-1003")).toHaveCount(0);

  // Read-only staff and the preview see no status switch.
  await expect(page.getByRole("switch", { name: "Account on" })).toHaveCount(0);

  // New invoice goes to Billing with this client already chosen.
  await billing.getByRole("link", { name: "New invoice" }).click();
  await expect(page.getByRole("heading", { name: "New invoice" })).toBeVisible();
  await expect(page.getByLabel("AdFlo client")).toHaveValue("sample-1");
  await expect(page.locator("#inv-item-0-rate")).toHaveValue("99.00");
});

test("onboarding tab: every client's setup progress, stalled ones flagged, rows open the profile", async ({ page }) => {
  await page.goto("/control");
  await page.getByRole("navigation", { name: "Control center" }).getByRole("link", { name: "Onboarding" }).click();
  await expect(page).toHaveURL(/\/control\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Onboarding", level: 1 })).toBeVisible();
  await expect(page.getByText("Being set up")).toBeVisible();

  // The sample trial client is not finished, so it is listed under "In progress" with its next step.
  const birch = page.getByRole("link", { name: /Sample: Birch & Co/ });
  await expect(birch).toBeVisible();
  await expect(birch).toContainText("Next: Terms and agreement sent");
  await expect(birch).toContainText("3 of 8");
  // The fully set up one only shows under Complete.
  await expect(page.getByRole("link", { name: /Sample: Acme Roofing/ })).toHaveCount(0);
  await page.getByRole("button", { name: /^Complete/ }).click();
  await expect(page.getByRole("link", { name: /Sample: Acme Roofing/ })).toContainText("All steps done");

  await page.getByRole("button", { name: /^In progress/ }).click();
  await birch.click();
  await expect(page).toHaveURL(/\/control\/clients\/sample-2#onboarding$/);
  await expect(page.getByRole("heading", { name: "Sample: Birch & Co", level: 1 })).toBeVisible();
});

test("staff sign-in page: with no database there is nobody to sign in, so it opens the page asked for", async ({ page }) => {
  await page.goto("/control/login?next=/control/billing");
  await expect(page).toHaveURL(/\/control\/billing$/);
  await expect(page.getByRole("heading", { name: "Billing", level: 1 })).toBeVisible();
});

test("staff sign-in page: a return path outside the Control center is ignored", async ({ page }) => {
  await page.goto("/control/login?next=/app/overview");
  await expect(page).toHaveURL(/\/control$/);
  await expect(page.getByRole("heading", { name: "Control center", level: 1 })).toBeVisible();
});

test("control center preview: the industries page lists every industry with switches the preview cannot change", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/control/industries");
  await expect(page.getByRole("heading", { name: "Industries" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("industry-row")).toHaveCount(17);
  await expect(page.getByRole("switch", { name: "Construction & trades open to new sign-ups" })).toBeDisabled();
  await expect(page.getByText("Sample view")).toBeVisible();
});

test("control center preview: the sales and revenue counter shows revenue against the goal and lets you change the goal", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/control");
  await expect(async () => {
    await page.getByRole("navigation", { name: "Control center" }).getByRole("link", { name: "Sales & revenue" }).click();
    await expect(page).toHaveURL(/\/control\/sales$/, { timeout: 4_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Sales & revenue", level: 1 })).toBeVisible();
  const goal = page.getByRole("region", { name: "Revenue goal" });
  await expect(goal.getByText("of $10,000 a month")).toBeVisible();
  await expect(goal.getByRole("progressbar", { name: "Progress to the monthly revenue goal" })).toBeVisible();

  await goal.getByLabel("Monthly goal (dollars)").fill("abc");
  await goal.getByRole("button", { name: "Set goal" }).click();
  await expect(goal.getByRole("alert")).toContainText("Enter a goal in dollars");
  await goal.getByLabel("Monthly goal (dollars)").fill("5,000");
  await goal.getByRole("button", { name: "Set goal" }).click();
  await expect(goal.getByText("of $5,000 a month")).toBeVisible();
});
