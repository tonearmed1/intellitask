import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test("mobile viewport: nav collapses behind a hamburger drawer", async ({ page }) => {
  await loginAndReachApp(page);
  await page.goto("/projects");

  // The hamburger trigger confirms mobile layout is active. The drawer is
  // moved off-screen via a CSS transform rather than display:none (so it can
  // slide in), so it stays technically "visible" to Playwright even when
  // off-canvas — check its position instead of toBeHidden().
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  const closedBox = await page.getByRole("link", { name: "Timeline" }).boundingBox();
  expect(closedBox?.x).toBeLessThan(0);

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
