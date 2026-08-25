import { useState } from "react";
import type { FormEvent } from "react";
import type { ItemState, Task, TaskPriority, TaskStatus, TaskWithChildren } from "@shared/types";
import { TASK_PRIORITIES, TASK_STATUSES } from "@shared/types";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Label, Select, Textarea } from "@/components/Input";
import { statusLabel, priorityLabel } from "@/components/Badge";
import { tasksService, type UpdateTaskInput } from "@/services/tasks";
import { dependenciesService } from "@/services/dependencies";
import { ApiError } from "@/lib/api";
import { useToast } from "@/components/Toast";

interface TaskEditModalProps {
  task: TaskWithChildren;
  flatTasks: Task[];
  onClose: () => void;
  onSaved: () => void;
}

const ITEM_STATES: ItemState[] = ["need", "ordered", "ready", "packed"];

export function TaskEditModal({ task, flatTasks, onClose, onSaved }: TaskEditModalProps) {
  const { show } = useToast();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    startDate: task.startDate ?? "",
    estimatedEffort: task.estimatedEffort ?? "",
    notes: task.notes ?? "",
    itemState: task.itemState,
  });
  const [saving, setSaving] = useState(false);
  const [addDepId, setAddDepId] = useState("");
  const [depBusyId, setDepBusyId] = useState<string | null>(null);

  const candidateDeps = flatTasks.filter(
    (t) =>
      t.id !== task.id &&
      t.projectId === task.projectId &&
      !task.dependsOn.some((d) => d.taskId === t.id),
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const patch: UpdateTaskInput = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        startDate: form.startDate || null,
        estimatedEffort: form.estimatedEffort || null,
        notes: form.notes || null,
        itemState: form.itemState,
      };
      await tasksService.update(task.id, patch);
      show("Task updated.", "success");
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't save the task.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddDependency() {
    if (!addDepId) return;
    setDepBusyId("new");
    try {
      await dependenciesService.create(task.id, addDepId);
      setAddDepId("");
      show("Dependency added.", "success");
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't add dependency.", "error");
    } finally {
      setDepBusyId(null);
    }
  }

  async function handleRemoveDependency(dependencyId: string) {
    setDepBusyId(dependencyId);
    try {
      await dependenciesService.remove(dependencyId);
      show("Dependency removed.", "success");
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't remove dependency.", "error");
    } finally {
      setDepBusyId(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit task" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="task-status">Status</Label>
            <Select
              id="task-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel[p]}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="task-due">Due date</Label>
            <Input
              id="task-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="task-start">Start date</Label>
            <Input
              id="task-start"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="task-effort">Estimated effort</Label>
            <Input
              id="task-effort"
              placeholder="e.g. 2h, 1d"
              value={form.estimatedEffort}
              onChange={(e) => setForm((f) => ({ ...f, estimatedEffort: e.target.value }))}
            />
          </div>
          {task.taskType === "item" && (
            <div>
              <Label htmlFor="task-item-state">Item status</Label>
              <Select
                id="task-item-state"
                value={form.itemState ?? "need"}
                onChange={(e) => setForm((f) => ({ ...f, itemState: e.target.value as ItemState }))}
              >
                {ITEM_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="task-notes">Notes</Label>
          <Textarea
            id="task-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {task.reason && (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800/60 dark:text-neutral-400">
            AI reasoning: {task.reason}
          </p>
        )}

        <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Label>Dependencies</Label>
          <ul className="mb-2 space-y-1">
            {task.dependsOn.map((d) => (
              <li
                key={d.dependencyId}
                className="flex items-center justify-between rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs dark:bg-neutral-800/60"
              >
                <span className="text-neutral-600 dark:text-neutral-300">Depends on: {d.title}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDependency(d.dependencyId)}
                  disabled={depBusyId === d.dependencyId}
                  className="text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              </li>
            ))}
            {task.dependsOn.length === 0 && (
              <li className="text-xs text-neutral-400">No dependencies.</li>
            )}
          </ul>
          <div className="flex gap-2">
            <Select value={addDepId} onChange={(e) => setAddDepId(e.target.value)} className="flex-1">
              <option value="">Add a dependency…</option>
              {candidateDeps.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddDependency}
              disabled={!addDepId || depBusyId === "new"}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
