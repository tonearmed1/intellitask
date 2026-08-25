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
import { parseJsonArray } from "../lib/json";
import type { schema } from "./client";

type TaskRow = typeof schema.tasks.$inferSelect;
type ProjectRow = typeof schema.projects.$inferSelect;
type MilestoneRow = typeof schema.milestones.$inferSelect;
type ContextEntryRow = typeof schema.contextEntries.$inferSelect;
type InboxItemRow = typeof schema.inboxItems.$inferSelect;
type ResearchSourceRow = typeof schema.researchSources.$inferSelect;

export function rowToTask(row: TaskRow): Task {
  return {
    ...row,
    itemState: (row.itemState as Task["itemState"]) ?? null,
    tags: parseJsonArray<string>(row.tags),
  } as Task;
}

export function rowToProject(row: ProjectRow): Project {
  return {
    ...row,
    assumptions: parseJsonArray<Assumption>(row.assumptions),
    questions: parseJsonArray<PlanQuestion>(row.questions),
    risks: parseJsonArray<string>(row.risks),
    missingInformation: parseJsonArray<string>(row.missingInformation),
  } as Project;
}

export function rowToMilestone(row: MilestoneRow): Milestone {
  return { ...row } as Milestone;
}

export function rowToContextEntry(row: ContextEntryRow): ContextEntry {
  return {
    ...row,
    tags: parseJsonArray<string>(row.tags),
  } as ContextEntry;
}

export function rowToInboxItem(row: InboxItemRow): InboxItem {
  return { ...row } as InboxItem;
}

export function rowToResearchSource(row: ResearchSourceRow): ResearchSource {
  return { ...row } as ResearchSource;
}
