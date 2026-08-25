/** Safe helpers for the JSON-encoded array/object columns stored as TEXT in D1. */

export function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? []);
}
