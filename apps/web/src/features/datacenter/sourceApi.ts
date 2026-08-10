import { invoke } from "@tauri-apps/api/core";
import { open as openDirectoryDialog } from "@tauri-apps/plugin-dialog";

export type LocalSource = {
  source_id: string;
  project_id: string;
  directory: string;
  status: string;
  watcher_enabled: boolean;
  debounce_seconds: number;
  registered_at: string;
  updated_at: string;
  last_scan_at: string | null;
  last_error: string | null;
};

export const DEFAULT_DEBOUNCE_SECONDS = 5;

export function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

export async function pickSourceDirectory(): Promise<string | null> {
  const selected = await openDirectoryDialog({
    directory: true,
    multiple: false,
    title: "Chọn thư mục dữ liệu gốc",
  });
  return typeof selected === "string" ? selected : null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function getLocalManifestPath(projectId: string): Promise<string> {
  return invoke<string>("get_local_manifest_path", { projectId });
}

export async function listLocalSources(manifestPath: string, projectId: string): Promise<LocalSource[]> {
  return invoke<LocalSource[]>("list_local_sources", { manifestPath, projectId });
}

export async function registerLocalSource(
  manifestPath: string,
  projectId: string,
  directory: string,
): Promise<LocalSource> {
  return invoke<LocalSource>("register_local_source", {
    manifestPath,
    projectId,
    directory,
    debounceSeconds: DEFAULT_DEBOUNCE_SECONDS,
    registeredAt: nowIso(),
  });
}

export async function scanSourceDirectory(manifestPath: string, sourceId: string): Promise<number> {
  return invoke<number>("scan_source_directory", {
    manifestPath,
    sourceId,
    debounceSeconds: DEFAULT_DEBOUNCE_SECONDS,
    observedAt: Math.floor(Date.now() / 1000),
  });
}

export async function startSourceWatcher(manifestPath: string, sourceId: string): Promise<void> {
  return invoke("start_source_watcher", {
    manifestPath,
    sourceId,
    debounceSeconds: DEFAULT_DEBOUNCE_SECONDS,
    updatedAt: nowIso(),
  });
}

export async function stopSourceWatcher(manifestPath: string, sourceId: string): Promise<void> {
  return invoke("stop_source_watcher", {
    manifestPath,
    sourceId,
    updatedAt: nowIso(),
  });
}

export async function archiveLocalSource(manifestPath: string, sourceId: string): Promise<boolean> {
  return invoke<boolean>("archive_local_source", {
    manifestPath,
    sourceId,
    archivedAt: nowIso(),
  });
}
