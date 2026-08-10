import { useEffect, useState, type FormEvent } from "react";
import type { Project } from "@project/domain";
import { apiBase, requestJson } from "../shared/api";
import type { Tone } from "../shared/types";
import { toProject, type ApiProject } from "../features/project-lifecycle/api";

import type { RecentProjectItem } from "../features/project-lifecycle/WelcomeLauncherHub";

export function useProjectContext(showToast: (message: string) => void) {
  const [connection, setConnection] = useState({ label: "Đang kết nối API", tone: "warning" as Tone });
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    return window.localStorage.getItem("pp-active-project-id");
  });
  const [recentProjects, setRecentProjects] = useState<RecentProjectItem[]>(() => {
    try {
      const saved = window.localStorage.getItem("pp-recent-projects");
      return saved ? (JSON.parse(saved) as RecentProjectItem[]) : [];
    } catch {
      return [];
    }
  });
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState<"active" | "archived">("active");
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectDialog, setProjectDialog] = useState<"create" | "delete" | null>(null);
  const [projectDialogTarget, setProjectDialogTarget] = useState<Project | null>(null);
  const [projectDraftName, setProjectDraftName] = useState("");
  const [projectDraftRoot, setProjectDraftRoot] = useState("");
  const [projectError, setProjectError] = useState("");
  const [projectBusy, setProjectBusy] = useState(false);

  const currentProject = selectedProjectId ? (projects.find((project) => project.id === selectedProjectId) ?? null) : null;
  const projectOptions = [...projects, ...archivedProjects];

  const saveActiveProject = (id: string | null) => {
    setSelectedProjectId(id);
    if (id) {
      window.localStorage.setItem("pp-active-project-id", id);
    } else {
      window.localStorage.removeItem("pp-active-project-id");
    }
  };

  const addRecentProject = (item: RecentProjectItem) => {
    setRecentProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== item.id);
      const updated = [item, ...filtered];
      window.localStorage.setItem("pp-recent-projects", JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentProject = (id: string) => {
    setRecentProjects((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      window.localStorage.setItem("pp-recent-projects", JSON.stringify(updated));
      return updated;
    });
    showToast("Đã xóa khỏi danh sách gần đây");
  };

  const closeCurrentProject = () => {
    saveActiveProject(null);
    setProjectMenuOpen(false);
    showToast("Đã đóng dự án hiện tại");
  };

  const refreshProjects = async (preferredId?: string): Promise<boolean> => {
    setProjectLoading(true);
    try {
      const [active, archived] = await Promise.all([
        requestJson<ApiProject[]>("/api/v1/projects?status=ACTIVE"),
        requestJson<ApiProject[]>("/api/v1/projects?status=ARCHIVED"),
      ]);
      const nextProjects = active.map(toProject);
      setProjects(nextProjects);
      setArchivedProjects(archived.map(toProject));
      
      setSelectedProjectId((previous) => {
        if (preferredId && nextProjects.some((project) => project.id === preferredId)) return preferredId;
        if (previous && nextProjects.some((project) => project.id === previous)) return previous;
        return null;
      });
      setProjectError("");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể tải danh sách project";
      setProjectError(message);
      setConnection({ label: "Projects offline", tone: "danger" });
      return false;
    } finally {
      setProjectLoading(false);
    }
  };

  useEffect(() => {
    fetch(apiBase + "/health/live")
      .then((response) => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json() as Promise<{ status: string }>;
      })
      .then((health) => setConnection({ label: "API " + health.status, tone: "success" }))
      .catch(() => setConnection({ label: "API offline", tone: "danger" }));
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, []);

  const closeProjectDialog = () => {
    setProjectDialog(null);
    setProjectDialogTarget(null);
    setProjectDraftName("");
    setProjectDraftRoot("");
    setProjectError("");
  };

  const openCreateProject = () => {
    setProjectMenuOpen(false);
    setProjectDialog("create");
    setProjectDraftName("");
    setProjectDraftRoot("");
    setProjectError("");
  };

  const openDeleteProject = (project: Project) => {
    setProjectMenuOpen(false);
    setProjectDialog("delete");
    setProjectDialogTarget(project);
    setProjectDraftName("");
    setProjectError("");
  };

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProjectError("");
    const existingProject = projectOptions.find((project) => project.name.toLocaleLowerCase() === projectDraftName.trim().toLocaleLowerCase());
    if (existingProject) {
      setProjectBusy(true);
      try {
        if (existingProject.status === "ARCHIVED") {
          const restored = await requestJson<ApiProject>(`/api/v1/projects/${existingProject.id}/restore`, { method: "POST" });
          if (!await refreshProjects(restored.id)) throw new Error("Project đã khôi phục nhưng không thể tải lại danh sách");
          setProjectFilter("active");
          saveActiveProject(restored.id);
          addRecentProject({ id: restored.id, name: restored.name, rootPath: restored.root_path, status: "ACTIVE" });
        } else {
          saveActiveProject(existingProject.id);
          addRecentProject({ id: existingProject.id, name: existingProject.name, rootPath: existingProject.rootPath, status: "ACTIVE" });
        }
        closeProjectDialog();
        showToast(`Đã mở project ${existingProject.name}`);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : "Không thể mở project");
      } finally {
        setProjectBusy(false);
      }
      return;
    }
    setProjectBusy(true);
    try {
      const created = await requestJson<ApiProject>("/api/v1/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectDraftName.trim(), root_path: projectDraftRoot.trim() }),
      });
      if (!await refreshProjects(created.id)) throw new Error("Project đã tạo nhưng không thể tải lại danh sách");
      saveActiveProject(created.id);
      addRecentProject({ id: created.id, name: created.name, rootPath: created.root_path, status: "ACTIVE" });
      closeProjectDialog();
      showToast("Đã tạo và chọn project mới");
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể tạo project");
    } finally {
      setProjectBusy(false);
    }
  };

  const archiveProject = async (project: Project) => {
    setProjectBusy(true);
    setProjectError("");
    try {
      await requestJson<ApiProject>(`/api/v1/projects/${project.id}/archive`, { method: "POST" });
      if (!await refreshProjects()) throw new Error("Đã archive nhưng không thể tải lại danh sách project");
      showToast(`Đã archive ${project.name}`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể archive project");
    } finally {
      setProjectBusy(false);
    }
  };

  const restoreProject = async (project: Project) => {
    setProjectBusy(true);
    setProjectError("");
    try {
      const restored = await requestJson<ApiProject>(`/api/v1/projects/${project.id}/restore`, { method: "POST" });
      if (!await refreshProjects(restored.id)) throw new Error("Đã khôi phục nhưng không thể tải lại danh sách project");
      setProjectFilter("active");
      showToast(`Đã khôi phục ${project.name}`);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể khôi phục project");
    } finally {
      setProjectBusy(false);
    }
  };

  const handleDeleteProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectDialogTarget) return;
    if (projectDraftName.trim() !== projectDialogTarget.name) {
      setProjectError("Tên xác nhận không khớp.");
      return;
    }
    setProjectBusy(true);
    setProjectError("");
    try {
      await requestJson<ApiProject>(`/api/v1/projects/${projectDialogTarget.id}`, {
        method: "DELETE",
        body: JSON.stringify({ name: projectDraftName.trim() }),
      });
      if (!await refreshProjects()) throw new Error("Đã xóa nhưng không thể tải lại danh sách project");
      closeProjectDialog();
      showToast("Project đã được đánh dấu đã xóa; thư mục gốc được giữ nguyên");
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Không thể xóa project");
    } finally {
      setProjectBusy(false);
    }
  };


  return {
    connection,
    projects,
    archivedProjects,
    currentProject,
    projectOptions,
    setSelectedProjectId,
    projectMenuOpen,
    setProjectMenuOpen,
    projectFilter,
    setProjectFilter,
    projectLoading,
    projectDialog,
    projectDialogTarget,
    projectDraftName,
    setProjectDraftName,
    projectDraftRoot,
    setProjectDraftRoot,
    projectError,
    setProjectError,
    projectBusy,
    recentProjects,
    saveActiveProject,
    addRecentProject,
    removeRecentProject,
    closeCurrentProject,
    refreshProjects,
    closeProjectDialog,
    openCreateProject,
    openDeleteProject,
    handleCreateProject,
    archiveProject,
    restoreProject,
    handleDeleteProject,
  };
}
