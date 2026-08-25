import type { Database } from "./client";

/**
 * D1 caps the number of bound parameters per statement, well under what a
 * single `INSERT ... VALUES (...), (...), ...` needs once a plan has more
 * than a handful of tasks. This splits rows into fixed-size chunks (each
 * built as its own insert statement) and sends them all in one `db.batch`
 * round trip so a large plan doesn't turn into dozens of sequential awaits.
 */
type BatchStatement = ReturnType<Database["insert"]>["values"] extends (...args: never[]) => infer R
  ? R
  : never;

export async function insertInChunks<T>(
  db: Database,
  rows: T[],
  chunkSize: number,
  buildInsert: (chunk: T[]) => BatchStatement,
): Promise<void> {
  if (rows.length === 0) return;
  const statements: BatchStatement[] = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (chunk.length > 0) statements.push(buildInsert(chunk));
  }
  if (statements.length === 1) {
    await statements[0];
  } else if (statements.length > 1) {
    await db.batch(statements as [BatchStatement, ...BatchStatement[]]);
  }
}

/** Safe per-table chunk sizes assuming D1's ~100 bound-parameter ceiling per statement. */
export const TASK_INSERT_CHUNK_SIZE = 4; // 23 columns * 4 = 92 params
export const DEPENDENCY_INSERT_CHUNK_SIZE = 20; // 4 columns * 20 = 80 params
export const MILESTONE_INSERT_CHUNK_SIZE = 9; // 10 columns * 9 = 90 params
