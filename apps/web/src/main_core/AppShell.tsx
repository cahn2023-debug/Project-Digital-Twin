import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { Icon, Button, Panel, StatusBadge } from "../shared/ui";
import { AuditView } from "../features/audit/AuditView";
import { DatacenterView } from "../features/datacenter/DatacenterView";
import { ConflictDashboard } from "../features/sync";
import { DashboardView } from "../features/dashboard/DashboardView";
import { DesignView } from "../features/design/DesignView";
import { OperateView } from "../features/operate/OperateView";
import { OrganizeView } from "../features/organize/OrganizeView";
import { ProjectCreateDialog, ProjectDialog } from "../features/project-lifecycle/ProjectDialogs";
import type { ModuleKey } from "../shared/types";
import { modules, moduleTabs } from "./navigation";
import { useProjectContext } from "./ProjectContext";
import { useNotifications } from "./notifications";

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleKey>("datacenter");
  const [activeSideItem, setActiveSideItem] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = window.localStorage.getItem("pp-theme");
    return saved === "dark" ? "dark" : "light";
  });
  const searchRef = useRef<HTMLInputElement>(null);

  const { toast, showToast } = useNotifications();
  const {
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
    closeProjectDialog,
    openCreateProject,
    openDeleteProject,
    handleCreateProject,
    archiveProject,
    restoreProject,
    handleDeleteProject,
  } = useProjectContext(showToast);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("pp-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        showToast("Global Search sẵn sàng");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentModule = modules[activeModule];
  const sidePrimary = currentModule.sections.slice(0, 6);
  const sideSecondary = currentModule.sections.slice(6);

  const activateModule = (module: ModuleKey) => {
    setActiveModule(module);
    setActiveSideItem(modules[module].sections[0].key);
  };

  const renderView = () => {
    if (activeModule === "datacenter") {
      if (activeSideItem === "audit") return <AuditView onAction={showToast} />;
      if (activeSideItem === "sync") return <ConflictDashboard onAction={showToast} />;
      return <DatacenterView onAction={showToast} onSearchChange={setSearchQuery} projectId={currentProject?.id ?? null} searchQuery={searchQuery} />;
    }
    if (activeModule === "design") return <DesignView onAction={showToast} />;
    if (activeModule === "operate") return <OperateView onAction={showToast} />;
    if (activeModule === "organize") return <OrganizeView onAction={showToast} onAddDataSource={() => activateModule("datacenter")} onCreateProject={openCreateProject} projectId={currentProject?.id ?? null} />;
    return <DashboardView onAction={showToast} />;
  };

  return (
    <div className={"app-shell" + (sidebarCollapsed ? " sidebar-collapsed" : "")}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Icon name="grid" size={19} /></div>
          <div><div className="brand-title">Project Platform</div><div className="brand-sub">Digital Twin Workspace</div></div>
        </div>
        <div className="project-switcher-shell">
          <button
            className="project-switcher"
            type="button"
            aria-expanded={projectMenuOpen}
            aria-haspopup="dialog"
            aria-label="Đổi project"
            onClick={() => setProjectMenuOpen(!projectMenuOpen)}
          >
            <div className="project-code">{currentProject?.code ?? "—"}</div>
            <div className="project-meta">
              <div className="project-name">{currentProject?.name ?? "Chưa có project active"}</div>
              <div className="project-line">
                <span><i className={"sync-dot " + connection.tone} />{connection.label}</span>
                <span>{currentProject ? currentProject.rootPath : "Tạo project để bắt đầu"}</span>
              </div>
            </div>
            <span className="project-chevron"><Icon name="chevron" size={16} /></span>
          </button>
          {projectMenuOpen ? (
            <div className="project-menu" role="dialog" aria-label="Project switcher">
              <div className="project-menu-head">
                <div><div className="panel-title">Projects</div><div className="panel-sub">Chọn workspace đang làm việc</div></div>
                <button className="button primary small" type="button" onClick={openCreateProject}><Icon name="plus" size={13} />Tạo</button>
              </div>
              <div className="project-menu-tabs" role="tablist" aria-label="Project filter">
                <button className={projectFilter === "active" ? "active" : ""} type="button" role="tab" aria-selected={projectFilter === "active"} onClick={() => setProjectFilter("active")}>Đang dùng ({projects.length})</button>
                <button className={projectFilter === "archived" ? "active" : ""} type="button" role="tab" aria-selected={projectFilter === "archived"} onClick={() => setProjectFilter("archived")}>Archived ({archivedProjects.length})</button>
              </div>
              {projectError ? <div className="project-menu-error" role="alert">{projectError}</div> : null}
              {projectLoading ? <div className="project-menu-empty">Đang tải project…</div> : null}
              {!projectLoading && (projectFilter === "active" ? projects : archivedProjects).length === 0 ? (
                <div className="project-menu-empty">{projectFilter === "active" ? "Chưa có project active." : "Không có project archived."}</div>
              ) : null}
              {!projectLoading ? (projectFilter === "active" ? projects : archivedProjects).map((project) => (
                <div className={"project-menu-item" + (project.id === currentProject?.id ? " selected" : "")} key={project.id}>
                  <button
                    className="project-menu-main"
                    type="button"
                    disabled={project.status !== "ACTIVE"}
                    onClick={() => { setSelectedProjectId(project.id); setProjectMenuOpen(false); }}
                  >
                    <span className="project-menu-code">{project.code}</span>
                    <span className="project-menu-copy"><strong>{project.name}</strong><small>{project.rootPath}</small></span>
                  </button>
                  <div className="project-menu-item-actions">
                    {project.status === "ACTIVE" ? (
                      <>
                        <button className="text-button" type="button" onClick={() => void archiveProject(project)} disabled={projectBusy}>Archive</button>
                        <button className="text-button danger-text" type="button" onClick={() => openDeleteProject(project)} disabled={projectBusy}>Xóa</button>
                      </>
                    ) : (
                      <button className="text-button" type="button" onClick={() => void restoreProject(project)} disabled={projectBusy}>Khôi phục</button>
                    )}
                  </div>
                </div>
              )) : null}
            </div>
          ) : null}
        </div>
        <div className="topbar-spacer" />
        <label className="quick-search">
          <Icon name="search" size={15} />
          <input ref={searchRef} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Tìm entity, file, nhà thầu…" aria-label="Tìm entity, file, nhà thầu" />
          <span className="shortcut">Ctrl K</span>
        </label>
        <button className="icon-btn" type="button" aria-label="Đổi giao diện" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"} size={17} /></button>
        <button className="icon-btn" type="button" aria-label="Thông báo" onClick={() => showToast("Bạn không có thông báo mới")}><Icon name="bell" size={17} /></button>
        <div className="avatar">MH</div>
      </header>

      <aside className="sidebar">
        <div className="side-head"><span className="side-head-title">{currentModule.label}</span><button className="icon-btn" type="button" aria-label={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}><Icon name="menu" size={17} /></button></div>
        <div className="side-scroll">
          <div className="side-section"><div className="side-label">Workspace</div>{sidePrimary.map((item) => <button className={"side-item" + (activeSideItem === item.key ? " active" : "")} key={item.key} type="button" onClick={() => { setActiveSideItem(item.key); showToast(currentModule.label + " / " + item.label); }}><Icon name={item.icon} size={16} /><span className="side-text">{item.label}</span>{item.count ? <span className="mini-count">{item.count}</span> : null}</button>)}</div>
          {sideSecondary.length ? <div className="side-section"><div className="side-label">Khác</div>{sideSecondary.map((item) => <button className={"side-item" + (activeSideItem === item.key ? " active" : "")} key={item.key} type="button" onClick={() => { setActiveSideItem(item.key); showToast(currentModule.label + " / " + item.label); }}><Icon name={item.icon} size={16} /><span className="side-text">{item.label}</span>{item.count ? <span className="mini-count">{item.count}</span> : null}</button>)}</div> : null}
        </div>
        <div className="sidebar-foot"><div className="storage-card"><div className="storage-line"><span>Project storage</span><b>0%</b></div><div className="progress"><span style={{ width: "0%" }} /></div><div className="meta-line storage-meta">0 B / 10 GB • local + synced assets</div></div></div>
      </aside>

      <nav className="module-tabs" aria-label="Modules">
        {moduleTabs.map((module) => {
          const config = modules[module];
          return <button className={"module-tab" + (module === activeModule ? " active" : "")} data-view={module} key={module} type="button" onClick={() => activateModule(module)}><Icon name={config.icon} size={16} />{config.label}{config.count ? <span className="count-badge">{config.count}</span> : null}</button>;
        })}
      </nav>

      <main>{renderView()}</main>
      {toast ? <div className="toast show" role="status"><Icon name="check" size={15} /><span>{toast}</span></div> : null}
      {projectDialog === "create" ? (
        <ProjectCreateDialog
          busy={projectBusy}
          error={projectError}
          name={projectDraftName}
          onClose={closeProjectDialog}
          onError={setProjectError}
          onNameChange={setProjectDraftName}
          onRootPathChange={setProjectDraftRoot}
          onSubmit={handleCreateProject}
          projectOptions={projectOptions}
          rootPath={projectDraftRoot}
        />
      ) : projectDialog === "delete" ? (
        <ProjectDialog
          busy={projectBusy}
          error={projectError}
          mode="delete"
          name={projectDraftName}
          onClose={closeProjectDialog}
          onNameChange={setProjectDraftName}
          onRootPathChange={setProjectDraftRoot}
          onSubmit={handleDeleteProject}
          project={projectDialogTarget}
          rootPath={projectDraftRoot}
        />
      ) : null}
    </div>
  );
}
