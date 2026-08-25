import type { Database } from "../../db/client";
import { milestones, projects, taskDependencies, tasks } from "../../db/schema";
import { rowToProject, rowToTask } from "../../db/mappers";
import { buildTaskTree, flattenTaskTree } from "../tasks/tree";
import { isDueToday, isOverdue } from "../tasks/deadlines";
import type { Project, TaskWithChildren } from "@shared/types";

export interface TodayView {
  overdue: (TaskWithChildren & { projectTitle: string; projectId: string })[];
  dueToday: (TaskWithChildren & { projectTitle: string; projectId: string })[];
  recommended: (TaskWithChildren & { projectTitle: string; projectId: string })[];
  blocked: (TaskWithChildren & { projectTitle: string; projectId: string })[];
  waiting: (TaskWithChildren & { projectTitle: string; projectId: string })[];
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function getTodayView(db: Database, currentDate: string): Promise<TodayView> {
  const allProjects = (await db.select().from(projects)).filter((p) => p.status === "active");
  const allTasks = await db.select().from(tasks);
  const allDeps = await db.select().from(taskDependencies);

  const enrichedTasks: (TaskWithChildren & { projectTitle: string; projectId: string })[] = [];
  for (const project of allProjects) {
    const projectTasks = allTasks.filter((t) => t.projectId === project.id).map(rowToTask);
    const projectDeps = allDeps.filter((d) => projectTasks.some((t) => t.id === d.taskId));
    const flat = flattenTaskTree(buildTaskTree(projectTasks, projectDeps));
    for (const t of flat) {
      enrichedTasks.push({ ...t, projectTitle: project.title, projectId: project.id });
    }
  }

  const openTasks = enrichedTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const overdue = openTasks.filter((t) => isOverdue(t.dueDate, currentDate, t.status));
  const dueToday = openTasks.filter(
    (t) => isDueToday(t.dueDate, currentDate) && !isOverdue(t.dueDate, currentDate, t.status),
  );
  const blocked = openTasks.filter((t) => t.status === "blocked" || t.blockedByIncomplete);
  const waiting = openTasks.filter((t) => t.status === "waiting");

  const recommended = openTasks
    .filter(
      (t) =>
        !t.blockedByIncomplete &&
        t.status !== "blocked" &&
        t.status !== "waiting" &&
        !overdue.includes(t) &&
        !dueToday.includes(t),
    )
    .sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (pr !== 0) return pr;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    })
    .slice(0, 8);

  return {
    overdue: overdue.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")),
    dueToday,
    recommended,
    blocked,
    waiting,
  };
}

export interface TimelineEntry {
  kind: "task" | "milestone";
  id: string;
  title: string;
  date: string;
  projectId: string;
  projectTitle: string;
  priority?: string;
  completed?: boolean;
}

export async function getTimeline(db: Database, currentDate: string): Promise<TimelineEntry[]> {
  const allProjects = (await db.select().from(projects)).filter((p) => p.status === "active");
  const projectTitleById = new Map(allProjects.map((p) => [p.id, p.title]));
  const allTasks = (await db.select().from(tasks)).filter(
    (t) => projectTitleById.has(t.projectId) && t.status !== "done" && t.status !== "cancelled",
  );
  const allMilestones = (await db.select().from(milestones)).filter((m) =>
    projectTitleById.has(m.projectId),
  );

  const entries: TimelineEntry[] = [];
  for (const t of allTasks) {
    if (!t.dueDate || t.dueDate < currentDate.slice(0, 10)) continue;
    entries.push({
      kind: "task",
      id: t.id,
      title: t.title,
      date: t.dueDate,
      projectId: t.projectId,
      projectTitle: projectTitleById.get(t.projectId) ?? "",
      priority: t.priority,
    });
  }
  for (const m of allMilestones) {
    if (!m.dueDate) continue;
    entries.push({
      kind: "milestone",
      id: m.id,
      title: m.title,
      date: m.dueDate,
      projectId: m.projectId,
      projectTitle: projectTitleById.get(m.projectId) ?? "",
      completed: m.completed,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getRecentlyUpdatedProjects(
  db: Database,
  limit = 5,
): Promise<Project[]> {
  const rows = await db.select().from(projects);
  return rows
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map(rowToProject);
}
