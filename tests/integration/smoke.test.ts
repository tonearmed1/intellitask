import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContext, type TestContext } from "./setup";
import { settings } from "../../worker/db/schema";

describe("integration test harness", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.dispose();
  });

  it("applies migrations and seeds the singleton settings row", async () => {
    const rows = await ctx.db.select().from(settings);
    expect(rows).toHaveLength(1);
    expect(rows[0].aiProvider).toBe("mock");
  });
});
