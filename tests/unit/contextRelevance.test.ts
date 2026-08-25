import { describe, expect, it } from "vitest";
import { selectRelevantContext } from "../../worker/services/context/relevance";
import type { ContextEntry } from "@shared/types";

function makeEntry(overrides: Partial<ContextEntry> & { id: string }): ContextEntry {
  return {
    category: "other",
    title: overrides.id,
    content: "",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectRelevantContext", () => {
  it("returns an empty array when there are no entries", () => {
    expect(selectRelevantContext([], "prepare for eicma")).toEqual([]);
  });

  it("ranks entries with more keyword overlap higher", () => {
    const entries = [
      makeEntry({ id: "motorcycles", title: "Motorcycles", content: "G1S, G1X, G1XR trade show bikes" }),
      makeEntry({ id: "unrelated", title: "Coffee preference", content: "Oat milk flat white" }),
    ];
    const result = selectRelevantContext(entries, "Prepare motorcycles for trade show", 5);
    expect(result[0].id).toBe("motorcycles");
  });

  it("boosts entries whose tag appears verbatim in the query", () => {
    const entries = [
      makeEntry({ id: "supplier", title: "Preferred supplier", content: "Acme Co for banners", tags: ["banners"] }),
      makeEntry({ id: "other", title: "Random note", content: "Something else entirely" }),
    ];
    const result = selectRelevantContext(entries, "Need to order banners for the stand", 5);
    expect(result[0].id).toBe("supplier");
  });

  it("respects the limit parameter", () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ id: `entry-${i}`, title: "Motorcycle event", content: "eicma trade show" }),
    );
    const result = selectRelevantContext(entries, "eicma trade show motorcycle", 3);
    expect(result).toHaveLength(3);
  });

  it("falls back to recent entries when nothing matches by keyword", () => {
    const entries = [
      makeEntry({ id: "old", title: "Zzz", content: "Qqq", updatedAt: "2025-01-01T00:00:00.000Z" }),
      makeEntry({ id: "new", title: "Zzz", content: "Qqq", updatedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    const result = selectRelevantContext(entries, "xyxyxyxy nonsense query", 5);
    expect(result[0].id).toBe("new");
  });

  it("ignores stopwords so they don't inflate scores", () => {
    const entries = [makeEntry({ id: "e1", title: "Plan", content: "the and or for with" })];
    const result = selectRelevantContext(entries, "the and or for with", 5);
    // Every query token is a stopword, so this should hit the "no keyword overlap" fallback path.
    expect(result).toHaveLength(1);
  });
});
