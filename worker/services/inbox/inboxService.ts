import { desc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { inboxItems, projects, tasks } from "../../db/schema";
import { rowToInboxItem } from "../../db/mappers";
import { newId, nowIso } from "../../lib/ids";
import { sanitizePlainText } from "../../lib/sanitize";
import { Errors } from "../../lib/errors";
import { tokenize } from "../context/relevance";
import { createTask } from "../tasks/taskService";
import type { InboxItem, InboxItemStatus } from "@shared/types";

export async function createInboxItem(db: Database, content: string): Promise<InboxItem> {
  const id = newId("inbox");
  const timestamp = nowIso();
  const text = sanitizePlainText(content, 1000);
  if (!text) throw Errors.badRequest("Inbox item can't be empty.");

  const suggestion = await suggestPlacement(db, text);

  await db.insert(inboxItems).values({
    id,
    content: text,
    status: "pending",
    suggestedProjectId: suggestion?.projectId ?? null,
    suggestedParentTaskId: suggestion?.parentTaskId ?? null,
    suggestionReason: suggestion?.reason ?? null,
    createdAt: timestamp,
    resolvedAt: null,
  });

  const [row] = await db.select().from(inboxItems).where(eq(inboxItems.id, id));
  return rowToInboxItem(row);
}

export async function listInboxItems(
  db: Database,
  status?: InboxItemStatus,
): Promise<InboxItem[]> {
  const rows = await db.select().from(inboxItems).orderBy(desc(inboxItems.createdAt));
  const filtered = status ? rows.filter((r) => r.status === status) : rows;
  return filtered.map(rowToInboxItem);
}

/**
 * Lightweight keyword match against existing project/task titles — good
 * enough to say "this looks related to project X" without spending an AI
 * call on every inbox capture.
 */
async function suggestPlacement(
  db: Database,
  content: string,
): Promise<{ projectId: string; parentTaskId: string | null; reason: string } | null> {
  const contentTokens = new Set(tokenize(content));
  if (contentTokens.size === 0) return null;

  const activeProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.status, "active"));
  if (activeProjects.length === 0) return null;

  let best: { projectId: string; title: string; score: number } | null = null;
  for (const p of activeProjects) {
    const titleTokens = tokenize(p.title);
    const score = titleTokens.filter((t) => contentTokens.has(t)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { projectId: p.id, title: p.title, score };
    }
  }
  if (!best) return null;

  // Try to find a more specific top-level workstream within that project.
  const projectTasks = await db.select().from(tasks).where(eq(tasks.projectId, best.projectId));
  let bestTask: { id: string; title: string; score: number } | null = null;
  for (const t of projectTasks.filter((t) => t.parentTaskId === null)) {
    const titleTokens = tokenize(t.title);
    const score = titleTokens.filter((tok) => contentTokens.has(tok)).length;
    if (score > 0 && (!bestTask || score > bestTask.score)) {
      bestTask = { id: t.id, title: t.title, score };
    }
  }

  return {
    projectId: best.projectId,
    parentTaskId: bestTask?.id ?? null,
    reason: bestTask
      ? `Mentions overlap with "${best.title} > ${bestTask.title}".`
      : `Mentions overlap with project "${best.title}".`,
  };
}

export async function resolveInboxItemAsTask(
  db: Database,
  id: string,
  targetProjectId: string,
  targetParentTaskId: string | null,
): Promise<void> {
  const [item] = await db.select().from(inboxItems).where(eq(inboxItems.id, id));
  if (!item) throw Errors.notFound("Inbox item");
  if (item.status !== "pending") throw Errors.conflict("This inbox item was already resolved.");

  await createTask(db, {
    projectId: targetProjectId,
    parentTaskId: targetParentTaskId,
    title: item.content,
    source: "user",
  });

  await db
    .update(inboxItems)
    .set({ status: "resolved", resolvedAt: nowIso() })
    .where(eq(inboxItems.id, id));
}

export async function dismissInboxItem(db: Database, id: string): Promise<void> {
  const [item] = await db.select().from(inboxItems).where(eq(inboxItems.id, id));
  if (!item) throw Errors.notFound("Inbox item");
  await db
    .update(inboxItems)
    .set({ status: "dismissed", resolvedAt: nowIso() })
    .where(eq(inboxItems.id, id));
}
