import { expect, test } from "@playwright/test";

test.describe("projects module", () => {
  test("summary, attention list, health and status filter", async ({ page }) => {
    await page.goto("/app/projects");
    await expect(page.getByRole("note")).toContainText("Nothing is saved");
    await expect(page.getByTestId("project-card")).toHaveCount(4);

    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Active projects");
    const attention = page.getByRole("region", { name: "Needs attention" });
    await expect(attention).toContainText("Import vendor list");
    await expect(attention).toContainText("2 days overdue");
    await expect(attention).toContainText("Submit city permit renewal");

    const onboarding = page.getByTestId("project-card").filter({ hasText: "Client onboarding" });
    await expect(onboarding.getByText("At risk", { exact: true })).toBeVisible();
    await expect(onboarding).toContainText("2 of 6 tasks");
    const licenses = page.getByTestId("project-card").filter({ hasText: "License renewals 2026" });
    await expect(licenses.getByText("Late", { exact: true })).toBeVisible();

    await page.getByRole("combobox", { name: "Filter by status" }).click();
    await page.getByRole("option", { name: "Completed" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
  });

  test("completing tasks updates progress and repeating tasks schedule the next one", async ({ page }) => {
    await page.goto("/app/projects");
    const card = page.getByTestId("project-card").filter({ hasText: "Client onboarding" });
    // A project with overdue tasks arrives expanded.
    await expect(card.getByRole("button", { name: /^Tasks/ })).toHaveAttribute("aria-expanded", "true");

    await card.getByRole("checkbox", { name: /^Import vendor list/ }).check();
    await expect(card).toContainText("3 of 6 tasks");
    await expect(page.getByRole("region", { name: "Needs attention" })).not.toContainText("Import vendor list");
    await expect(card.getByText("At risk", { exact: true })).toHaveCount(0);
    await expect(card.getByText("On track", { exact: true })).toBeVisible();

    await card.getByRole("checkbox", { name: /^Weekly check-in/ }).check();
    await expect(page.getByRole("status")).toContainText("The next one is scheduled");
    await expect(card.getByRole("checkbox", { name: /^Weekly check-in/ })).toHaveCount(2);
    await expect(card).toContainText("4 of 7 tasks");

    // Reopen and complete again: no second follow-up appears.
    await card.getByRole("checkbox", { name: /^Weekly check-in/, checked: true }).uncheck();
    await card.getByRole("checkbox", { name: /^Weekly check-in/, checked: false }).first().check();
    await expect(card.getByRole("checkbox", { name: /^Weekly check-in/ })).toHaveCount(2);
  });

  test("add task with validation, create project, edit and delete", async ({ page }) => {
    await page.goto("/app/projects");
    const card = page.getByTestId("project-card").filter({ hasText: "Data cleanup" });
    await card.getByRole("button", { name: /^Tasks/ }).click();
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card.getByRole("alert")).toContainText("Enter a task");
    await card.getByLabel("New task for Data cleanup").fill("Review duplicates");
    await card.getByLabel("Assignee").fill("Priya");
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicates" })).toBeVisible();
    await card.getByRole("button", { name: "Remove task Review duplicates" }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicates" })).toHaveCount(0);
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicates" })).toBeVisible();

    await card.getByRole("button", { name: "Edit task Review duplicates" }).click();
    await card.getByLabel("Edit task for Data cleanup").fill("Review duplicate contacts");
    await card.getByRole("button", { name: "Save", exact: true }).click();
    await expect(card.getByRole("checkbox", { name: "Review duplicate contacts" })).toBeVisible();
    await card.getByRole("button", { name: "Remove task Review duplicate contacts" }).click();

    await page.getByRole("button", { name: "New project" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog.getByRole("alert").first()).toContainText("Enter a project name");
    await dialog.getByLabel("Project name").fill("Website refresh");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(dialog).toBeHidden();
    const created = page.getByTestId("project-card").filter({ hasText: "Website refresh" });
    await expect(created).toContainText("0 of 0 tasks");

    await created.getByRole("button", { name: "More actions for Website refresh" }).click();
    await page.getByRole("menuitem", { name: "Edit project" }).click();
    await page.getByRole("dialog").getByLabel("Project name").fill("Website relaunch");
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByTestId("project-card").filter({ hasText: "Website relaunch" })).toBeVisible();

    await page.getByRole("button", { name: "More actions for Website relaunch" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(5);
  });

  test("sorts, filters from the summary tiles and clears filters", async ({ page }) => {
    await page.goto("/app/projects");
    await expect(page.getByTestId("project-card")).toHaveCount(4);
    const names = () => page.getByTestId("project-card").locator("h3").allTextContents();
    expect((await names())[0]).toBe("License renewals 2026");
    await page.getByRole("combobox", { name: "Sort projects" }).click();
    await page.getByRole("option", { name: "Sort: Name" }).click();
    expect((await names())[0]).toBe("Client onboarding: Northwind");

    await page.getByRole("button", { name: /Overdue tasks/ }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Overdue tasks/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Show all" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);

    await page.getByLabel("Search projects").fill("zzz");
    await expect(page.getByText("No projects match these filters.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Report for 0 project/ })).toBeDisabled();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByTestId("project-card")).toHaveCount(4);
  });

  test("attention rows complete tasks and jump to their project", async ({ page }) => {
    await page.goto("/app/projects");
    const attention = page.getByRole("region", { name: "Needs attention" });
    await attention.getByRole("button", { name: "Mark Submit city permit renewal done" }).click();
    await expect(attention).not.toContainText("Submit city permit renewal");
    await attention.getByRole("button", { name: "Client onboarding: Northwind" }).first().click();
    await expect(page.getByTestId("project-card").filter({ hasText: "Client onboarding" }).getByRole("button", { name: /^Tasks/ })).toHaveAttribute("aria-expanded", "true");
  });

  test("completing a project with open tasks asks what to do with them", async ({ page }) => {
    await page.goto("/app/projects");
    const card = page.getByTestId("project-card").filter({ hasText: "Data cleanup" });
    await card.getByRole("combobox", { name: "Status of Data cleanup" }).click();
    await page.getByRole("option", { name: "Completed" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("2 open tasks");
    await dialog.getByRole("button", { name: "Mark tasks done" }).click();
    await expect(card).toContainText("2 of 2 tasks");
  });

  test("downloads a status report", async ({ page }) => {
    await page.goto("/app/projects");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Status report" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^status-report-\d{4}-\d{2}-\d{2}\.txt$/);
    let text = "";
    for await (const chunk of await file.createReadStream()) text += chunk;
    expect(text).toContain("PROJECT STATUS REPORT");
    expect(text).toContain("CLIENT ONBOARDING: NORTHWIND");
    expect(text).toContain("Health: At risk");
  });

  test("fits a phone screen without horizontal scroll, tasks expanded", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/app/projects");
    await page.getByTestId("project-card").first().getByRole("button", { name: /^Tasks/ }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("is available in the signed-in app too", async ({ page }) => {
    await page.goto("/app/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Projects", exact: true })).toHaveAttribute("aria-current", "page");
  });
});
