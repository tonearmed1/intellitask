import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test("mobile viewport: nav collapses behind a hamburger drawer", async ({ page }) => {
  await loginAndReachApp(page);
  await page.goto("/projects");

  // The full sidebar should not be permanently visible on a narrow viewport.
  await expect(page.getByRole("link", { name: "Timeline" })).toBeHidden();

  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Timeline" })).toBeVisible();

  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page).toHaveURL(/\/timeline/);
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
});

test("mobile viewport: can create a quick task", async ({ page }) => {
  await loginAndReachApp(page);
  await page.goto("/projects?new=quick");

  const title = `Mobile quick task ${Date.now()}`;
  await page.getByLabel("Task", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Create task" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 10000 });
});
