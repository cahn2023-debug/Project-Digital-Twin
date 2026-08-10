import { useEffect, useRef, type ChangeEvent, type FormEvent } from "react";
import type { Project } from "@project/domain";
import { open as openDirectoryDialog } from "@tauri-apps/plugin-dialog";

export function ProjectDialog({
  busy,
  error,
  mode,
  name,
  onClose,
  onNameChange,
  onRootPathChange,
  onSubmit,
  project,
  rootPath,
}: {
  busy: boolean;
  error: string;
  mode: "create" | "delete";
  name: string;
  onClose: () => void;
  onNameChange: (value: string) => void;
  onRootPathChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  project: Project | null;
  rootPath: string;
}) {
  const deleting = mode === "delete";
  return (
    <div className="project-modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <form className="project-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="project-modal-head">
          <div>
            <div className="panel-title">{deleting ? "Xóa project vĩnh viễn" : "Tạo project mới"}</div>
            <div className="panel-sub">
              {deleting ? "Dữ liệu hệ thống vẫn được giữ dưới dạng tombstone." : "Chọn một thư mục gốc đã tồn tại trên máy."}
            </div>
          </div>
          <button className="icon-btn" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </div>
        {deleting ? (
          <div className="project-danger-note">
            Project <strong>{project?.name}</strong> sẽ bị loại khỏi workspace active. Thư mục gốc không bị xóa hoặc thay đổi.
          </div>
        ) : null}
        <label className="project-field">
          <span>{deleting ? "Nhập lại chính xác tên project" : "Tên project"}</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={deleting ? project?.name : "Ví dụ: Tuyến giao thông trung tâm"}
            aria-label={deleting ? "Xác nhận tên project" : "Tên project"}
          />
        </label>
        {!deleting ? (
          <label className="project-field">
            <span>Đường dẫn thư mục gốc</span>
            <input
              value={rootPath}
              onChange={(event) => onRootPathChange(event.target.value)}
              placeholder="Ví dụ: C:\\Projects\\DigitalTwin"
              aria-label="Đường dẫn thư mục gốc"
            />
            <small>Thư mục phải tồn tại và chưa được gắn với project khác.</small>
          </label>
        ) : null}
        {error ? <div className="project-form-error" role="alert">{error}</div> : null}
        <div className="project-modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className={"button " + (deleting ? "danger" : "primary")} type="submit" disabled={busy || !name.trim() || (!deleting && !rootPath.trim())}>
            {busy ? "Đang xử lý…" : deleting ? "Xóa vĩnh viễn" : "Tạo project"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ProjectCreateDialog({
  busy,
  error,
  name,
  onClose,
  onError,
  onNameChange,
  onRootPathChange,
  onSubmit,
  projectOptions,
  rootPath,
}: {
  busy: boolean;
  error: string;
  name: string;
  onClose: () => void;
  onError: (message: string) => void;
  onNameChange: (value: string) => void;
  onRootPathChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  projectOptions: Project[];
  rootPath: string;
}) {
  const browserFolderInputRef = useRef<HTMLInputElement>(null);
  const existingProject = projectOptions.find((project) => project.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()) ?? null;
  const selectedPath = existingProject?.rootPath ?? rootPath;

  useEffect(() => {
    const input = browserFolderInputRef.current;
    input?.setAttribute("webkitdirectory", "");
    input?.setAttribute("directory", "");
  }, []);

  const pickDirectory = async () => {
    onError("");
    const tauriWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
    if (tauriWindow.__TAURI_INTERNALS__) {
      try {
        const selected = await openDirectoryDialog({
          directory: true,
          multiple: false,
          title: "Chọn thư mục project",
        });
        if (typeof selected === "string") onRootPathChange(selected);
      } catch (pickerError) {
        onError(pickerError instanceof Error ? pickerError.message : "Không thể mở cửa sổ chọn thư mục.");
      }
      return;
    }
    browserFolderInputRef.current?.click();
  };

  const handleBrowserDirectory = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] as (File & { path?: string }) | undefined;
    event.target.value = "";
    if (file?.path) {
      onRootPathChange(file.path);
      return;
    }
    onError("Trình duyệt không trả về đường dẫn tuyệt đối. Hãy mở ứng dụng Windows để chọn thư mục.");
  };

  return (
    <div className="project-modal-backdrop" role="presentation" onMouseDown={busy ? undefined : onClose}>
      <form className="project-modal project-create-modal" onSubmit={onSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="project-modal-head">
          <div>
            <div className="panel-title">Mở hoặc tạo project</div>
            <div className="panel-sub">Viết tên project mới hoặc chọn project cũ để mở.</div>
          </div>
          <button className="icon-btn" type="button" aria-label="Đóng" onClick={onClose}>×</button>
        </div>
        <div className="project-create-line">
          <label className="project-field project-name-inline">
            <span>Tên project mới hoặc project cũ</span>
            <input
              autoFocus
              list="project-options"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Nhập tên project"
              aria-label="Tên project mới hoặc project cũ"
            />
            <datalist id="project-options">
              {projectOptions.map((project) => <option key={project.id} value={project.name} label={`${project.status === "ACTIVE" ? "Đang dùng" : "Archived"} · ${project.rootPath}`} />)}
            </datalist>
          </label>
          <button className="button secondary folder-picker-button" type="button" onClick={() => void pickDirectory()} disabled={busy} title={selectedPath || "Chọn thư mục project"}>
            Chọn thư mục
          </button>
        </div>
        <div className="project-folder-selection" title={selectedPath}>
          {selectedPath || "Chưa chọn thư mục"}
        </div>
        <input ref={browserFolderInputRef} type="file" hidden onChange={handleBrowserDirectory} />
        {existingProject ? <div className="project-form-hint">Project cũ sẽ được mở{existingProject.status === "ARCHIVED" ? " và khôi phục" : ""}.</div> : null}
        {error ? <div className="project-form-error" role="alert">{error}</div> : null}
        <div className="project-modal-actions">
          <button className="button secondary" type="button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="button primary" type="submit" disabled={busy || !name.trim() || (!existingProject && !rootPath.trim())}>
            {busy ? "Đang xử lý…" : existingProject ? "Mở project" : "Tạo project"}
          </button>
        </div>
      </form>
    </div>
  );
}


