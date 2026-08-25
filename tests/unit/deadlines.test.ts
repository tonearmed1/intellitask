import { describe, expect, it } from "vitest";
import {
  computeBackwardDate,
  daysBetween,
  isDueToday,
  isOverdue,
} from "../../worker/services/tasks/deadlines";

describe("computeBackwardDate", () => {
  it("subtracts days from a deadline", () => {
    expect(computeBackwardDate("2026-11-03", 14)).toBe("2026-10-20");
  });

  it("returns null when there is no deadline", () => {
    expect(computeBackwardDate(null, 14)).toBeNull();
    expect(computeBackwardDate(undefined, 14)).toBeNull();
  });

  it("returns null for an invalid date string", () => {
    expect(computeBackwardDate("not-a-date", 14)).toBeNull();
  });

  it("handles month/year rollover", () => {
    expect(computeBackwardDate("2026-01-05", 10)).toBe("2025-12-26");
  });
});

describe("daysBetween", () => {
  it("computes positive days into the future", () => {
    expect(daysBetween("2026-01-01", "2026-01-11")).toBe(10);
  });

  it("computes negative days for a date in the past", () => {
    expect(daysBetween("2026-01-11", "2026-01-01")).toBe(-10);
  });

  it("returns 0 for the same day", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("isOverdue", () => {
  it("is true when due date is before current date and task is open", () => {
    expect(isOverdue("2026-01-01", "2026-01-05", "todo")).toBe(true);
  });

  it("is false when the task is already done", () => {
    expect(isOverdue("2026-01-01", "2026-01-05", "done")).toBe(false);
  });

  it("is false when the task is cancelled", () => {
    expect(isOverdue("2026-01-01", "2026-01-05", "cancelled")).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isOverdue(null, "2026-01-05", "todo")).toBe(false);
  });

  it("is false when the due date is in the future", () => {
    expect(isOverdue("2026-02-01", "2026-01-05", "todo")).toBe(false);
  });
});

describe("isDueToday", () => {
  it("matches when the due date is the same calendar day", () => {
    expect(isDueToday("2026-01-05", "2026-01-05T10:00:00.000Z")).toBe(true);
  });

  it("does not match a different day", () => {
    expect(isDueToday("2026-01-04", "2026-01-05")).toBe(false);
  });

  it("is false when there is no due date", () => {
    expect(isDueToday(null, "2026-01-05")).toBe(false);
  });
});
