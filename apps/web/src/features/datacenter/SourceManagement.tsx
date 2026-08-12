import { useCallback, useEffect, useState } from "react";
import { Button, Icon, Panel, StatusBadge } from "../../shared/ui";
import type { Tone } from "../../shared/types";
import {
  confirmPreviewImport,
  approveFileChangeSet,
  editNormalizedChangeSet,
  loadLocalImports,
  cancelPendingJob,
  listPendingJobs,
  processPendingFileScans,
  rejectFileChangeSet,
  retryFileImport,
  type ImportProfile,
  type LocalImportView,
  type PendingJob,
  type PreviewValueType,
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
  archiveLocalSource,
} from "./sourceApi";

type SourceManagementModel = {
  sources: LocalSource[];
  imports: LocalImportView[];
  queuedCounts: Record<string, number>;
  pendingJobs: PendingJob[];
  loading: boolean;
  error: string;
  busySourceId: string | null;
  busyImportId: string | null;
  addSource: () => Promise<void>;
  scanSource: (source: LocalSource) => Promise<void>;
  toggleWatcher: (source: LocalSource) => Promise<void>;
  archiveSource: (source: LocalSource) => Promise<void>;
  confirmPreview: (sourceId: string, item: LocalImportView, profile: ImportProfile) => Promise<void>;
  editChangeSet: (item: LocalImportView, recordIdentity: string, field: string, value: unknown) => Promise<void>;
  approveChangeSet: (item: LocalImportView) => Promise<void>;
  rejectChangeSet: (item: LocalImportView) => Promise<void>;
  retryImport: (sourceId: string, item: LocalImportView) => Promise<void>;
  cancelFile: (item: LocalImportView) => Promise<void>;
  cancelJob: (job: PendingJob) => Promise<void>;
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
  const [pendingJobs, setPendingJobs] = useState<PendingJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [busyImportId, setBusyImportId] = useState<string | null>(null);

  const refreshSources = useCallback(async (path: string, activeProjectId: string) => {
    const nextSources = await listLocalSources(path, activeProjectId);
    setSources(nextSources);
  }, []);

  const refreshImports = useCallback(async (path: string, activeProjectId: string) => {
    const [nextImports, jobs] = await Promise.all([loadLocalImports(path, activeProjectId), listPendingJobs(path)]);
    setImports(nextImports);
    setPendingJobs(jobs);
    setQueuedCounts(jobs.reduce<Record<string, number>>((counts, job) => {
      if (job.source_id) counts[job.source_id] = (counts[job.source_id] ?? 0) + 1;
      return counts;
    }, {}));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setManifestPath("");
    setSources([]);
    setImports([]);
    setQueuedCounts({});
    setPendingJobs([]);
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

  const archiveSource = async (source: LocalSource) => {
    setBusySourceId(source.source_id);
    setError("");
    try {
      const path = await ensureManifestPath();
      const archived = await archiveLocalSource(path, source.source_id);
      if (!archived) throw new Error("Không tìm thấy source để archive.");
      setSources((current) => current.map((item) => item.source_id === source.source_id ? { ...item, status: "ARCHIVED", watcher_enabled: false, updated_at: nowIso() } : item));
      onAction(`Đã archive source ${sourceName(source.directory)}; lịch sử vẫn được giữ lại`);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Không thể archive source.");
    } finally {
      setBusySourceId(null);
    }
  };

  const confirmPreview = async (sourceId: string, item: LocalImportView, profile: ImportProfile) => {
    setBusyImportId(item.import_id);
    setError("");
    try {
      if (!manifestPath) throw new Error("Manifest local chưa sẵn sàng.");
      await confirmPreviewImport(manifestPath, item, sourceId, profile);
      await refreshImports(manifestPath, item.project_id);
      onAction(`Đã xác nhận mapping cho ${item.path.split(/[\\/]/).filter(Boolean).at(-1) ?? item.path}`);
    } catch (mappingError) {
      setError(mappingError instanceof Error ? mappingError.message : "Không thể xác nhận mapping.");
    } finally {
      setBusyImportId(null);
    }
  };

  const runChangeSetAction = async (item: LocalImportView, action: () => Promise<void>, success: string) => {
    setBusyImportId(item.import_id);
    setError("");
    try {
      if (!manifestPath) throw new Error("Manifest local chưa sẵn sàng.");
      await action();
      await refreshImports(manifestPath, item.project_id);
      onAction(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Không thể cập nhật ChangeSet.");
    } finally {
      setBusyImportId(null);
    }
  };

  const editChangeSet = (item: LocalImportView, recordIdentity: string, field: string, value: unknown) => runChangeSetAction(
    item,
    () => editNormalizedChangeSet(manifestPath, item, recordIdentity, field, value),
    `Đã cập nhật ${field} trong ChangeSet`,
  );

  const approveChangeSet = (item: LocalImportView) => runChangeSetAction(
    item,
    () => approveFileChangeSet(manifestPath, item),
    "Đã duyệt ChangeSet; dữ liệu canonical đã được áp dụng",
  );

  const rejectChangeSet = (item: LocalImportView) => runChangeSetAction(
    item,
    () => rejectFileChangeSet(manifestPath, item, "Rejected from desktop review"),
    "Đã từ chối ChangeSet; source vẫn nguyên trạng",
  );

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

  const cancelFile = async (item: LocalImportView) => {
    setBusyImportId(item.import_id);
    setError("");
    try {
      if (!manifestPath) throw new Error("Manifest local chưa sẵn sàng.");
      const job = pendingJobs.find((candidate) => candidate.file_id === item.file_id || candidate.payload.includes(item.file_id));
      if (!job) throw new Error("Không tìm thấy job đang chờ cho file này.");
      if (!await cancelPendingJob(manifestPath, job.job_id)) throw new Error("Job đã hoàn tất hoặc không thể hủy.");
      await refreshImports(manifestPath, item.project_id);
      onAction(`Đã hủy job của ${item.path.split(/[\\/]/).filter(Boolean).at(-1) ?? item.path}`);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Không thể hủy file job.");
    } finally {
      setBusyImportId(null);
    }
  };

  const cancelJob = async (job: PendingJob) => {
    setError("");
    try {
      if (!manifestPath) throw new Error("Manifest local chưa sẵn sàng.");
      if (!await cancelPendingJob(manifestPath, job.job_id)) throw new Error("Job đã hoàn tất hoặc không thể hủy.");
      if (projectId) await refreshImports(manifestPath, projectId);
      onAction(`Đã hủy job ${job.file_id ?? job.job_id}`);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Không thể hủy job.");
    }
  };

  return { sources, imports, queuedCounts, pendingJobs, loading, error, busySourceId, busyImportId, addSource, scanSource, toggleWatcher, archiveSource, confirmPreview, editChangeSet, approveChangeSet, rejectChangeSet, retryImport, cancelFile, cancelJob };
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
  onEdit,
  onApprove,
  onReject,
  onRetry,
  onCancel,
}: {
  item: LocalImportView;
  busy: boolean;
  onConfirm: (profile: ImportProfile) => Promise<void>;
  onEdit: (recordIdentity: string, field: string, value: unknown) => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRetry: () => Promise<void>;
  onCancel: () => Promise<void>;
}) {
  const regions = item.preview?.regions ?? [];
  const [regionIndex, setRegionIndex] = useState(0);
  const region = regions[regionIndex] ?? regions[0];
  const headers = Array.from(new Set((region?.headers ?? []).map((header) => String(header.value)).filter(Boolean)));
  const [codeColumn, setCodeColumn] = useState(headers[0] ?? "");
  const [nameColumn, setNameColumn] = useState(headers[1] ?? headers[0] ?? "");
  const [fieldTypes, setFieldTypes] = useState<Record<string, PreviewValueType>>({ ...(item.preview?.inferred_types ?? {}), ...(region?.inferred_types ?? {}) });
  const [skipRows, setSkipRows] = useState<number[]>(item.preview?.skipped_rows ?? []);
  const isPreview = item.status === "PREVIEW";
  const changesetStatus = item.changeset?.status;
  const isPendingApproval = changesetStatus === "PENDING_APPROVAL";
  const previewRows = item.preview?.rows ?? item.desktop_parse?.records.map((record) => record.raw) ?? [];
  const recordItems = item.changeset?.items ?? [];
  const confirm = async () => {
    if (!isPreview || !codeColumn) return;
    const headerRow = region?.header_candidates?.[0] ?? 1;
    await onConfirm({
      profile_id: `camera-${item.file_id}`,
      version: Math.max(1, (item.desktop_parse?.profile_version ?? 0) + 1),
      sheet: region?.sheet ?? "WORKBOOK",
      header_rows: [headerRow],
      data_start_row: Math.max(headerRow + 1, region?.start_row ?? headerRow + 1),
      table_start_row: region?.start_row ?? null,
      skip_row_patterns: [],
      skip_rows: skipRows,
      aliases: {
        code: [codeColumn],
        ...(nameColumn ? { name: [nameColumn] } : {}),
      },
      field_types: fieldTypes,
    });
  };
  const editValue = (value: string, type: PreviewValueType): unknown => {
    if (type === "number" && value.trim() !== "") return Number(value);
    if (type === "boolean") return value.trim().toLowerCase() === "true";
    return value;
  };

  return (
    <details className="source-file-import" open={isPreview || isPendingApproval}>
      <summary>
        <span className="file-name" title={item.path}>{item.path.split(/[\\/]/).filter(Boolean).at(-1) ?? item.path}</span>
        <StatusBadge tone={importTone(item.status)}>{changesetStatus ?? item.status}</StatusBadge>
      </summary>
      <div className="source-import-meta">
        <span className="meta-line" title={item.path}>Source: {item.path}</span>
        <span className="meta-line">Revision {item.file_revision} · {item.sha256.slice(0, 12)}</span>
      </div>
      {item.preview?.skipped_sheets?.length ? <div className="meta-line">Skipped sheets: {item.preview.skipped_sheets.join(", ")}</div> : null}
      {item.preview?.issues?.length ? (
        <div className="source-management-error" role="status">
          <strong>Issues ({item.preview.issues.length})</strong>
          {item.preview.issues.map((issue, index) => <div key={`${issue.code}-${index}`}>{issue.code}: {issue.message}{issue.row ? ` (row ${issue.row})` : ""}{issue.line ? ` (line ${issue.line})` : ""}{issue.column ? ` [${issue.column}]` : ""}{issue.action ? ` — ${issue.action}` : ""}</div>)}
        </div>
      ) : null}
      {item.error ? <div className="source-management-error">{item.error_code ? `${item.error_code}: ` : ""}{item.error}</div> : null}
      {regions.length > 1 ? (
        <label className="source-mapping-form">Region
          <select value={regionIndex} onChange={(event) => setRegionIndex(Number(event.target.value))}>
            {regions.map((candidate, index) => <option key={`${candidate.sheet}-${candidate.start_row}`} value={index}>{candidate.sheet} rows {candidate.start_row}-{candidate.end_row}</option>)}
          </select>
        </label>
      ) : null}
      {region ? <div className="source-preview-table">
        <div className="meta-line">Region {region.sheet}: rows {region.start_row}-{region.end_row}, header candidates {region.header_candidates.join(", ")}</div>
        <table className="data-table"><thead><tr>{headers.map((header) => <th key={header}>{header}<span className="meta-line">{fieldTypes[header] ?? "text"}</span></th>)}</tr></thead><tbody>
          {previewRows.slice(0, 5).map((row, index) => {
            const values = row && typeof row === "object" ? row as Record<string, unknown> : { value: row };
            const rowNumber = region.start_row + index + 1;
            return <tr key={`preview-${index}`} className={skipRows.includes(rowNumber) ? "source-row-skipped" : undefined}>{headers.map((header) => <td key={`${index}-${header}`}>{JSON.stringify(values[header] ?? "")}</td>)}</tr>;
          })}
        </tbody></table>
      </div> : null}
      {isPreview ? (
        <div className="source-mapping-form">
          <label>Header row
            <select defaultValue={region?.header_candidates?.[0] ?? 1}>
              {(region?.header_candidates ?? [1]).map((row) => <option key={row} value={row}>{row}</option>)}
            </select>
          </label>
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
          <div className="source-type-grid"><span className="meta-line">Field types</span>{headers.map((header) => <label key={`type-${header}`}>{header}
            <select value={fieldTypes[header] ?? "text"} onChange={(event) => setFieldTypes((current) => ({ ...current, [header]: event.target.value as PreviewValueType }))}>
              <option value="text">text</option><option value="number">number</option><option value="boolean">boolean</option><option value="date">date</option>
            </select>
          </label>)}</div>
          <div className="source-skip-rows"><span className="meta-line">Skip rows</span>{previewRows.slice(0, 10).map((_row, index) => { const rowNumber = (region?.start_row ?? 1) + index + 1; return <label key={rowNumber}><input type="checkbox" checked={skipRows.includes(rowNumber)} onChange={(event) => setSkipRows((current) => event.target.checked ? [...current, rowNumber] : current.filter((row) => row !== rowNumber))} />{rowNumber}</label>; })}</div>
          <button className="btn primary" type="button" onClick={() => void confirm()} disabled={busy || !codeColumn}>Xác nhận mapping & tạo ChangeSet</button>
        </div>
      ) : null}
      {isPendingApproval && item.changeset ? (
        <div className="source-review">
          <div className="source-review-heading"><strong>ChangeSet review</strong><span className="meta-line">Approval is required before canonical apply</span></div>
          {recordItems.length ? <div className="source-review-items">{recordItems.map((record, index) => {
            const identity = record.record_identity ?? record.entity_id ?? `item-${index}`;
            return <div className="source-review-item" key={identity}><span className="mono">{identity}</span>{Object.entries(record.patch ?? {}).map(([field, value]) => <label key={`${identity}-${field}`}>{field}<input defaultValue={typeof value === "string" ? value : JSON.stringify(value)} onBlur={(event) => void onEdit(identity, field, editValue(event.target.value, fieldTypes[field] ?? "text"))} /></label>)}</div>;
          })}</div> : null}
          {item.changeset.conflicts?.length ? <div className="source-management-error">Conflicts: {item.changeset.conflicts.map((conflict) => JSON.stringify(conflict)).join(" · ")}</div> : null}
          {item.changeset.document_assets?.length ? <div className="meta-line">Assets: {item.changeset.document_assets.map((asset) => asset.name ?? asset.id ?? "asset").join(", ")}</div> : null}
          <div className="source-review-actions"><button className="btn primary" type="button" onClick={() => void onApprove()} disabled={busy || item.changeset.origin === "DOCUMENT_IMPORT"}>Approve ChangeSet</button><button className="btn source-action" type="button" onClick={() => void onReject()} disabled={busy}>Reject</button></div>
        </div>
      ) : null}
      {item.revision_diff.length ? <div className="source-review-diff"><strong>Revision diff</strong>{item.revision_diff.map((diff) => <div key={diff.identity} className="meta-line">{diff.identity}: {diff.status}{diff.changed_fields.length ? ` (${diff.changed_fields.join(", ")})` : ""}</div>)}</div> : null}
      {item.desktop_parse?.records.length ? <div className="source-locators"><strong>Source locators</strong>{item.desktop_parse.records.slice(0, 5).map((record) => <div className="meta-line" key={record.identity}>{record.identity}: {JSON.stringify(record.source)} · Raw {JSON.stringify(record.raw)} · Unmapped {JSON.stringify(record.unmapped)}</div>)}</div> : null}
      {(item.status === "PARSING" || item.status === "UPLOADING") ? <button className="btn source-action" type="button" onClick={() => void onCancel()} disabled={busy}>Cancel</button> : null}
      {(item.status === "FAILED" || item.status === "CONFLICT_REVIEW") ? <button className="btn source-action" type="button" onClick={() => void onRetry()} disabled={busy}>Retry file</button> : null}
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
            const sourceJobs = model.pendingJobs.filter((job) => job.source_id === source.source_id);
            return (
              <div className="source-management-row" key={source.source_id}>
                <div className="file-icon"><Icon name="file" size={15} /></div>
                <div className="file-meta">
                  <div className="file-name" title={source.directory}>{sourceName(source.directory)}</div>
                  <div className="meta-line" title={source.directory}>{source.directory}</div>
                  <div className="source-management-meta">
                    <StatusBadge tone={sourceTone(source)}>{source.watcher_enabled ? "Watcher ON" : source.status}</StatusBadge>
                    {queued !== undefined ? <span className="meta-line">{queued} queued</span> : null}
                    {sourceJobs.length ? <div className="source-job-list">{sourceJobs.map((job) => <div className="source-job" key={job.job_id}><span className="meta-line" title={job.file_id ?? job.job_id}>{job.file_id ?? job.job_id}: {job.status} · {job.phase} {job.progress}%{job.last_error ? ` — ${job.last_error}` : ""}</span><button className="btn source-action" type="button" onClick={() => void model.cancelJob(job)} disabled={job.status === "CANCELLED" || job.status === "FAILED"}>Cancel</button></div>)}</div> : null}
                    {source.last_scan_at ? <span className="meta-line">Đã quét</span> : null}
                  </div>
                  {source.last_error ? <div className="source-management-error">{source.last_error}</div> : null}
                  {sourceImports.length ? (
                    <div className="source-file-imports">
                      {sourceImports.map((item) => (
                        <PreviewImportCard
                          key={item.import_id}
                          item={item}
                          busy={model.busyImportId === item.import_id}
                          onConfirm={(profile) => model.confirmPreview(source.source_id, item, profile)}
                          onEdit={(recordIdentity, field, value) => model.editChangeSet(item, recordIdentity, field, value)}
                          onApprove={() => model.approveChangeSet(item)}
                          onReject={() => model.rejectChangeSet(item)}
                          onRetry={() => model.retryImport(source.source_id, item)}
                          onCancel={() => model.cancelFile(item)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="source-management-actions">
                  <button className="btn source-action" type="button" onClick={() => void model.scanSource(source)} disabled={busy} aria-label={`Quét ${sourceName(source.directory)}`} title="Quét source"><Icon name="refresh" size={12} /></button>
                  <button className="btn source-action" type="button" onClick={() => void model.toggleWatcher(source)} disabled={busy} aria-label={`${source.watcher_enabled ? "Tắt" : "Bật"} watcher ${sourceName(source.directory)}`} title={source.watcher_enabled ? "Tắt watcher" : "Bật watcher"}>{source.watcher_enabled ? "Stop" : "Start"}</button>
                  <button className="btn source-action" type="button" onClick={() => void model.archiveSource(source)} disabled={busy || source.status === "ARCHIVED"} aria-label={`Archive ${sourceName(source.directory)}`} title="Archive source">Archive</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
