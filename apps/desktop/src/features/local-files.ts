import { invoke } from "@tauri-apps/api/core";

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
