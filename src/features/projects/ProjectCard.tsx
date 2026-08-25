import { Link } from "react-router-dom";
import type { ProjectWithStats } from "@shared/types";
import { formatDate, relativeDueLabel } from "@/lib/dates";
import { PriorityBadge } from "@/components/Badge";
import { cn } from "@/lib/cn";

export function ProjectCard({ project }: { project: ProjectWithStats }) {
  const percent =
    project.taskCount === 0 ? 0 : Math.round((project.completedCount / project.taskCount) * 100);

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {project.title}
        </h3>
        <PriorityBadge priority={project.priority} />
      </div>

      {project.deadline && (
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          {relativeDueLabel(project.deadline)} · {formatDate(project.deadline)}
        </p>
      )}

      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className="h-full rounded-full bg-neutral-800 dark:bg-neutral-200"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>
          {project.completedCount}/{project.taskCount} tasks
        </span>
        {project.overdueCount > 0 && (
          <span className="font-medium text-red-600 dark:text-red-400">
            {project.overdueCount} overdue
          </span>
        )}
        {project.nextMilestone && (
          <span className={cn("truncate", project.overdueCount > 0 && "hidden sm:inline")}>
            Next: {project.nextMilestone.title}
          </span>
        )}
      </div>
    </Link>
  );
}
