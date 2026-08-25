import { useState } from "react";
import type { FormEvent } from "react";
import { Plus } from "lucide-react";
import type { Task, TaskWithChildren } from "@shared/types";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { tasksService } from "@/services/tasks";
import { TaskRow } from "./TaskRow";
import { useAiStages, TASK_EXPAND_STAGES } from "@/features/ai/useAiStages";

interface TaskTreeProps {
  projectId: string;
  tree: TaskWithChildren[];
  flatTasks: Task[];
  onRefresh: () => void;
}

export function TaskTree({ projectId, tree, flatTasks, onRefresh }: TaskTreeProps) {
  const { show } = useToast();
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [expandingTaskId, setExpandingTaskId] = useState<string | null>(null);
  const stageLabel = useAiStages(TASK_EXPAND_STAGES, expandingTaskId !== null);

  const rootIds = tree.map((t) => t.id);

  async function handleAddRoot(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await tasksService.create({ projectId, parentTaskId: null, title: newTitle.trim() });
      setNewTitle("");
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add task.", "error");
    } finally {
      setAdding(false);
    }
  }

  async function handleExpandAi(taskId: string, deeper: boolean) {
    setExpandingTaskId(taskId);
    try {
      await tasksService.expand(taskId, deeper);
      show("Subtasks added.", "success");
      onRefresh();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "AI expansion failed. Please try again.", "error");
    } finally {
      setExpandingTaskId(null);
    }
  }

  return (
    <div>
      {expandingTaskId && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
          {stageLabel}…
        </div>
      )}

      {tree.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add your first workstream or task below."
        />
      ) : (
        <div>
          {tree.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              depth={0}
              siblingIds={rootIds}
              flatTasks={flatTasks}
              projectId={projectId}
              onRefresh={onRefresh}
              onExpandAi={handleExpandAi}
              expandingTaskId={expandingTaskId}
            />
          ))}
        </div>
      )}

      <form onSubmit={handleAddRoot} className="mt-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-neutral-400" />
        <Input
          placeholder="Add a workstream or task…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="max-w-sm py-1.5 text-sm"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={adding || !newTitle.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}
