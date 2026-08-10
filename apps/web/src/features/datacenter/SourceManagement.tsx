import { useCallback, useEffect, useState } from "react";
import { Button, Icon, Panel, StatusBadge } from "../../shared/ui";
import type { Tone } from "../../shared/types";
import {
  confirmPreviewImport,
  loadLocalImports,
  processPendingFileScans,
  retryFileImport,
  type ImportProfile,
  type LocalImportView,
} from "./importWorker";
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
  imports: LocalImportView[];
  queuedCounts: Record<string, number>;
  loading: boolean;
  error: string;
  busySourceId: string | null;
  addSource: () => Promise<void>;
  scanSource: (source: LocalSource) => Promise<void>;
  toggleWatcher: (source: LocalSource) => Promise<void>;
  confirmPreview: (sourceId: string, item: LocalImportView, profile: ImportProfile) => Promise<void>;
  retryImport: (sourceId: string, item: LocalImportView) => Promise<void>;
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
  const [imports, setImports] = useState<LocalImportView[]>([]);
  const [queuedCounts, setQueuedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySourceId, setBusySourceId] = useState<string | null>(null);

  const refreshSources = useCallback(async (path: string, activeProjectId: string) => {
    const nextSources = await listLocalSources(path, activeProjectId);
    setSources(nextSources);
  }, []);

  const refreshImports = useCallback(async (path: string, activeProjectId: string) => {
    setImports(await loadLocalImports(path, activeProjectId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setManifestPath("");
    setSources([]);
    setImports([]);
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
        await Promise.all([refreshSources(path, projectId), refreshImports(path, projectId)]);
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
  }, [projectId, refreshImports, refreshSources]);

  useEffect(() => {
    if (!manifestPath || !projectId) return () => undefined;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        await processPendingFileScans(manifestPath);
        if (!cancelled) {
          await Promise.all([refreshSources(manifestPath, projectId), refreshImports(manifestPath, projectId)]);
        }
      } catch (workerError) {
        if (!cancelled) setError(workerError instanceof Error ? workerError.message : "Không thể xử lý hàng đợi import.");
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), 1000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [manifestPath, projectId, refreshImports, refreshSources]);

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

  const confirmPreview = async (sourceId: string, item: LocalImportView, profile: ImportProfile) => {
    setBusySourceId(sourceId);
    setError("");
    try {
      if (!manifestPath) throw new Error("Manifest local chưa sẵn sàng.");
      await confirmPreviewImport(manifestPath, item, sourceId, profile);
      await refreshImports(manifestPath, item.project_id);
      onAction(`Đã xác nhận mapping cho ${item.path.split(/[\\/]/).filter(Boolean).at(-1) ?? item.path}`);
    } catch (mappingError) {
      setError(mappingError instanceof Error ? mappingError.message : "Không thể xác nhận mapping.");
    } finally {
      setBusySourceId(null);
    }
  };

  const retryImport = async (sourceId: string, item: LocalImportView) => {
    setBusySourceId(sourceId);
    setError("");
    try {
      if (!manifestPath) throw new Error("Manifest local chưa sẵn sàng.");
      const queued = await retryFileImport(manifestPath, item);
      if (!queued) throw new Error("File đã có trong hàng đợi hoặc fingerprint không đổi.");
      await refreshImports(manifestPath, item.project_id);
      onAction(`Đã retry ${item.path.split(/[\\/]/).filter(Boolean).at(-1) ?? item.path}`);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Không thể retry file.");
    } finally {
      setBusySourceId(null);
    }
  };

  return { sources, imports, queuedCounts, loading, error, busySourceId, addSource, scanSource, toggleWatcher, confirmPreview, retryImport };
}

function importTone(status: string): Tone {
  if (status === "FAILED") return "danger";
  if (status === "PREVIEW" || status === "RAW_FALLBACK" || status === "CONFLICT_REVIEW") return "warning";
  if (["PARSING", "PARSED", "PARTIAL", "UPLOADING", "NORMALIZED_ACCEPTED", "SERVER_PARSED", "PENDING_APPROVAL", "IMPORTED"].includes(status)) return "success";
  return "info";
}

function PreviewImportCard({
  item,
  busy,
  onConfirm,
  onRetry,
}: {
  item: LocalImportView;
  busy: boolean;
  onConfirm: (profile: ImportProfile) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  const region = item.preview?.regions?.[0];
  const headers = Array.from(new Set((region?.headers ?? []).map((header) => String(header.value)).filter(Boolean)));
  const [codeColumn, setCodeColumn] = useState(headers[0] ?? "");
  const [nameColumn, setNameColumn] = useState(headers[1] ?? headers[0] ?? "");
  const isPreview = item.status === "PREVIEW";
  const confirm = async () => {
    if (!isPreview || !codeColumn) return;
    const headerRow = region?.header_candidates?.[0] ?? 1;
    await onConfirm({
      profile_id: `camera-${item.file_id}`,
      version: 1,
      sheet: region?.sheet ?? "CAMERA",
      header_rows: [headerRow],
      data_start_row: Math.max(headerRow + 1, region?.start_row ?? headerRow + 1),
      table_start_row: region?.start_row ?? null,
      skip_row_patterns: [],
      aliases: {
        code: [codeColumn],
        ...(nameColumn ? { name: [nameColumn] } : {}),
      },
    });
  };

  return (
    <details className="source-file-import" open={isPreview}>
      <summary>
        <span className="file-name" title={item.path}>{item.path.split(/[\\/]/).filter(Boolean).at(-1) ?? item.path}</span>
        <StatusBadge tone={importTone(item.status)}>{item.status}</StatusBadge>
      </summary>
      {item.preview?.issues?.length ? (
        <div className="source-management-error">
          {item.preview.issues.map((issue, index) => <div key={`${issue.code}-${index}`}>{issue.code}: {issue.message}{issue.row ? ` (row ${issue.row})` : ""}{issue.line ? ` (line ${issue.line})` : ""}{issue.action ? ` — ${issue.action}` : ""}</div>)}
        </div>
      ) : null}
      {item.error ? <div className="source-management-error">{item.error}</div> : null}
      {item.preview?.rows?.length ? (
        <div className="meta-line">Preview: {item.preview.rows.slice(0, 3).map((row) => JSON.stringify(row)).join(" · ")}</div>
      ) : null}
      {isPreview ? (
        <div className="source-mapping-form">
          <label>Camera code
            <select value={codeColumn} onChange={(event) => setCodeColumn(event.target.value)}>
              <option value="">Chọn cột</option>
              {headers.map((header) => <option key={`code-${header}`} value={header}>{header}</option>)}
            </select>
          </label>
          <label>Name
            <select value={nameColumn} onChange={(event) => setNameColumn(event.target.value)}>
              <option value="">Bỏ qua</option>
              {headers.map((header) => <option key={`name-${header}`} value={header}>{header}</option>)}
            </select>
          </label>
          <button className="btn primary" type="button" onClick={() => void confirm()} disabled={busy || !codeColumn}>Xác nhận mapping</button>
        </div>
      ) : null}
      {(item.status === "FAILED" || item.status === "CONFLICT_REVIEW") ? (
        <button className="btn source-action" type="button" onClick={() => void onRetry()} disabled={busy}>Retry file</button>
      ) : null}
    </details>
  );
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
            const sourceImports = model.imports.filter((item) => item.source_id === source.source_id);
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
                  {sourceImports.length ? (
                    <div className="source-file-imports">
                      {sourceImports.map((item) => (
                        <PreviewImportCard
                          key={item.import_id}
                          item={item}
                          busy={busy}
                          onConfirm={(profile) => model.confirmPreview(source.source_id, item, profile)}
                          onRetry={() => model.retryImport(source.source_id, item)}
                        />
                      ))}
                    </div>
                  ) : null}
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
