import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";

const axeSource = readFileSync("node_modules/axe-core/axe.min.js", "utf8");

/** The pages people use most, filled with sample records, so a failing colour or tap target on any of them is caught. */
const PAGES = [
  "/app", "/app/overview", "/app/assistant", "/app/invoices", "/app/licenses", "/app/contacts", "/app/vendors", "/app/projects",
  "/app/forms", "/app/reporting", "/app/calendar", "/app/activity", "/app/setup?tab=profile", "/app/setup?tab=notifications",
  "/app/setup?tab=demo", "/app/setup?tab=setup", "/login",
];

for (const [device, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]] as const) {
  test(`text contrast and tap targets pass on ${device}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" }); // pages fade in; measure the final colours, not a frame of the fade
    const failures: string[] = [];
    for (const path of PAGES) {
      await page.goto(path);
      await page.waitForTimeout(500);
      await page.addScriptTag({ content: axeSource });
      const found = await page.evaluate(async () => {
        // @ts-expect-error axe is injected above
        const r = await axe.run(document, { runOnly: { type: "rule", values: ["color-contrast", "target-size"] }, resultTypes: ["violations"] });
        return r.violations.flatMap((v: { id: string; nodes: { html: string; any: { message: string }[] }[] }) =>
          v.nodes.map((n) => `${v.id}: ${n.any[0]?.message ?? ""} ${n.html.slice(0, 100)}`));
      });
      failures.push(...found.map((f: string) => `${path} ${f}`));
    }
    expect(failures).toEqual([]);
  });
}
