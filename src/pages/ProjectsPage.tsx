import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Sparkles, ListTodo } from "lucide-react";
import type { ProjectWithStats } from "@shared/types";
import { projectsService } from "@/services/projects";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { EmptyState } from "@/components/EmptyState";
import { ProjectCard } from "@/features/projects/ProjectCard";
import { NewProjectModal } from "@/features/projects/NewProjectModal";
import { DropdownMenu, MenuItem } from "@/components/DropdownMenu";
import { useToast } from "@/components/Toast";
import { ApiError } from "@/lib/api";

export default function ProjectsPage() {
  const { show } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectWithStats[] | null>(null);
  const [modalMode, setModalMode] = useState<"quick" | "ai" | null>(null);

  const newParam = searchParams.get("new");
  const titleParam = searchParams.get("title") ?? undefined;

  useEffect(() => {
    if (newParam === "ai" || newParam === "quick") {
      setModalMode(newParam);
    }
  }, [newParam]);

  const load = useCallback(async () => {
    try {
      const res = await projectsService.list();
      setProjects(res.projects);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Couldn't load projects.", "error");
    }
  }, [show]);

  useEffect(() => {
    load();
  }, [load]);

  function closeModal() {
    setModalMode(null);
    if (newParam) {
      searchParams.delete("new");
      searchParams.delete("title");
      setSearchParams(searchParams, { replace: true });
    }
  }

  const activeProjects = projects?.filter((p) => p.status === "active") ?? [];
  const otherProjects = projects?.filter((p) => p.status !== "active") ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Projects</h1>
        <DropdownMenu
          trigger={
            <span className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
              <Plus className="h-4 w-4" /> New
            </span>
          }
        >
          {(close) => (
            <>
              <MenuItem
                onClick={() => {
                  setModalMode("ai");
                  close();
                }}
              >
                <Sparkles className="h-3.5 w-3.5" /> AI project
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setModalMode("quick");
                  close();
                }}
              >
                <ListTodo className="h-3.5 w-3.5" /> Quick task
              </MenuItem>
            </>
          )}
        </DropdownMenu>
      </div>

      {projects === null ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-6 w-6" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Describe an outcome and let Intellitask work out what needs to happen."
          action={
            <Button variant="primary" onClick={() => setModalMode("ai")}>
              Build your first plan
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          <section>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </section>
          {otherProjects.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Completed & archived
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {modalMode && (
        <NewProjectModal
          mode={modalMode}
          initialTitle={titleParam}
          onClose={closeModal}
          onCreated={() => load()}
        />
      )}
    </div>
  );
}
