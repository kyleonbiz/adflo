// Records a ~70 second walkthrough of AdFlo for marketing, using a fictional contractor ("Summit Comfort HVAC").
// Needs the app running in development mode with NEXT_PUBLIC_E2E_SEED=1 (see README.md in this folder).
//   node scripts/demo-video/record.mjs            -> writes scripts/demo-video/out/adflo-demo.webm
import { chromium } from "playwright";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.DEMO_URL ?? "http://localhost:3200";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const COMPANY = "Summit Comfort HVAC LLC";

const docs = (id, items) => items.map(([label, received], i) => ({ id: `${id}-d${i}`, label, received }));
const lic = (id, name, category, issuer, number, issuedAgo, expiresIn, term, stage, reqs) => ({
  id, name, category, issuer, number, holder: COMPANY, issuedOn: addDays(-issuedAgo), expiresOn: addDays(expiresIn),
  renewalTermMonths: term, reminderDays: [60, 30, 7], stage, notes: "", requiredDocuments: docs(id, reqs),
});
const licenses = [
  lic("l1", "State Contractor License", "professional", "State Licensing Board", "HVAC-448210", 300, 21, 12, "in_progress", [["Renewal application", true], ["Continuing education proof", false]]),
  lic("l2", "General Liability Insurance", "insurance", "Northfield Mutual", "GL-77-140992", 330, 9, 12, "not_started", [["Updated certificate of insurance", false]]),
  lic("l3", "EPA 608 Technician Certification", "professional", "EPA", "608-55120", 700, 240, 0, "not_started", [["Certificate copy", true]]),
  lic("l4", "City Business License", "business", "City Clerk", "BL-2026-3321", 120, 245, 12, "not_started", [["Signed application", true]]),
  lic("l5", "Workers' Compensation Policy", "insurance", "Keystone Insurance", "WC-90412", 200, 160, 12, "not_started", [["Certificate", true]]),
];
const inv = (id, number, client, desc, cents, issued, due, status) => ({
  id, number, client, description: desc, items: [{ description: desc, qty: 1, rateCents: cents }], amountCents: cents,
  issuedOn: addDays(issued), dueOn: addDays(due), status, paidOn: status === "paid" ? addDays(-2) : null, recurrence: "none",
  reminderDays: [7, 1], notes: "", clientEmail: "", taxRate: 0, paymentMethods: ["Check"],
  sender: { name: COMPANY, address: "Nashville, TN", phone: "", email: "" },
});
const invoices = [
  inv("i1", "INV-1041", "Maple Ridge Apartments", "Rooftop unit replacement", 1_850_000, -35, -5, "sent"),
  inv("i2", "INV-1042", "Harbor View Dental", "Spring maintenance contract", 420_000, -20, 10, "sent"),
  inv("i3", "INV-1043", "Greenway Property Group", "Boiler service, 6 units", 960_000, -9, 21, "sent"),
  inv("i4", "INV-1040", "Oakline Church", "Duct cleaning", 310_000, -50, -20, "paid"),
];
const c = (id, name, email, phone, company, category, ago, contacted) => ({ id, name, email, phone, company, category, notes: "", lastContacted: addDays(-contacted), createdOn: addDays(-ago) });
const contacts = [
  c("c1", "Maria Alvarez", "maria@mapleridge.example", "(555) 010-1100", "Maple Ridge Apartments", "Customer", 200, 4),
  c("c2", "Tom Becker", "tom@harborviewdental.example", "(555) 010-2200", "Harbor View Dental", "Customer", 150, 12),
  c("c3", "Lena Ortiz", "lena@coolsupply.example", "(555) 010-3300", "Cool Supply Co.", "Vendor", 300, 30),
  c("c4", "Ray Dunn", "ray@northfield.example", "(555) 010-4400", "Northfield Mutual", "Partner", 400, 20),
];
const t = (id, title, assignee, due, over = {}) => ({ id, title, assignee, dueOn: due === null ? null : addDays(due), repeat: "none", done: false, doneOn: null, followUpId: null, ...over });
const projects = [{
  id: "p1", name: "Maple Ridge: rooftop replacements", client: "Maple Ridge Apartments", description: "Replace four rooftop units.",
  status: "active", startOn: addDays(-14), dueOn: addDays(20),
  tasks: [
    t("t1", "Permit application", "Sam", -10, { done: true, doneOn: addDays(-11) }),
    t("t2", "Order units", "Sam", -2),
    t("t3", "Crane scheduling", "Jo", 3),
    t("t4", "Final inspection", "Jo", 18),
  ],
}];
const seed = { licenses, invoices, contacts, projects, vendors: [], submissions: [] };

const pause = (page, ms) => page.waitForTimeout(ms);
async function glide(page, locator, ms = 700) {
  const box = await locator.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 25 });
  await pause(page, ms);
}
async function go(page, path, wait = 1800) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await pause(page, wait);
}
async function type(page, label, text) {
  const f = page.getByRole("dialog").getByLabel(label);
  await f.click();
  await f.pressSequentially(text, { delay: 55 });
}

mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, "tmp");
rmSync(tmp, { recursive: true, force: true });
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: tmp, size: { width: 1920, height: 1080 } },
});
await ctx.addInitScript((s) => { window.__E2E_SEED__ = s; }, seed);
const page = await ctx.newPage();
// A visible cursor, since headless recordings do not draw the mouse.
await ctx.addInitScript(() => {
  addEventListener("DOMContentLoaded", () => {
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(37,99,235,.55);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none;left:-40px;top:-40px;transform:translate(-50%,-50%)";
    document.body.appendChild(d);
    addEventListener("mousemove", (e) => { d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; }, true);
  });
});

// Hide development-only notices so the footage looks like the real product.
await ctx.addInitScript(() => {
  const hide = () => {
    document.querySelectorAll("nextjs-portal").forEach((el) => { el.style.display = "none"; });
    document.querySelectorAll("div,span,p").forEach((el) => {
      const t = (el.textContent ?? "").trim();
      if (!(/^(Records are saved in this browser|Dates come from the records in this browser|Finish guided setup)/.test(t) || t === "Preview")) return;
      let n = el;
      // Climb to the banner box, but never to a container that holds much more than the notice itself.
      while (n.parentElement && (n.parentElement.textContent ?? "").trim().length < t.length + 40) n = n.parentElement;
      if (n.textContent.trim().length < 400) n.style.display = "none";
    });
  };
  addEventListener("DOMContentLoaded", () => { hide(); new MutationObserver(hide).observe(document.body, { childList: true, subtree: true }); });
});

// 1. Dashboard (0:00)
await go(page, "/app/overview", 3500);
await glide(page, page.getByText("Needs your attention").first(), 1500);
await page.mouse.wheel(0, 500); await pause(page, 1800);

// 2. Licenses & renewals (0:10)
await go(page, "/app/licenses", 2500);
await glide(page, page.getByText("General Liability Insurance").first(), 2500);
await page.mouse.wheel(0, 400); await pause(page, 2500);

// 3. Equipment: add items the way a user would (0:25)
await go(page, "/app/equipment", 1800);
const items = [
  ["Service van 3", "1FTBW2CM8GKA12345", "2026-12-20", "Sam Rivera", "Yard, bay 2"],
  ["Refrigerant recovery machine", "RRM-2201", "2020-01-15", "Jo Park", "Shop, cage A"],
];
for (const [name, serial, next, who, where] of items) {
  await page.getByRole("button", { name: "Add equipment" }).first().click();
  await pause(page, 600);
  await type(page, "Name", name);
  await type(page, "Serial, VIN, plate or key tag", serial);
  await type(page, "Assigned to", who);
  await type(page, "Where it is kept", where);
  await page.getByRole("dialog").getByLabel("Next service").fill(next);
  await pause(page, 500);
  await page.getByRole("dialog").getByRole("button", { name: "Add equipment" }).click();
  await pause(page, 1500);
}
await glide(page, page.getByTestId("equipment-row").first(), 2500);

// 4. Calendar: every deadline in one view (0:45)
await go(page, "/app/calendar", 2500);
await page.getByRole("tab", { name: "agenda" }).click().catch(() => {});
await pause(page, 3000);

// 5. Invoices (0:52)
await go(page, "/app/invoices", 3000);
await page.mouse.wheel(0, 300); await pause(page, 2000);

// 6. Back to dashboard (1:00)
await go(page, "/app/overview", 3500);

await ctx.close();
await browser.close();
const file = readdirSync(tmp).find((f) => f.endsWith(".webm"));
renameSync(join(tmp, file), join(OUT, "adflo-demo.webm"));
rmSync(tmp, { recursive: true, force: true });
console.log("wrote", join(OUT, "adflo-demo.webm"));
