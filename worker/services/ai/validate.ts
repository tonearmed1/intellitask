import type { z } from "zod";
import { AppError } from "../../lib/errors";

export interface JsonValidationResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
}

export function validateAiJson<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): JsonValidationResult<T> {
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data, error: null };
  }
  return {
    ok: false,
    data: null,
    error: result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; "),
  };
}

/**
 * Calls `attempt` (which should perform one provider round trip and return
 * the raw parsed JSON value) and validates the result against `schema`. If
 * validation fails, retries up to `maxAttempts` total, passing the previous
 * error back to `attempt` so the caller can append correction instructions
 * to the next prompt. Throws AppError(502) if the model still can't produce
 * valid output.
 */
export async function withJsonRetry<T>(
  schema: z.ZodType<T>,
  attempt: (correctionNote: string | null) => Promise<unknown>,
  maxAttempts = 3,
): Promise<T> {
  let lastError: string | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    let raw: unknown;
    try {
      raw = await attempt(lastError);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      continue;
    }
    const validated = validateAiJson(schema, raw);
    if (validated.ok && validated.data !== null) return validated.data;
    lastError = validated.error;
  }
  throw new AppError(
    502,
    "ai_invalid_output",
    `The AI returned output that didn't match the expected format after ${maxAttempts} attempts (${lastError ?? "unknown error"}).`,
  );
}
