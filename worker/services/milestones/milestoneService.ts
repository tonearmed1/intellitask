import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { milestones, projects } from "../../db/schema";
import { rowToMilestone } from "../../db/mappers";
import { newId, nowIso } from "../../lib/ids";
import { sanitizePlainText } from "../../lib/sanitize";
import { Errors } from "../../lib/errors";
import type { Milestone } from "@shared/types";

export interface CreateMilestoneInput {
  projectId: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
}

export async function createMilestone(
  db: Database,
  input: CreateMilestoneInput,
): Promise<Milestone> {
  const [project] = await db.select().from(projects).where(eq(projects.id, input.projectId));
  if (!project) throw Errors.notFound("Project");

  const existing = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, input.projectId));
  const sortOrder = existing.length === 0 ? 0 : Math.max(...existing.map((m) => m.sortOrder)) + 1;

  const id = newId("mile");
  const timestamp = nowIso();
  await db.insert(milestones).values({
    id,
    projectId: input.projectId,
    title: sanitizePlainText(input.title, 200),
    description: input.description ? sanitizePlainText(input.description, 500) : null,
    dueDate: input.dueDate ?? null,
    completed: false,
    source: "user",
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const [row] = await db.select().from(milestones).where(eq(milestones.id, id));
  return rowToMilestone(row);
}

export async function updateMilestone(
  db: Database,
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    dueDate: string | null;
    completed: boolean;
  }>,
): Promise<Milestone> {
  const [existing] = await db.select().from(milestones).where(eq(milestones.id, id));
  if (!existing) throw Errors.notFound("Milestone");

  await db
    .update(milestones)
    .set({
      title: patch.title !== undefined ? sanitizePlainText(patch.title, 200) : existing.title,
      description:
        patch.description !== undefined
          ? patch.description
            ? sanitizePlainText(patch.description, 500)
            : null
          : existing.description,
      dueDate: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
      completed: patch.completed ?? existing.completed,
      updatedAt: nowIso(),
    })
    .where(eq(milestones.id, id));

  const [row] = await db.select().from(milestones).where(eq(milestones.id, id));
  return rowToMilestone(row);
}

export async function deleteMilestone(db: Database, id: string): Promise<void> {
  const [existing] = await db.select().from(milestones).where(eq(milestones.id, id));
  if (!existing) throw Errors.notFound("Milestone");
  await db.delete(milestones).where(eq(milestones.id, id));
}
