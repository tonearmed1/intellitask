import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test.describe("authentication", () => {
  test("shows an error and stays on the login page for wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("e2e_user");
    await page.getByLabel("Password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects an unauthenticated visitor to /login", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logging out returns to the login page and blocks further access", async ({ page }) => {
    await loginAndReachApp(page);
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/projects/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login/);
  });
});
