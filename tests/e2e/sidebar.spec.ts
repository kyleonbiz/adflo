import { expect, test, type Page } from "@playwright/test";

const NAMES = [
  "Home", "Documents", "Invoices", "Licenses & Renewals", "Vendors", "CRM & Data", "Projects", "Forms & Paperwork",
  "Data Entry & Reporting", "Admin Support", "Business File Reset", "Back Office Setup",
];
const nav = (page: Page) => page.getByRole("navigation", { name: "Services" });

test.describe("module sidebar on a wide screen", () => {
  test("lists every module in a vertical column with Setup apart at the bottom", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(nav(page)).toBeVisible();
    const links = nav(page).getByRole("link");
    await expect(links).toHaveText(NAMES);

    const boxes = await Promise.all(NAMES.map((n) => nav(page).getByRole("link", { name: n, exact: true }).boundingBox()));
    for (const b of boxes) expect(b).not.toBeNull();
    const xs = boxes.map((b) => Math.round(b!.x));
    expect(new Set(xs).size).toBe(1); // one column
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.y);
    for (const b of boxes) expect(b!.x + b!.width).toBeLessThanOrEqual(270); // inside a sidebar about 256px wide, no sideways scrolling

    const gapBeforeSetup = boxes[11]!.y - (boxes[10]!.y + boxes[10]!.height);
    const gapBetweenOthers = boxes[5]!.y - (boxes[4]!.y + boxes[4]!.height);
    expect(gapBeforeSetup).toBeGreaterThan(gapBetweenOthers + 20); // set apart
    const viewport = page.viewportSize()!;
    expect(boxes[11]!.y + boxes[11]!.height).toBeGreaterThan(viewport.height - 120); // down at the bottom
  });

  test("highlights the current module and moves the highlight when you navigate", async ({ page }) => {
    await page.goto("/app/projects");
    const projects = nav(page).getByRole("link", { name: "Projects", exact: true });
    await expect(projects).toHaveAttribute("aria-current", "page");
    await expect(nav(page).locator("[aria-current=page]")).toHaveCount(1);
    const bg = (l: ReturnType<typeof nav>) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(projects)).not.toBe("rgba(0, 0, 0, 0)");
    expect(await bg(nav(page).getByRole("link", { name: "Vendors", exact: true }))).toBe("rgba(0, 0, 0, 0)");

    await nav(page).getByRole("link", { name: "Vendors", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/vendors$/);
    await expect(page.getByRole("heading", { level: 1, name: "Vendors" })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Vendors", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(projects).not.toHaveAttribute("aria-current", "page");
  });

  test("Documents opens the document workspace inside the same frame", async ({ page }) => {
    await page.goto("/app/overview");
    await nav(page).getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByTestId("document-card").first()).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Documents", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav(page)).toBeVisible();
  });

  test("stays in view while a long page scrolls", async ({ page }) => {
    await page.goto("/app/reporting");
    await page.getByRole("button", { name: "Load sample data" }).click();
    await expect(page.getByTestId("record-row").first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const box = await nav(page).getByRole("link", { name: "Home", exact: true }).boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(200);
    await expect(nav(page).getByRole("link", { name: "Back Office Setup" })).toBeInViewport();
  });

  test("has no menu button on a wide screen", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });

  test("Documents is only highlighted on its own page", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("Preview · sample data")).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Documents", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav(page).getByRole("link", { name: "Home", exact: true })).toHaveAttribute("href", "/app/overview");
    await nav(page).getByRole("link", { name: "Licenses & Renewals", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/licenses$/);
    await expect(nav(page).getByRole("link", { name: "Licenses & Renewals", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav(page).getByRole("link", { name: "Documents", exact: true })).not.toHaveAttribute("aria-current", "page");
  });
});

test.describe("module menu on a phone", () => {
  test.use({ viewport: { width: 360, height: 800 } });
  const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  test("the sidebar is replaced by a menu button that opens a drawer", async ({ page }) => {
    await page.goto("/app/overview");
    await expect(nav(page)).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("navigation", { name: "Services" }).getByRole("link")).toHaveText(NAMES);
    const box = await drawer.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  });

  test("choosing a module goes there and closes the drawer", async ({ page }) => {
    await page.goto("/app/overview");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Invoices", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/invoices$/);
    await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Invoices", exact: true })).toHaveAttribute("aria-current", "page");
  });

  test("the drawer closes with its close button and with Escape", async ({ page }) => {
    await page.goto("/app/overview");
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("button", { name: "Close menu" }).click();
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });

  test("the top bar fits on the home page and on the documents page", async ({ page }) => {
    for (const url of ["/app/overview", "/app"]) {
      await page.goto(url);
      await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
      expect(await overflow(page), url).toBeLessThanOrEqual(0);
    }
  });
});
