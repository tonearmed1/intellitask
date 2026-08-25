import { useState } from "react";
import type { FormEvent } from "react";
import type { Project, TaskPriority } from "@shared/types";
import { TASK_PRIORITIES } from "@shared/types";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, Label, Select, Textarea } from "@/components/Input";
import { priorityLabel } from "@/components/Badge";
import { projectsService } from "@/services/projects";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";

export function ProjectEditModal({
  project,
  onClose,
  onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { show } = useToast();
  const [form, setForm] = useState({
    title: project.title,
    description: project.description ?? "",
    deadline: project.deadline ?? "",
    location: project.location ?? "",
    priority: project.priority,
    notes: project.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await projectsService.update(project.id, {
        title: form.title,
        description: form.description || null,
        deadline: form.deadline || null,
        location: form.location || null,
        priority: form.priority as TaskPriority,
        notes: form.notes || null,
      });
      show("Project updated.", "success");
      onSaved();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't save project.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="proj-title">Title</Label>
          <Input
            id="proj-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="proj-description">Description</Label>
          <Textarea
            id="proj-description"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="proj-deadline">Deadline</Label>
            <Input
              id="proj-deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="proj-priority">Priority</Label>
            <Select
              id="proj-priority"
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
        <div>
          <Label htmlFor="proj-location">Location</Label>
          <Input
            id="proj-location"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="proj-notes">Notes</Label>
          <Textarea
            id="proj-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
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
