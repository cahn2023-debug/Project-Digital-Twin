import { invoke } from "@tauri-apps/api/core";

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

export async function desktopHealth(): Promise<string> {
  return invoke<string>("health");
}

export async function scanLocalDirectory(
  manifestPath: string,
  directory: string,
  debounceSeconds: number,
  observedAt: number,
): Promise<number> {
  return invoke<number>("scan_local_directory", {
    manifestPath,
    directory,
    debounceSeconds,
    observedAt,
  });
}

export async function startLocalWatcher(
  manifestPath: string,
  directory: string,
  debounceSeconds: number,
): Promise<void> {
  return invoke("start_local_watcher", { manifestPath, directory, debounceSeconds });
}

export async function stopLocalWatcher(): Promise<void> {
  return invoke("stop_local_watcher");
}

export async function registerLocalSource(
  manifestPath: string,
  projectId: string,
  directory: string,
  debounceSeconds: number,
  registeredAt: string,
): Promise<LocalSource> {
  return invoke<LocalSource>("register_local_source", {
    manifestPath,
    projectId,
    directory,
    debounceSeconds,
    registeredAt,
  });
}

export async function listLocalSources(
  manifestPath: string,
  projectId: string,
): Promise<LocalSource[]> {
  return invoke<LocalSource[]>("list_local_sources", { manifestPath, projectId });
}

export async function scanSourceDirectory(
  manifestPath: string,
  sourceId: string,
  debounceSeconds: number,
  observedAt: number,
): Promise<number> {
  return invoke<number>("scan_source_directory", {
    manifestPath,
    sourceId,
    debounceSeconds,
    observedAt,
  });
}

export async function startSourceWatcher(
  manifestPath: string,
  sourceId: string,
  debounceSeconds: number,
  updatedAt: string,
): Promise<void> {
  return invoke("start_source_watcher", { manifestPath, sourceId, debounceSeconds, updatedAt });
}

export async function stopSourceWatcher(
  manifestPath: string,
  sourceId: string,
  updatedAt: string,
): Promise<void> {
  return invoke("stop_source_watcher", { manifestPath, sourceId, updatedAt });
}
