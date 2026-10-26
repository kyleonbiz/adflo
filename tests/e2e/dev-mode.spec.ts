import { expect, test, type APIRequestContext } from "@playwright/test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json = async (res: { json(): Promise<any> }) => res.json();

async function uploadViaApi(request: APIRequestContext, name: string, body: string) {
  const bytes = Buffer.from(body);
  const init = await json(await request.post("/api/dms/uploads", {
    data: { fileName: name, size: bytes.length, mimeType: "application/pdf", folderId: null },
  }));
  expect(init.ok).toBe(true);
  const put = await request.put(init.data.target.url, { data: bytes, headers: { "content-type": "application/pdf" } });
  expect(put.ok()).toBe(true);
  const fin = await json(await request.post(`/api/dms/uploads/${init.data.documentId}/finalize`, { data: { versionNumber: 1 } }));
  expect(fin.ok).toBe(true);
  return fin.data as { id: string };
}

test.describe("server API (development store)", () => {
  test("uploads through the API, persists on the server, and downloads the same bytes", async ({ request }) => {
    await uploadViaApi(request, "e2e-server.pdf", "%PDF-1.4 server-bytes");

    const list = await json(await request.get("/api/dms/documents?search=e2e-server"));
    const id = list.data.items[0].id;
    expect(JSON.stringify(list)).not.toContain("storageKey");
    const link = await json(await request.get(`/api/dms/documents/${id}/file?disposition=attachment`));
    const file = await request.get(link.data.url);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-disposition"]).toContain("attachment");
    expect(file.headers()["x-content-type-options"]).toBe("nosniff");
    expect(await file.text()).toBe("%PDF-1.4 server-bytes");
  });

  test("rename, move, star and tags persist", async ({ request }) => {
    const doc = await uploadViaApi(request, "e2e-edit.pdf", "%PDF-1.4 edit");
    const folders = (await json(await request.get("/api/dms/bootstrap"))).data.folders;
    const target = folders.find((f: { name: string }) => f.name === "Receipts");
    const res = await json(await request.patch(`/api/dms/documents/${doc.id}`, {
      data: { displayName: "renamed", folderId: target.id, starred: true, tags: ["E2E", "e2e", "Smoke"] },
    }));
    expect(res.ok).toBe(true);
    const detail = (await json(await request.get(`/api/dms/documents/${doc.id}`))).data;
    expect(detail).toMatchObject({ displayName: "renamed.pdf", folderId: target.id, starred: true, tags: ["E2E", "Smoke"] });
    const filtered = (await json(await request.get(`/api/dms/documents?folderId=${target.id}&tag=smoke`))).data;
    expect(filtered.items.map((d: { id: string }) => d.id)).toContain(doc.id);
  });

  test("delete → trash → restore → purge", async ({ request }) => {
    const doc = await uploadViaApi(request, "e2e-trash.pdf", "%PDF-1.4 trash");
    expect((await json(await request.delete(`/api/dms/documents/${doc.id}`))).ok).toBe(true);
    const trash = (await json(await request.get("/api/dms/documents?view=trash"))).data;
    expect(trash.items.map((d: { id: string }) => d.id)).toContain(doc.id);
    expect((await json(await request.get(`/api/dms/documents/${doc.id}/file`))).error.code).toBe("not_found");
    expect((await json(await request.post(`/api/dms/documents/${doc.id}/restore`, { data: {} }))).ok).toBe(true);
    expect((await json(await request.post(`/api/dms/documents/${doc.id}/purge`, { data: {} }))).error.code).toBe("conflict");
    await request.delete(`/api/dms/documents/${doc.id}`);
    expect((await json(await request.post(`/api/dms/documents/${doc.id}/purge`, { data: {} }))).ok).toBe(true);
    expect((await json(await request.get(`/api/dms/documents/${doc.id}`))).error.code).toBe("not_found");
  });

  test("folder lifecycle and filtering in the UI", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill("E2E Clients");
    await page.getByRole("button", { name: "Create folder" }).click();
    const card = page.getByRole("button", { name: /^E2E Clients, 0 documents$/ });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.getByTestId("empty-state")).toContainText("This folder is empty");
    await page.getByRole("button", { name: "Folder options for E2E Clients" }).click();
    await page.getByRole("menuitem", { name: "Delete folder" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete folder" }).click();
    await expect(card).toHaveCount(0);
  });

  test("rejects bad input and unauthorized shapes", async ({ request }) => {
    const bad = await request.post("/api/dms/uploads", { data: { fileName: "x.exe", size: 5, mimeType: "application/x-msdownload", folderId: null } });
    expect(bad.status()).toBe(400);
    const traversal = await request.post("/api/dms/uploads", { data: { fileName: "../../x.pdf", size: 5, mimeType: "application/pdf", folderId: null } });
    const t = await json(traversal);
    expect(JSON.stringify(t)).not.toContain("..");
    const orphan = await request.put("/api/dms/dev/upload?key=00000000-0000-4000-8000-000000000001%2Fnope%2Fv1-x.pdf", { data: "x" });
    expect(orphan.status()).toBe(404);
    const xsite = await request.post("/api/dms/folders", { data: { name: "Evil" }, headers: { origin: "https://evil.example" } });
    expect(xsite.status()).toBe(403);
    expect((await request.get("/api/dms/documents?folderId=not-a-uuid")).status()).toBe(400);
    expect((await request.get("/api/dms/dev/file?token=bogus")).status()).toBe(410);
    expect((await request.get("/share/not-a-real-token-abcdefghijklmnop")).status()).toBe(503);
  });

  test("login page explains that auth is not configured in dev mode", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText(/Authentication is not configured/)).toBeVisible();
  });
});

test.describe("team management (server API)", () => {
  test("invites and revokes through the API, and enforces the role rules", async ({ request }) => {
    const email = `e2e-${Date.now()}@example.test`;
    const invite = await json(await request.post("/api/dms/team/invites", { data: { email, role: "viewer" } }));
    expect(invite.ok).toBe(true);

    // Server state, not just component state.
    const team = await json(await request.get("/api/dms/team"));
    expect(team.data.invites.map((i: { email: string }) => i.email)).toContain(email);

    const inviteId = team.data.invites.find((i: { email: string }) => i.email === email).id;
    expect((await json(await request.delete(`/api/dms/team/invites/${inviteId}`))).ok).toBe(true);
    const after = await json(await request.get("/api/dms/team"));
    expect(after.data.invites.map((i: { email: string }) => i.email)).not.toContain(email);

    // Invariants enforced server-side regardless of the UI: no self role change, bad input rejected.
    const me = team.data.members.find((m: { role: string }) => m.role === "owner");
    const self = await json(await request.patch(`/api/dms/team/members/${me.userId}`, { data: { role: "viewer" } }));
    expect(self.ok).toBe(false);
    expect(self.error.code).toBe("forbidden");
    const bad = await json(await request.post("/api/dms/team/invites", { data: { email: "nope", role: "viewer" } }));
    expect(bad.error.code).toBe("validation");
  });

  test("share links are honestly unavailable in dev mode", async ({ request }) => {
    const list = await json(await request.get("/api/dms/documents?pageSize=1"));
    const id = list.data.items[0].id;
    const created = await json(await request.post(`/api/dms/documents/${id}/share`, { data: { ttlMinutes: 60 } }));
    expect(created.ok).toBe(false);
    expect(created.error.code).toBe("unavailable");
    expect((await json(await request.get(`/api/dms/documents/${id}/share`))).data).toEqual([]);
  });
});

test.describe("content search (dev mode)", () => {
  test("uploaded text becomes searchable after indexing, with a highlighted snippet", async ({ request }) => {
    const body = Buffer.from("Minutes of the annual meeting. The quarterly zeppelin audit was approved unanimously.");
    const init = await json(await request.post("/api/dms/uploads", {
      data: { fileName: "e2e-minutes.txt", size: body.length, mimeType: "text/plain", folderId: null },
    }));
    expect(init.ok).toBe(true);
    expect((await request.put(init.data.target.url, { data: body, headers: { "content-type": "text/plain" } })).ok()).toBe(true);
    const fin = await json(await request.post(`/api/dms/uploads/${init.data.documentId}/finalize`, { data: { versionNumber: 1 } }));
    expect(fin.ok).toBe(true);
    expect(fin.data.contentStatus).toBe("pending"); // the response does not wait for indexing

    // Indexing runs after the response; poll until the content matches.
    await expect
      .poll(async () => {
        const r = await json(await request.get("/api/dms/documents?search=zeppelin&sort=relevance"));
        return r.data.items.map((i: { id: string; contentMatch?: boolean }) => [i.id, i.contentMatch]);
      }, { timeout: 15_000 })
      .toEqual([[init.data.documentId, true]]);

    const hit = (await json(await request.get("/api/dms/documents?search=zeppelin"))).data.items[0];
    expect(hit.contentStatus).toBe("indexed");
    expect(hit.snippet).toContain("\uE000zeppelin\uE001");
    expect(JSON.stringify(hit)).not.toContain("contentText");
  });

  test("a word that is only in an unindexable file type finds nothing", async ({ request }) => {
    const r = await json(await request.get("/api/dms/documents?search=qwertyuiopasdf"));
    expect(r.data.total).toBe(0);
  });

  test("seeded sample PDFs are indexed on first load", async ({ request }) => {
    await request.get("/api/dms/bootstrap"); // triggers the bounded background backfill
    await expect
      .poll(async () => (await json(await request.get("/api/dms/documents?search=%22placeholder%20content%22"))).data.total, { timeout: 20_000 })
      .toBeGreaterThan(0);
  });
});

