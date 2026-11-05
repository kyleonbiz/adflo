import { expect, test } from "./fixtures";

/** With nothing added, each module explains itself and offers the first step instead of opening bare. */
const CASES: { path: string; title: string; action: string; opens: RegExp | string }[] = [
  { path: "/app/invoices", title: "Send your first invoice", action: "New invoice", opens: "dialog" },
  { path: "/app/licenses", title: "Track your first license", action: "Start from a template", opens: "dialog" },
  { path: "/app/vendors", title: "Add your first vendor", action: "Add vendor", opens: "dialog" },
  { path: "/app/projects?view=projects", title: "Start your first project", action: "Create your first project", opens: "dialog" },
  { path: "/app/contacts", title: "Build your contact list", action: "Add your first contact", opens: "dialog" },
];

test.describe("empty states", () => {
  for (const c of CASES) {
    test(`${c.path} opens with a reason to start, not a blank list`, async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __E2E_SEED__: Record<string, unknown[]> }).__E2E_SEED__ = {
          invoices: [], licenses: [], vendors: [], projects: [], contacts: [], requests: [], routines: [], submissions: [],
        };
      });
      await page.goto(c.path);
      const empty = page.getByTestId("empty-state");
      await expect(empty).toContainText(c.title);
      await empty.getByRole("button", { name: c.action }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    });
  }
});
