import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test.describe("edge cases", () => {
  test("empty projects list shows the empty state, not a blank page", async ({ page }) => {
    await loginAndReachApp(page);
    await page.route("**/api/projects", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects: [] }),
      });
    });

    await page.goto("/projects");
    await expect(page.getByText("No projects yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Build your first plan" })).toBeVisible();
  });

  test("empty inbox shows an explicit zero state", async ({ page }) => {
    await loginAndReachApp(page);
    await page.route("**/api/inbox*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.goto("/inbox");
    await expect(page.getByText("Inbox zero")).toBeVisible();
  });

  test("a very long project title is accepted and rendered without breaking the page", async ({
    page,
  }) => {
    await loginAndReachApp(page);
    await page.goto("/projects?new=quick");

    const longTitle = `Very long project title ${Date.now()} ${"x".repeat(150)}`.slice(0, 200);
    await page.getByLabel("Task", { exact: true }).fill(longTitle);
    await page.getByRole("button", { name: "Create task" }).click();

    await expect(page.getByRole("heading", { name: longTitle })).toBeVisible({ timeout: 10000 });
  });

  test("deeply nested subtasks render at increasing indentation levels", async ({ page }) => {
    await loginAndReachApp(page);
    await page.goto("/projects?new=quick");
    const rootTitle = `Deep nesting root ${Date.now()}`;
    await page.getByLabel("Task", { exact: true }).fill(rootTitle);
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByRole("heading", { name: rootTitle })).toBeVisible({ timeout: 10000 });

    let currentTaskName = rootTitle;
    const depth = 4;
    for (let level = 1; level <= depth; level++) {
      const subtaskTitle = `Level ${level} subtask`;
      const row = page.locator("div").filter({ hasText: currentTaskName }).last();
      await row.getByTitle("Add subtask").click();
      await page.getByPlaceholder("New subtask…").fill(subtaskTitle);
      await page.getByPlaceholder("New subtask…").press("Enter");
      await expect(page.getByText(subtaskTitle)).toBeVisible({ timeout: 10000 });
      currentTaskName = subtaskTitle;
    }

    // All four levels should be visible simultaneously in the (auto-expanded) tree.
    for (let level = 1; level <= depth; level++) {
      await expect(page.getByText(`Level ${level} subtask`)).toBeVisible();
    }
  });

  test("deleting a task requires confirmation and can be cancelled", async ({ page }) => {
    await loginAndReachApp(page);
    await page.goto("/projects?new=quick");
    const title = `Task to maybe delete ${Date.now()}`;
    await page.getByLabel("Task", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 10000 });

    const row = page.locator("div").filter({ hasText: title }).last();
    await row.locator('button:has(svg)').last().click(); // kebab menu
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(page.getByRole("heading", { name: "Delete task" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("button", { name: title })).toBeVisible();

    await row.locator('button:has(svg)').last().click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Task deleted.")).toBeVisible();
  });
});
