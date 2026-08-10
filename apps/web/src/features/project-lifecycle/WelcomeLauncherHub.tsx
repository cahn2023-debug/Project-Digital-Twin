import { useState } from "react";
import type { Project } from "@project/domain";
import { Icon, Button } from "../../shared/ui";

export interface RecentProjectItem {
  id: string;
  name: string;
  rootPath: string;
  lastOpenedAt?: string;
  status?: "ACTIVE" | "ARCHIVED" | "MISSING";
}

interface WelcomeLauncherHubProps {
  recentProjects: RecentProjectItem[];
  allProjects: Project[];
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => void;
  onOpenProjectFromDisk: () => void;
  onRemoveRecentProject: (projectId: string) => void;
}

export function WelcomeLauncherHub({
  recentProjects,
  allProjects,
  onSelectProject,
  onCreateProject,
  onOpenProjectFromDisk,
  onRemoveRecentProject,
}: WelcomeLauncherHubProps) {
  const [missingError, setMissingError] = useState<string | null>(null);

  // Combine server projects and stored recent projects
  const displayProjects = Array.from(
    new Map(
      [
        ...recentProjects,
        ...allProjects.map((p) => ({
          id: p.id,
          name: p.name,
          rootPath: p.rootPath,
          status: (p.status || "ACTIVE") as "ACTIVE" | "ARCHIVED",
        })),
      ].map((item) => [item.id, item])
    ).values()
  );

  const handleOpenRecent = (item: RecentProjectItem) => {
    setMissingError(null);
    if (item.status === "MISSING") {
      setMissingError(`Thư mục hoặc dự án tại "${item.rootPath}" không còn tồn tại trên hệ thống.`);
      return;
    }
    onSelectProject(item.id);
  };

  return (
    <div className="welcome-launcher-container">
      <div className="welcome-launcher-card">
        <div className="welcome-launcher-header">
          <div className="welcome-brand-mark">
            <Icon name="grid" size={32} />
          </div>
          <div className="welcome-header-text">
            <h1 className="welcome-title">Project Digital Twin Platform</h1>
            <p className="welcome-subtitle">
              Hệ thống quản lý và vận hành mô hình số dự án hạ tầng & công trình
            </p>
          </div>
        </div>

        <div className="welcome-actions-row">
          <button
            className="button primary large welcome-btn"
            type="button"
            onClick={onCreateProject}
          >
            <Icon name="plus" size={18} />
            <span>Tạo dự án mới</span>
          </button>

          <button
            className="button secondary large welcome-btn"
            type="button"
            onClick={onOpenProjectFromDisk}
          >
            <Icon name="folder" size={18} />
            <span>Mở dự án từ ổ đĩa</span>
          </button>
        </div>

        {missingError ? (
          <div className="welcome-error-banner" role="alert">
            <Icon name="alert" size={16} />
            <span>{missingError}</span>
          </div>
        ) : null}

        <div className="recent-projects-section">
          <div className="recent-projects-header">
            <h3>Dự án gần đây ({displayProjects.length})</h3>
            <span className="recent-projects-hint">
              Chọn dự án bên dưới để bắt đầu làm việc
            </span>
          </div>

          {displayProjects.length === 0 ? (
            <div className="recent-projects-empty">
              <Icon name="grid" size={24} />
              <p>Chưa có dự án nào được mở hoặc tạo mới trên ứng dụng.</p>
              <small>Bấm "Tạo dự án mới" ở trên để bắt đầu dự án đầu tiên của bạn.</small>
            </div>
          ) : (
            <div className="recent-projects-grid">
              {displayProjects.map((item) => (
                <div
                  className={`recent-project-card ${item.status === "MISSING" ? "missing" : ""}`}
                  key={item.id}
                  onClick={() => handleOpenRecent(item)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="recent-card-icon">
                    <Icon name="folder" size={20} />
                  </div>
                  <div className="recent-card-body">
                    <div className="recent-card-title">{item.name}</div>
                    <div className="recent-card-path">{item.rootPath}</div>
                  </div>
                  <div className="recent-card-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="text-button danger-text"
                      type="button"
                      title="Xóa khỏi danh sách gần đây"
                      onClick={() => onRemoveRecentProject(item.id)}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
