import { expect, test } from "@playwright/test";
import { loginAndReachApp } from "./helpers";

test("critical path: create AI project, expand/edit tasks, persist, review", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  const projectTitle = `Prepare for EICMA ${Date.now()}`;

  // 1. Log in
  await loginAndReachApp(page);

  // 2-3. Create project with a title and deadline
  await page.goto("/projects");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: "AI project" }).click();
  await page.getByLabel("What do you want to get done?").fill(projectTitle);
  await page.getByText("Add deadline, description, location").click();
  await page.getByLabel("Deadline").fill("2026-11-03");

  // 4. Generate plan
  await page.getByRole("button", { name: "Build Plan" }).click();
  await page.waitForURL(/\/projects\/proj_/, { timeout: 30000 });

  // 5. Verify several workstreams appear
  await expect(page.getByRole("heading", { name: projectTitle })).toBeVisible();
  const taskRows = page.locator('button[role="checkbox"]');
  await expect(taskRows.first()).toBeVisible({ timeout: 15000 });
  const rootWorkstreamCount = await page.locator("text=Event administration").count();
  expect(rootWorkstreamCount + (await page.locator("text=Planning").count())).toBeGreaterThan(0);

  // 6. Expand one task with AI
  const expandButton = page.locator('button[title*="Expand"]').first();
  await expandButton.click();
  await expect(page.getByText("Subtasks added.")).toBeVisible({ timeout: 15000 });

  // 7. Add a manual task
  const manualTaskTitle = `Manually added task ${Date.now()}`;
  await page.getByPlaceholder("Add a workstream or task…").fill(manualTaskTitle);
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  await expect(page.getByText(manualTaskTitle)).toBeVisible();

  // 8. Change priority of the manually added task
  const manualTaskRow = page.locator("div", { hasText: manualTaskTitle }).last();
  await manualTaskRow.getByText(/Medium|Low|High|Critical/).click();
  await page.getByRole("menuitem", { name: "Critical" }).click();

  // 9. Mark the manual task complete
  const taskTitleButton = page.getByRole("button", { name: manualTaskTitle });
  const checkboxForManualTask = taskTitleButton.locator(
    "xpath=preceding-sibling::button[@role='checkbox'][1]",
  );
  await checkboxForManualTask.click();
  await expect(taskTitleButton).toHaveClass(/line-through/);

  // 10-11. Reload and verify persistence
  await page.reload();
  await expect(page.getByRole("heading", { name: projectTitle })).toBeVisible();
  await expect(page.getByText(manualTaskTitle)).toBeVisible();
  await expect(page.getByRole("button", { name: manualTaskTitle })).toHaveClass(/line-through/);

  // 12. Open Today view
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();

  // 13. Open the project again
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page
    .getByRole("link")
    .filter({ has: page.getByRole("heading", { name: projectTitle, level: 3 }) })
    .click();
  await expect(page.getByRole("heading", { name: projectTitle, level: 1 })).toBeVisible();

  // 14. Run project review
  await page.getByRole("button", { name: "Review Project" }).click();
  await expect(
    page.getByText(/Risks|Missing tasks|Suggested next actions/).first(),
  ).toBeVisible({ timeout: 15000 });

  // 15. No frontend errors during the entire flow.
  expect(consoleErrors, `Console errors captured during flow:\n${consoleErrors.join("\n")}`).toEqual(
    [],
  );
});
