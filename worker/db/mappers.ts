import type {
  Assumption,
  ContextEntry,
  InboxItem,
  Milestone,
  PlanQuestion,
  Project,
  ResearchSource,
  Task,
} from "@shared/types";
import type { schema } from "./client";

type TaskRow = typeof schema.tasks.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;
type MilestoneRow = typeof schema.milestones.$inferSelect;
type ContextEntryRow = typeof schema.contextEntries.$inferSelect;
type InboxItemRow = typeof schema.inboxItems.$inferSelect;
type ResearchSourceRow = typeof schema.researchSources.$inferSelect;

// jsonb columns already come back from the driver as parsed JS values
// (arrays/objects), so these mappers just re-type them — no
// JSON.parse/stringify needed the way D1's TEXT-encoded columns required.

export function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    itemState: (row.itemState as Task["itemState"]) ?? null,
    tags: row.tags ?? [],
  } as Task;
}

export function rowToProject(row: ProjectRow): Project {
  return {
    ...row,
    assumptions: (row.assumptions as Assumption[]) ?? [],
    questions: (row.questions as PlanQuestion[]) ?? [],
    risks: row.risks ?? [],
    missingInformation: row.missingInformation ?? [],
  } as Project;
}

export function rowToMilestone(row: MilestoneRow): Milestone {
  return { ...row } as Milestone;
}

export function rowToContextEntry(row: ContextEntryRow): ContextEntry {
  return {
    ...row,
    tags: row.tags ?? [],
  } as ContextEntry;
}

export function rowToInboxItem(row: InboxItemRow): InboxItem {
  return { ...row } as InboxItem;
}

export function rowToResearchSource(row: ResearchSourceRow): ResearchSource {
  return { ...row } as ResearchSource;
}
