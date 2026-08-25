import type { TaskPriority, TaskStatus } from "@shared/types";
import { cn } from "@/lib/cn";

const priorityDot: Record<TaskPriority, string> = {
  critical: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-neutral-400",
};

const priorityLabel: Record<TaskPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400",
        className,
      )}
      title={`Priority: ${priorityLabel[priority]}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", priorityDot[priority])} aria-hidden="true" />
      {priorityLabel[priority]}
    </span>
  );
}

const statusStyles: Record<TaskStatus, string> = {
  todo: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
  in_progress: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  waiting: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  blocked: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  done: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-neutral-100 text-neutral-400 line-through dark:bg-neutral-800 dark:text-neutral-500",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        statusStyles[status],
        className,
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

export { statusLabel, priorityLabel };
