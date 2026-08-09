import { invoke } from "@tauri-apps/api/core";

export async function desktopHealth(): Promise<string> {
  return invoke<string>("health");
}
