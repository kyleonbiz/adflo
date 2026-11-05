import { expect, test } from "@playwright/test";

// Without a database the Control Center opens as a read-only preview with labelled sample clients.
test("control center preview: overview, clients and audit log open", async ({ page }) => {
  test.setTimeout(180_000); // a cold dev server compiles each of these pages on first visit
  await page.goto("/control");
  await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Control Center" })).toBeVisible();

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
  await expect(page.getByRole("cell", { name: "business" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("link", { name: "Appearance" })).toHaveCount(0);
  });
});

test("billing: create, send and pay an invoice by hand, saved in this browser, export CSV", async ({ page }) => {
  await page.goto("/control/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "AF-0003", exact: true })).toBeVisible(); // labelled examples on first visit

  // The overdue example is counted and flagged.
  await page.getByRole("button", { name: /^Overdue/ }).click();
  await expect(page.getByRole("cell", { name: "AF-0003", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "AF-0002", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^All/ }).click();

  // A bad form is refused with reasons.
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Describe what this is for")).toBeVisible();
  await expect(page.getByText("Enter an amount above $0")).toBeVisible();

  // A good one becomes the next number, as a draft.
  await page.getByLabel("What it is for").fill("Custom setup day");
  await page.getByLabel("Amount ($)").fill("1,200.50");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("cell", { name: "AF-0004", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "$1,200.50", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Mark AF-0004 sent" }).click();
  await page.getByRole("button", { name: "Mark AF-0004 paid" }).click();
  await page.getByRole("button", { name: "Mark paid", exact: true }).click();
  await expect(page.getByRole("row", { name: /AF-0004/ })).toContainText("Paid");

  // It is still there after a reload (and the examples did not come back over it).
  await page.reload();
  await expect(page.getByRole("row", { name: /AF-0004/ })).toContainText("Paid");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^adflo-invoices-\d{4}-\d{2}-\d{2}\.csv$/);
});
