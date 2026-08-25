import type { Database } from "../../db/client";
import { contextEntries, projects, tasks } from "../../db/schema";
import { rowToContextEntry, rowToProject, rowToTask } from "../../db/mappers";
import type { ContextEntry, Project, Task } from "@shared/types";

export interface SearchResults {
  projects: Project[];
  tasks: (Task & { projectTitle: string })[];
  contextEntries: ContextEntry[];
}

const MAX_RESULTS_PER_TYPE = 20;

function matches(haystack: (string | null | undefined)[], query: string): boolean {
  const q = query.toLowerCase();
  return haystack.some((h) => h?.toLowerCase().includes(q));
}

export async function search(db: Database, query: string): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { projects: [], tasks: [], contextEntries: [] };
  }

  const [allProjects, allTasks, allContext] = await Promise.all([
    db.select().from(projects),
    db.select().from(tasks),
    db.select().from(contextEntries),
  ]);

  const matchedProjects = allProjects
    .filter((p) => matches([p.title, p.description, p.notes, p.projectSummary], trimmed))
    .slice(0, MAX_RESULTS_PER_TYPE)
    .map(rowToProject);

  const projectTitleById = new Map(allProjects.map((p) => [p.id, p.title]));
  const matchedTasks = allTasks
    .filter((t) => matches([t.title, t.description, t.notes], trimmed))
    .slice(0, MAX_RESULTS_PER_TYPE)
    .map((t) => ({ ...rowToTask(t), projectTitle: projectTitleById.get(t.projectId) ?? "" }));

  const matchedContext = allContext
    .filter((e) => matches([e.title, e.content], trimmed))
    .slice(0, MAX_RESULTS_PER_TYPE)
    .map(rowToContextEntry);

  return { projects: matchedProjects, tasks: matchedTasks, contextEntries: matchedContext };
}
