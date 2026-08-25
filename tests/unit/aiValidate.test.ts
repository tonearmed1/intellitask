import { describe, expect, it, vi } from "vitest";
import { validateAiJson, withJsonRetry } from "../../worker/services/ai/validate";
import { aiProjectPlanSchema } from "@shared/ai-schema";
import { AppError } from "../../worker/lib/errors";

const validPlan = {
  projectSummary: "Summary",
  assumptions: ["a1"],
  questions: ["q1"],
  workstreams: [
    {
      title: "Workstream",
      description: "desc",
      tasks: [
        {
          title: "Task 1",
          description: "",
          priority: "medium",
          estimatedEffort: "1h",
          suggestedDueDate: null,
          reason: "",
          dependencies: [],
          requiresResearch: false,
          subtasks: [],
        },
      ],
    },
  ],
  risks: [],
  missingInformation: [],
  suggestedMilestones: [],
};

describe("validateAiJson", () => {
  it("accepts well-formed AI output", () => {
    const result = validateAiJson(aiProjectPlanSchema, validPlan);
    expect(result.ok).toBe(true);
    expect(result.data?.workstreams[0].tasks[0].title).toBe("Task 1");
  });

  it("rejects malformed output and reports a useful error", () => {
    const malformed = { ...validPlan, workstreams: "not-an-array" };
    const result = validateAiJson(aiProjectPlanSchema, malformed);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("workstreams");
  });

  it("rejects output with an invalid enum value", () => {
    const malformed = {
      ...validPlan,
      workstreams: [
        {
          ...validPlan.workstreams[0],
          tasks: [{ ...validPlan.workstreams[0].tasks[0], priority: "urgent!!" }],
        },
      ],
    };
    const result = validateAiJson(aiProjectPlanSchema, malformed);
    expect(result.ok).toBe(false);
  });

  it("fills in defaults for optional fields that are missing", () => {
    const minimal = { workstreams: [] };
    const result = validateAiJson(aiProjectPlanSchema, minimal);
    expect(result.ok).toBe(true);
    expect(result.data?.assumptions).toEqual([]);
    expect(result.data?.risks).toEqual([]);
  });
});

describe("withJsonRetry", () => {
  it("returns parsed data on the first successful attempt", async () => {
    const attempt = vi.fn().mockResolvedValue(validPlan);
    const data = await withJsonRetry(aiProjectPlanSchema, attempt);
    expect(data.projectSummary).toBe("Summary");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("retries after malformed output and succeeds on a later attempt", async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ workstreams: "bad" })
      .mockResolvedValueOnce(validPlan);
    const data = await withJsonRetry(aiProjectPlanSchema, attempt, 3);
    expect(data.projectSummary).toBe("Summary");
    expect(attempt).toHaveBeenCalledTimes(2);
    // Second call should receive a correction note describing the failure.
    expect(attempt.mock.calls[1][0]).toContain("workstreams");
  });

  it("throws a 502 AppError after exhausting all attempts on persistently bad output", async () => {
    const attempt = vi.fn().mockResolvedValue({ workstreams: "still-bad" });
    await expect(withJsonRetry(aiProjectPlanSchema, attempt, 2)).rejects.toThrow(AppError);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("treats a thrown error from attempt() as a failure and retries", async () => {
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(validPlan);
    const data = await withJsonRetry(aiProjectPlanSchema, attempt, 3);
    expect(data.projectSummary).toBe("Summary");
  });
});
