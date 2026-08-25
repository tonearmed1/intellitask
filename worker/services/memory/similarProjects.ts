import { and, eq, ne } from "drizzle-orm";
import type { Database } from "../../db/client";
import { projects, tasks } from "../../db/schema";
import { tokenize } from "../context/relevance";
import type { SimilarProjectSnippet } from "../ai/provider";

/**
 * "Project memory": finds previously-created projects that resemble the new
 * one (by title/summary keyword overlap) and summarizes their workstreams
 * plus a sample of notable tasks — especially item-type tasks like spare
 * cables or chargers, the kind of thing that's easy to forget a second
 * time. The AI decides independently whether any of it still applies; we
 * never copy tasks across projects automatically.
 */
export async function findSimilarProjects(
  db: Database,
  queryText: string,
  excludeProjectId: string | null,
  limit = 2,
): Promise<SimilarProjectSnippet[]> {
  const queryTokens = new Set(tokenize(queryText));
  if (queryTokens.size === 0) return [];

  const allProjects = await db
    .select()
    .from(projects)
    .where(
      excludeProjectId
        ? and(ne(projects.id, excludeProjectId), eq(projects.isQuickTask, false))
        : eq(projects.isQuickTask, false),
    );

  const scored = allProjects
    .map((p) => {
      const tokens = tokenize(`${p.title} ${p.projectSummary ?? ""}`);
      const score = tokens.filter((t) => queryTokens.has(t)).length;
      return { project: p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const snippets: SimilarProjectSnippet[] = [];
  for (const { project } of scored) {
    const projectTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id));

    const workstreamTitles = projectTasks
      .filter((t) => t.parentTaskId === null)
      .map((t) => t.title);

    const itemTasks = projectTasks.filter((t) => t.taskType === "item").map((t) => t.title);
    const otherTasks = projectTasks
      .filter((t) => t.taskType !== "item" && t.parentTaskId !== null)
      .map((t) => t.title);
    const notableTaskTitles = [...itemTasks, ...otherTasks].slice(0, 15);

    snippets.push({ title: project.title, workstreamTitles, notableTaskTitles });
  }
  return snippets;
}
