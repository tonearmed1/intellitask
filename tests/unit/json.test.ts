import { describe, expect, it } from "vitest";
import { parseJsonArray, toJsonText } from "../../worker/lib/json";

describe("parseJsonArray", () => {
  it("parses a valid JSON array", () => {
    expect(parseJsonArray<string>('["a","b"]')).toEqual(["a", "b"]);
  });

  it("returns an empty array for null/undefined", () => {
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray(undefined)).toEqual([]);
  });

  it("returns an empty array for malformed JSON instead of throwing", () => {
    expect(parseJsonArray("{not valid json")).toEqual([]);
  });

  it("returns an empty array when the JSON is valid but not an array", () => {
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
});

describe("toJsonText", () => {
  it("serializes an array", () => {
    expect(toJsonText(["a", "b"])).toBe('["a","b"]');
  });

  it("serializes undefined/null as an empty array", () => {
    expect(toJsonText(undefined)).toBe("[]");
    expect(toJsonText(null)).toBe("[]");
  });

  it("round-trips through parseJsonArray", () => {
    const original = [{ id: "1", text: "hi" }];
    expect(parseJsonArray(toJsonText(original))).toEqual(original);
  });
});
