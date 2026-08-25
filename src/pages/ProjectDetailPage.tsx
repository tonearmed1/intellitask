import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { ProjectDetail } from "@/services/projects";
import { projectsService } from "@/services/projects";
import { flattenTree } from "@/features/tasks/flatten";
import { Spinner } from "@/components/Spinner";
import { PriorityBadge } from "@/components/Badge";
import { formatDate, relativeDueLabel } from "@/lib/dates";
import { DropdownMenu, MenuItem } from "@/components/DropdownMenu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";
import { ProjectEditModal } from "@/features/projects/ProjectEditModal";
import { PlanningPanel } from "@/features/projects/PlanningPanel";
import { MilestonesPanel } from "@/features/projects/MilestonesPanel";
import { AiActionsPanel } from "@/features/projects/AiActionsPanel";
import { TaskTree } from "@/features/tasks/TaskTree";
import { computeProjectPercent } from "@/features/tasks/flatten";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await projectsService.get(id);
      setDetail(res);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load this project.");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await projectsService.remove(id);
      show("Project deleted.", "success");
      navigate("/projects");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't delete project.", "error");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!detail) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const { project, tree, milestones } = detail;
  const flatTasks = flattenTree(tree);
  const percent = computeProjectPercent(flatTasks);

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {project.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-neutral-500 dark:text-neutral-400">
            <PriorityBadge priority={project.priority} />
            {project.deadline && (
              <span>
                {relativeDueLabel(project.deadline)} · {formatDate(project.deadline)}
              </span>
            )}
            {project.location && <span>{project.location}</span>}
            <span>{percent}% complete</span>
          </div>
        </div>
        <DropdownMenu
          trigger={
            <span className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <MoreHorizontal className="h-5 w-5" />
            </span>
          }
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  setEditing(true);
                  close();
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Edit project
              </MenuItem>
              <MenuItem
                danger
                onClick={() => {
                  setConfirmingDelete(true);
                  close();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete project
              </MenuItem>
            </>
          )}
        </DropdownMenu>
      </div>

      {project.projectSummary && (
        <p className="mb-6 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          {project.projectSummary}
        </p>
      )}

      <PlanningPanel project={project} onChanged={load} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MilestonesPanel projectId={project.id} milestones={milestones} onChanged={load} />
        <AiActionsPanel projectId={project.id} onChanged={load} />
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Tasks
        </h3>
        <TaskTree projectId={project.id} tree={tree} flatTasks={flatTasks} onRefresh={load} />
      </div>

      {editing && (
        <ProjectEditModal
          project={project}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete project"
        message={`Delete "${project.title}" and all of its tasks? This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
        loading={deleting}
      />
    </div>
  );
}
