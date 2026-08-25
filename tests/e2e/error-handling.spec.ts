import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test.describe("error handling", () => {
  test("a malformed-AI-output failure from the server surfaces a readable error toast", async ({
    page,
  }) => {
    await loginAndReachApp(page);
    await page.goto("/projects");

    await page.route("**/api/projects", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "ai_invalid_output",
            message: "The AI returned output that didn't match the expected format.",
          },
        }),
      });
    });

    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("menuitem", { name: "AI project" }).click();
    await page.getByLabel("What do you want to get done?").fill("Trigger a bad AI response");
    await page.getByRole("button", { name: "Build Plan" }).click();

    await expect(page.getByText(/didn't match the expected format/i)).toBeVisible({
      timeout: 10000,
    });
    // The modal should still be usable, not stuck or crashed.
    await expect(page.getByRole("button", { name: "Build Plan" })).toBeEnabled();
  });

  test("an upstream AI provider failure (500) shows a graceful message", async ({ page }) => {
    await loginAndReachApp(page);
    await page.goto("/projects");

    await page.route("**/api/projects", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "internal_error", message: "Something went wrong. Please try again." },
        }),
      });
    });

    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("menuitem", { name: "AI project" }).click();
    await page.getByLabel("What do you want to get done?").fill("Trigger a provider failure");
    await page.getByRole("button", { name: "Build Plan" }).click();

    await expect(page.getByText("Something went wrong. Please try again.")).toBeVisible({
      timeout: 10000,
    });
  });

  test("a network failure (no response at all) is reported, not a silent hang", async ({
    page,
  }) => {
    await loginAndReachApp(page);
    await page.goto("/projects");

    await page.route("**/api/projects", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.abort("failed");
    });

    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("menuitem", { name: "AI project" }).click();
    await page.getByLabel("What do you want to get done?").fill("Trigger a network failure");
    await page.getByRole("button", { name: "Build Plan" }).click();

    await expect(page.getByText(/couldn't reach the server/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Build Plan" })).toBeEnabled();
  });
});
