import { expect, test } from "@playwright/test";

// Without a database the Control Center opens as a read-only preview with labelled sample clients.
test("control center preview: overview, clients and audit log open", async ({ page }) => {
  await page.goto("/control");
  await expect(page.getByRole("heading", { name: "Control Center" })).toBeVisible();
  await expect(page.getByText("Preview", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Control Center" })).toBeVisible();

  await page.getByRole("link", { name: "Clients" }).first().click();
  await expect(page).toHaveURL(/\/control\/clients$/, { timeout: 30_000 }); // the first visit compiles the page in dev
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
  await expect(page.getByText("Terms of Service")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

  await page.getByRole("link", { name: "Plans & pricing" }).first().click();
  await expect(page.getByRole("heading", { name: "Plans & pricing" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("cell", { name: "pro" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add plan" })).toHaveCount(0);

  await page.getByRole("link", { name: "Team" }).first().click();
  await expect(page.getByText("Sample Owner")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Add to team" })).toHaveCount(0);

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
  expect((await request.post("/api/control/staff", { data: { email: "a@b.co", role: "support" } })).status()).toBe(503);
  expect((await request.post("/api/control/clients/00000000-0000-4000-8000-000000000000/checklist", { data: { step: "workspace", done: true } })).status()).toBe(503);
});

test("agreement link with an unknown secret shows a plain not-valid page, and public accept refuses bad input", async ({ page, request }) => {
  await page.goto(`/agreement/${"A".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible({ timeout: 30_000 });
  expect((await request.post("/api/agreement/accept", { data: { token: "x" } })).status()).toBe(503);
});
