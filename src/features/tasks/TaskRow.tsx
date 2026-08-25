import { useState } from "react";
import type { FormEvent } from "react";
import type { Task, TaskPriority, TaskWithChildren } from "@shared/types";
import { TASK_PRIORITIES } from "@shared/types";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  GripVertical,
  Link2,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeDueLabel } from "@/lib/dates";
import { PriorityBadge, StatusBadge, priorityLabel } from "@/components/Badge";
import { DropdownMenu, MenuItem } from "@/components/DropdownMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/Input";
import { tasksService } from "@/services/tasks";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { TaskEditModal } from "./TaskEditModal";

interface TaskRowProps {
  task: TaskWithChildren;
  depth: number;
  siblingIds: string[];
  flatTasks: Task[];
  projectId: string;
  onRefresh: () => void;
  onExpandAi: (taskId: string, deeper: boolean) => void;
  expandingTaskId: string | null;
}

export function TaskRow({
  task,
  depth,
  siblingIds,
  flatTasks,
  projectId,
  onRefresh,
  onExpandAi,
  expandingTaskId,
}: TaskRowProps) {
  const { show } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [busy, setBusy] = useState(false);

  const isDone = task.status === "done";
  const isCancelled = task.status === "cancelled";
  const isReceding = isDone || isCancelled;
  const overdue =
    task.dueDate && !isReceding && new Date(task.dueDate) < new Date(new Date().toDateString());
  const isExpanding = expandingTaskId === task.id;

  async function toggleComplete() {
    setBusy(true);
    try {
      await tasksService.update(task.id, { status: isDone ? "todo" : "done" });
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update task.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function setPriority(priority: TaskPriority) {
    try {
      await tasksService.update(task.id, { priority });
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update priority.", "error");
    }
  }

  async function setDueDate(value: string) {
    try {
      await tasksService.update(task.id, { dueDate: value || null });
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't update due date.", "error");
    } finally {
      setEditingDueDate(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await tasksService.remove(task.id);
      show("Task deleted.", "success");
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't delete task.", "error");
    } finally {
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  async function handleDuplicate() {
    try {
      await tasksService.duplicate(task.id);
      show("Task duplicated.", "success");
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't duplicate task.", "error");
    }
  }

  async function handleMove(direction: "up" | "down") {
    const idx = siblingIds.indexOf(task.id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= siblingIds.length) return;
    const reordered = [...siblingIds];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    try {
      await tasksService.reorder(projectId, task.parentTaskId, reordered);
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't reorder tasks.", "error");
    }
  }

  async function handleAddSubtask(e: FormEvent) {
    e.preventDefault();
    if (!subtaskTitle.trim()) return;
    try {
      await tasksService.create({ projectId, parentTaskId: task.id, title: subtaskTitle.trim() });
      setSubtaskTitle("");
      setAddingSubtask(false);
      setCollapsed(false);
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add subtask.", "error");
    }
  }

  const childSiblingIds = task.children.map((c) => c.id);

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-900/60",
          isReceding && "opacity-50",
        )}
        style={{ paddingLeft: `${depth * 20 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "flex h-5 w-5 items-center justify-center text-neutral-400",
            task.children.length === 0 && "invisible",
          )}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? "Mark as not done" : "Mark as done"}
          onClick={toggleComplete}
          disabled={busy}
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            isDone
              ? "border-green-500 bg-green-500 text-white"
              : "border-neutral-300 dark:border-neutral-600",
          )}
        >
          {isDone && <span className="text-[10px] leading-none">✓</span>}
        </button>

        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm text-neutral-800 dark:text-neutral-100",
            isReceding && "line-through",
          )}
        >
          {task.title}
          {task.taskType === "item" && (
            <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {task.itemState ?? "need"}
            </span>
          )}
        </button>

        {task.blockedByIncomplete && (
          <span
            title={`Waiting on: ${task.dependsOn.map((d) => d.title).join(", ")}`}
            className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"
          >
            <Link2 className="h-3 w-3" /> Blocked
          </span>
        )}

        {task.status !== "todo" && task.status !== "done" && <StatusBadge status={task.status} />}

        <DropdownMenu
          align="right"
          trigger={
            <span className="rounded px-1.5 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <PriorityBadge priority={task.priority} />
            </span>
          }
        >
          {(close) => (
            <>
              {TASK_PRIORITIES.map((p) => (
                <MenuItem
                  key={p}
                  onClick={() => {
                    setPriority(p);
                    close();
                  }}
                >
                  {priorityLabel[p]}
                </MenuItem>
              ))}
            </>
          )}
        </DropdownMenu>

        {editingDueDate ? (
          <Input
            type="date"
            autoFocus
            defaultValue={task.dueDate ?? ""}
            onBlur={(e) => setDueDate(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditingDueDate(false);
            }}
            className="w-32 py-1 text-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingDueDate(true)}
            className={cn(
              "flex items-center gap-1 whitespace-nowrap text-[11px]",
              overdue ? "font-medium text-red-600 dark:text-red-400" : "text-neutral-400",
            )}
          >
            <Clock className="h-3 w-3" />
            {task.dueDate ? relativeDueLabel(task.dueDate) : "No date"}
          </button>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setAddingSubtask(true)}
            title="Add subtask"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onExpandAi(task.id, task.children.length > 0)}
            title={task.children.length > 0 ? "Expand deeper with AI" : "Expand with AI"}
            disabled={isExpanding}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-indigo-600 dark:hover:bg-neutral-800"
          >
            <Sparkles className={cn("h-3.5 w-3.5", isExpanding && "animate-pulse text-indigo-500")} />
          </button>
          <DropdownMenu
            trigger={
              <span className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </span>
            }
          >
            {(close) => (
              <>
                <MenuItem
                  onClick={() => {
                    handleMove("up");
                    close();
                  }}
                >
                  <GripVertical className="h-3.5 w-3.5" /> Move up
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleMove("down");
                    close();
                  }}
                >
                  <GripVertical className="h-3.5 w-3.5" /> Move down
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleDuplicate();
                    close();
                  }}
                >
                  <Copy className="h-3.5 w-3.5" /> Duplicate
                </MenuItem>
                <MenuItem
                  danger
                  onClick={() => {
                    setConfirmingDelete(true);
                    close();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </MenuItem>
              </>
            )}
          </DropdownMenu>
        </div>
      </div>

      {addingSubtask && (
        <form
          onSubmit={handleAddSubtask}
          style={{ paddingLeft: `${(depth + 1) * 20 + 30}px` }}
          className="flex items-center gap-2 py-1"
        >
          <Input
            autoFocus
            placeholder="New subtask…"
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            onBlur={() => {
              if (!subtaskTitle.trim()) setAddingSubtask(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setAddingSubtask(false);
            }}
            className="max-w-xs py-1 text-sm"
          />
        </form>
      )}

      {!collapsed &&
        task.children.map((child) => (
          <TaskRow
            key={child.id}
            task={child}
            depth={depth + 1}
            siblingIds={childSiblingIds}
            flatTasks={flatTasks}
            projectId={projectId}
            onRefresh={onRefresh}
            onExpandAi={onExpandAi}
            expandingTaskId={expandingTaskId}
          />
        ))}

      {editing && (
        <TaskEditModal
          task={task}
          flatTasks={flatTasks}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onRefresh();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete task"
        message={
          task.children.length > 0
            ? `Delete "${task.title}" and its ${task.children.length} subtask(s)? This can't be undone.`
            : `Delete "${task.title}"? This can't be undone.`
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
        loading={busy}
      />
    </div>
  );
}
