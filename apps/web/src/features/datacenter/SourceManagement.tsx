import { useCallback, useEffect, useState } from "react";
import { Button, Icon, Panel, StatusBadge } from "../../shared/ui";
import type { Tone } from "../../shared/types";
import {
  getLocalManifestPath,
  isDesktopRuntime,
  listLocalSources,
  nowIso,
  pickSourceDirectory,
  registerLocalSource,
  scanSourceDirectory,
  startSourceWatcher,
  stopSourceWatcher,
  type LocalSource,
} from "./sourceApi";

type SourceManagementModel = {
  sources: LocalSource[];
  queuedCounts: Record<string, number>;
  loading: boolean;
  error: string;
  busySourceId: string | null;
  addSource: () => Promise<void>;
  scanSource: (source: LocalSource) => Promise<void>;
  toggleWatcher: (source: LocalSource) => Promise<void>;
};

function sourceName(directory: string): string {
  return directory.split(/[\\/]/).filter(Boolean).at(-1) ?? directory;
}

function sourceTone(source: LocalSource): Tone {
  if (source.status === "FAILED") return "danger";
  if (source.watcher_enabled) return "success";
  return "info";
}

export function useSourceManagement(projectId: string | null, onAction: (message: string) => void): SourceManagementModel {
  const [manifestPath, setManifestPath] = useState("");
  const [sources, setSources] = useState<LocalSource[]>([]);
  const [queuedCounts, setQueuedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySourceId, setBusySourceId] = useState<string | null>(null);

  const refreshSources = useCallback(async (path: string, activeProjectId: string) => {
    const nextSources = await listLocalSources(path, activeProjectId);
    setSources(nextSources);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setManifestPath("");
    setSources([]);
    setQueuedCounts({});
    setError("");
    if (!projectId) return () => undefined;
    if (!isDesktopRuntime()) {
      setError("Quản lý nguồn dữ liệu cần chạy trong desktop app Tauri.");
      return () => undefined;
    }

    setLoading(true);
    void getLocalManifestPath(projectId)
      .then(async (path) => {
        if (cancelled) return;
        setManifestPath(path);
        await refreshSources(path, projectId);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Không thể tải nguồn dữ liệu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshSources]);

  const ensureManifestPath = async (): Promise<string> => {
    if (manifestPath) return manifestPath;
    if (!projectId) throw new Error("Hãy chọn một project trước.");
    const path = await getLocalManifestPath(projectId);
    setManifestPath(path);
    return path;
  };

  const addSource = async () => {
    if (!projectId) {
      setError("Hãy chọn một project trước khi thêm nguồn dữ liệu.");
      return;
    }
    if (!isDesktopRuntime()) {
      setError("Folder picker chỉ khả dụng trong desktop app Tauri.");
      return;
    }
    setError("");
    try {
      const directory = await pickSourceDirectory();
      if (!directory) return;
      setBusySourceId("new");
      const path = await ensureManifestPath();
      const source = await registerLocalSource(path, projectId, directory);
      setSources((current) => [...current.filter((item) => item.source_id !== source.source_id), source]);
      await startSourceWatcher(path, source.source_id);
      setSources((current) => current.map((item) => item.source_id === source.source_id ? { ...item, watcher_enabled: true, updated_at: nowIso() } : item));
      onAction(`Đã đăng ký nguồn ${sourceName(source.directory)}`);
    } catch (sourceError) {
      setError(sourceError instanceof Error ? sourceError.message : "Không thể đăng ký nguồn dữ liệu.");
    } finally {
      setBusySourceId(null);
    }
  };

  const scanSource = async (source: LocalSource) => {
    setBusySourceId(source.source_id);
    setError("");
    try {
      const path = await ensureManifestPath();
      const queued = await scanSourceDirectory(path, source.source_id);
      setQueuedCounts((current) => ({ ...current, [source.source_id]: queued }));
      await refreshSources(path, source.project_id);
      onAction(`${sourceName(source.directory)}: đã đưa ${queued} file vào hàng đợi`);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Không thể quét nguồn dữ liệu.");
    } finally {
      setBusySourceId(null);
    }
  };

  const toggleWatcher = async (source: LocalSource) => {
    setBusySourceId(source.source_id);
    setError("");
    try {
      const path = await ensureManifestPath();
      if (source.watcher_enabled) {
        await stopSourceWatcher(path, source.source_id);
      } else {
        await startSourceWatcher(path, source.source_id);
      }
      setSources((current) => current.map((item) => item.source_id === source.source_id ? { ...item, watcher_enabled: !source.watcher_enabled, updated_at: nowIso() } : item));
    } catch (watcherError) {
      setError(watcherError instanceof Error ? watcherError.message : "Không thể cập nhật watcher.");
    } finally {
      setBusySourceId(null);
    }
  };

  return { sources, queuedCounts, loading, error, busySourceId, addSource, scanSource, toggleWatcher };
}

export function SourceManagementPanel({ model }: { model: SourceManagementModel }) {
  return (
    <Panel
      className="col-4"
      title="Nguồn dữ liệu"
      subtitle={`${model.sources.length} source đã đăng ký`}
      action={<Button primary onClick={() => void model.addSource()}><Icon name="plus" size={13} />Thêm nguồn</Button>}
    >
      <div className="panel-body source-management-panel">
        {model.error ? <div className="source-management-error" role="alert">{model.error}</div> : null}
        {model.loading ? <div className="source-management-empty" role="status">Đang tải nguồn dữ liệu…</div> : null}
        {!model.loading && model.sources.length === 0 ? <div className="source-management-empty">Chưa có source. Hãy chọn thư mục dữ liệu gốc.</div> : null}
        <div className="source-management-list" aria-label="Danh sách nguồn dữ liệu">
          {model.sources.map((source) => {
            const busy = model.busySourceId === source.source_id;
            const queued = model.queuedCounts[source.source_id];
            return (
              <div className="source-management-row" key={source.source_id}>
                <div className="file-icon"><Icon name="file" size={15} /></div>
                <div className="file-meta">
                  <div className="file-name" title={source.directory}>{sourceName(source.directory)}</div>
                  <div className="meta-line" title={source.directory}>{source.directory}</div>
                  <div className="source-management-meta">
                    <StatusBadge tone={sourceTone(source)}>{source.watcher_enabled ? "Watcher ON" : source.status}</StatusBadge>
                    {queued !== undefined ? <span className="meta-line">{queued} queued</span> : null}
                    {source.last_scan_at ? <span className="meta-line">Đã quét</span> : null}
                  </div>
                  {source.last_error ? <div className="source-management-error">{source.last_error}</div> : null}
                </div>
                <div className="source-management-actions">
                  <button className="btn source-action" type="button" onClick={() => void model.scanSource(source)} disabled={busy} aria-label={`Quét ${sourceName(source.directory)}`} title="Quét source"><Icon name="refresh" size={12} /></button>
                  <button className="btn source-action" type="button" onClick={() => void model.toggleWatcher(source)} disabled={busy} aria-label={`${source.watcher_enabled ? "Tắt" : "Bật"} watcher ${sourceName(source.directory)}`} title={source.watcher_enabled ? "Tắt watcher" : "Bật watcher"}>{source.watcher_enabled ? "Stop" : "Start"}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
