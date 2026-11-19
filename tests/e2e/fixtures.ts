import { test as base, expect, type Page } from "@playwright/test";
import { todayLocal } from "../../src/lib/dates";
import { sampleContacts } from "../support/contacts-sample-data";
import { sampleSubmissions } from "../support/forms-sample-data";
import { sampleInvoices } from "../support/invoices-sample-data";
import { sampleLicenses } from "../support/licenses-sample-data";
import { sampleProjects } from "../support/projects-sample-data";
import { sampleVendors } from "../support/vendors-sample-data";

/**
 * WebKit on the CI runners draws in software, where backdrop blur is so slow that clicks never see a "stable" button.
 * Tests check behaviour, not the blur, so switch it off there (see the webkit note in playwright.config.ts). Works on a
 * page or on a browser context a test opens itself, which needs `reducedMotion: "reduce"` as well (see `renderOptions`).
 */
export async function softenWebkit(target: Pick<Page, "addInitScript">, browserName: string) {
  if (browserName !== "webkit") return;
  await target.addInitScript(() => {
    const css = "*, *::before, *::after { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }";
    const add = () => { const el = document.createElement("style"); el.textContent = css; (document.head ?? document.documentElement).appendChild(el); };
    if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add);
  });
}

/** Context options for a window a test opens itself: the same reduced motion the WebKit projects use. */
export const renderOptions = (browserName: string) => (browserName === "webkit" ? { reducedMotion: "reduce" as const } : {});

/**
 * The app starts empty, so every browser test begins with these records in each service (see
 * `src/lib/e2e-seed.ts`). Documents are not seeded: tests upload what they need (see `docs.ts`).
 */
export const test = base.extend({
  page: async ({ page, browserName }, provide) => {
    await softenWebkit(page, browserName);
    const today = todayLocal();
    const seed = {
      invoices: sampleInvoices(today), licenses: sampleLicenses(today), projects: sampleProjects(today),
      vendors: sampleVendors(today), contacts: sampleContacts(today),
      submissions: sampleSubmissions(today),
    };
    await page.addInitScript((s) => {
      (window as unknown as { __E2E_SEED__: unknown }).__E2E_SEED__ = s;
    }, seed);
    await provide(page);
  },
});

export { expect };
