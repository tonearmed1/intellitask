import { desc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { contextEntries } from "../../db/schema";
import { rowToContextEntry } from "../../db/mappers";
import { newId, nowIso } from "../../lib/ids";
import { sanitizePlainText } from "../../lib/sanitize";
import { Errors } from "../../lib/errors";
import type { ContextCategory, ContextEntry } from "@shared/types";

export interface CreateContextEntryInput {
  category: ContextCategory;
  title: string;
  content: string;
  tags?: string[];
}

export async function listContextEntries(db: Database): Promise<ContextEntry[]> {
  const rows = await db
    .select()
    .from(contextEntries)
    .orderBy(desc(contextEntries.updatedAt));
  return rows.map(rowToContextEntry);
}

export async function createContextEntry(
  db: Database,
  input: CreateContextEntryInput,
): Promise<ContextEntry> {
  const timestamp = nowIso();
  const id = newId("ctx");
  await db.insert(contextEntries).values({
    id,
    category: input.category,
    title: sanitizePlainText(input.title, 200),
    content: sanitizePlainText(input.content, 5000),
    tags: (input.tags ?? []).map((t) => sanitizePlainText(t, 50)),
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const [row] = await db.select().from(contextEntries).where(eq(contextEntries.id, id));
  return rowToContextEntry(row);
}

export async function updateContextEntry(
  db: Database,
  id: string,
  patch: Partial<CreateContextEntryInput>,
): Promise<ContextEntry> {
  const [existing] = await db.select().from(contextEntries).where(eq(contextEntries.id, id));
  if (!existing) throw Errors.notFound("Context entry");

  await db
    .update(contextEntries)
    .set({
      category: patch.category ?? existing.category,
      title: patch.title !== undefined ? sanitizePlainText(patch.title, 200) : existing.title,
      content:
        patch.content !== undefined ? sanitizePlainText(patch.content, 5000) : existing.content,
      tags:
        patch.tags !== undefined
          ? patch.tags.map((t) => sanitizePlainText(t, 50))
          : existing.tags,
      updatedAt: nowIso(),
    })
    .where(eq(contextEntries.id, id));

  const [row] = await db.select().from(contextEntries).where(eq(contextEntries.id, id));
  return rowToContextEntry(row);
}

export async function deleteContextEntry(db: Database, id: string): Promise<void> {
  const [existing] = await db.select().from(contextEntries).where(eq(contextEntries.id, id));
  if (!existing) throw Errors.notFound("Context entry");
  await db.delete(contextEntries).where(eq(contextEntries.id, id));
}
