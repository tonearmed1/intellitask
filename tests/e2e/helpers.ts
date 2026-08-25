import type { Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_USERNAME } from "./global-setup";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(E2E_USERNAME);
  await page.getByLabel("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname !== "/login");
}

/** Dismisses the first-run onboarding screen if it appears after login. */
export async function skipOnboardingIfPresent(page: Page) {
  const skipButton = page.getByRole("button", { name: "Skip for now" });
  if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await skipButton.click();
  }
}

export async function loginAndReachApp(page: Page) {
  await login(page);
  await skipOnboardingIfPresent(page);
}
