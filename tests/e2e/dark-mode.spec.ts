import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test("dark mode toggle applies immediately and survives reload", async ({ page }) => {
  await loginAndReachApp(page);
  await page.goto("/settings");

  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);

  await page.getByLabel("Theme").selectOption("dark");
  await expect(html).toHaveClass(/dark/);
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.reload();
  await expect(html).toHaveClass(/dark/);

  // Switch back so other tests in the shared browser context aren't affected.
  await page.getByLabel("Theme").selectOption("light");
  await expect(html).not.toHaveClass(/dark/);
});
