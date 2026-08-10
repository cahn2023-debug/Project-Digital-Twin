import { invoke } from "@tauri-apps/api/core";
import { requestJson } from "../../shared/api";

export type PendingJob = {
  job_id: string;
  job_type: string;
  payload: string;
  status: string;
  idempotency_key: string | null;
  attempts: number;
  next_retry_at: number;
  last_error: string | null;
  progress: number;
  phase: string;
  cancel_requested: boolean;
  source_id: string | null;
  file_id: string | null;
};

type FileScanPayload = {
  project_id: string;
  source_id: string;
  file_id: string;
  path: string;
  sha256: string;
  size: number;
  modified_at: string | null;
};

export type FileScanContext = {
  file_id: string;
  file_version_id: string;
  file_revision: number;
  path: string;
  sha256: string;
  size: number;
  modified_at: string | null;
};

type LocalRawRecord = {
  raw_id: string;
  file_version_id: string;
  row_key: string;
  payload: string;
  source_locator: string;
};

export type ImportResponse = {
  status?: string;
  changeset?: {
    id?: string;
    status?: string;
    origin?: string;
    file_id?: string;
    file_revision?: number;
    file_hash?: string;
    items?: ChangeSetItem[];
    patch?: Record<string, unknown>;
    raw_rows?: unknown[];
    conflicts?: Array<Record<string, unknown>>;
    document_assets?: SourceAsset[];
    relationship_proposals?: Array<Record<string, unknown>>;
    document_tables?: Array<Record<string, unknown>>;
    document_mapped_tables?: Array<Record<string, unknown>>;
  } | null;
  preview?: PreviewInfo | null;
  suppressed?: boolean;
  retry_history?: Array<Record<string, unknown>>;
};

export type PreviewValueType = "text" | "number" | "boolean" | "date";

export type ChangeSetItem = {
  entity_id?: string;
  record_identity?: string;
  base_revision?: number;
  base_payload?: Record<string, unknown>;
  patch?: Record<string, unknown>;
};

export type SourceAsset = {
  id?: string;
  name?: string;
  source_path?: string;
  mime_type?: string;
  size?: number;
  locator?: Record<string, unknown>;
};

export type PreviewRegion = {
  sheet: string;
  start_row: number;
  end_row: number;
  min_column: number;
  max_column: number;
  header_candidates: number[];
  headers: Array<{ row: number; column: string; value: unknown }>;
  inferred_types?: Record<string, PreviewValueType>;
};

export type PreviewIssue = {
  code: string;
  message: string;
  row?: number | null;
  line?: number | null;
  column?: string | null;
  action?: string | null;
  severity?: "WARNING" | "ERROR" | string;
};

export type PreviewInfo = {
  file_id?: string;
  file_revision?: number;
  regions?: PreviewRegion[];
  skipped_sheets?: string[];
  rows?: unknown[];
  skipped_rows?: number[];
  inferred_types?: Record<string, PreviewValueType>;
  issues?: PreviewIssue[];
};

export type LocalImportRecord = {
  import_id: string;
  project_id: string;
  file_version_id: string;
  status: string;
  payload: string;
  created_at: string;
};

export type LocalImportView = LocalImportRecord & {
  source_id: string | null;
  path: string;
  file_id: string;
  file_revision: number;
  sha256: string;
  size: number;
  modified_at: string | null;
  preview: PreviewInfo | null;
  changeset: ImportResponse["changeset"];
  revision_diff: RevisionDiff[];
  desktop_parse: DesktopParseResult | null;
  error_code: string | null;
  error: string | null;
};

type DesktopParseRecord = {
  identity: string;
  fields: Record<string, unknown>;
  unmapped: Record<string, unknown>;
  raw: Record<string, unknown>;
  source: Record<string, unknown>;
};

type DesktopParseResult = {
  file_id: string;
  file_revision: number;
  path: string;
  sha256: string;
  parsed_at: number;
  format: "XLSX" | "XLS" | "CSV" | "TXT" | "MARKDOWN" | "WORD" | "UNSUPPORTED";
  status: "PARSED" | "PARTIAL" | "RAW_FALLBACK";
  profile_id: string | null;
  profile_version: number | null;
  parser_version: string;
  records: DesktopParseRecord[];
  report: {
    valid_records?: number;
    invalid_records?: number;
    warning_count?: number;
    issues?: PreviewIssue[];
  };
  fallback_reason: string | null;
};

type AssetSyncJobPayload = {
  project_id: string;
  source_id?: string | null;
  file_id?: string | null;
  file_version_id?: string;
  source_hash?: string | null;
  asset_id: string;
  asset_version: number;
  source_path?: string | null;
  source_locator?: string | Record<string, unknown> | null;
  payload?: string | unknown;
};

class JobCancelledError extends Error {
  constructor() {
    super("[CANCELLED] File job was cancelled before upload");
  }
}

async function jobCheckpoint(manifestPath: string, job: PendingJob, progress: number, phase: string): Promise<void> {
  await invoke("update_pending_job_progress", { manifestPath, jobId: job.job_id, progress, phase });
  if (await invoke<boolean>("is_pending_job_cancelled", { manifestPath, jobId: job.job_id })) throw new JobCancelledError();
}

function classifyFileError(message: string): string {
  const normalized = message.toLowerCase();
  if (["permission", "access is denied", "os error 5", "unauthorized"].some((term) => normalized.includes(term))) return "FILE_PERMISSION_DENIED";
  if (["locked", "being used", "sharing violation", "os error 32", "resource busy"].some((term) => normalized.includes(term))) return "FILE_LOCKED";
  return "IMPORT_TRANSIENT_ERROR";
}

type RevisionDiff = {
  identity: string;
  status: "ADDED" | "CHANGED" | "REMOVED" | "UNCHANGED";
  changed_fields: string[];
};

type LocalProfileRecord = {
  profile_id: string;
  version: number;
  payload: string;
};

export type ImportProfile = {
  profile_id: string;
  version: number;
  sheet: string;
  header_rows: number[];
  data_start_row: number;
  table_start_row: number | null;
  skip_row_patterns: string[];
  skip_rows: number[];
  aliases: Record<string, string[]>;
  field_types: Record<string, PreviewValueType>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readIssues(value: unknown): PreviewIssue[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.code !== "string" || typeof item.message !== "string") return [];
    return [{
      code: item.code,
      message: item.message,
      row: typeof item.row === "number" ? item.row : null,
      line: typeof item.line === "number" ? item.line : null,
      column: typeof item.column === "string" ? item.column : null,
      action: typeof item.action === "string" ? item.action : null,
      severity: typeof item.severity === "string" ? item.severity : undefined,
    }];
  });
}

function parserFormat(path: string): DesktopParseResult["format"] {
  const extension = path.split(/[.]/).at(-1)?.toLowerCase();
  if (extension === "xlsx" || extension === "xlsm") return "XLSX";
  if (extension === "xls") return "XLS";
  if (extension === "csv") return "CSV";
  if (extension === "txt") return "TXT";
  if (extension === "md" || extension === "markdown") return "MARKDOWN";
  if (extension === "doc" || extension === "docx") return "WORD";
  return "UNSUPPORTED";
}

async function loadParserProfiles(manifestPath: string, projectId: string, format: DesktopParseResult["format"]): Promise<Record<string, unknown>[]> {
  const profiles = await invoke<LocalProfileRecord[]>("list_local_profiles", { manifestPath, projectId });
  return profiles.flatMap((record) => {
    try {
      const value: unknown = JSON.parse(record.payload);
      if (!isRecord(value)) return [];
      return [{
        profile_id: record.profile_id,
        version: record.version,
        format,
        sheet: typeof value.sheet === "string" ? value.sheet : "CAMERA",
        header_row: Array.isArray(value.header_rows) && typeof value.header_rows[0] === "number" ? value.header_rows[0] : 1,
        data_start_row: typeof value.data_start_row === "number" ? value.data_start_row : 2,
        skip_rows: Array.isArray(value.skip_rows) ? value.skip_rows.filter((row): row is number => typeof row === "number") : [],
        required_fields: ["code"],
        aliases: isRecord(value.aliases) ? value.aliases : {},
        field_types: isRecord(value.field_types) ? value.field_types : {},
      }];
    } catch {
      return [];
    }
  });
}

function parserProfileFromImportProfile(profile: ImportProfile, format: DesktopParseResult["format"]): Record<string, unknown> {
  return {
    profile_id: profile.profile_id,
    version: profile.version,
    format,
    sheet: profile.sheet,
    header_row: profile.header_rows[0] ?? 1,
    data_start_row: profile.data_start_row,
    skip_rows: profile.skip_rows,
    required_fields: Object.keys(profile.aliases).filter((field) => field === "code"),
    aliases: profile.aliases,
    field_types: profile.field_types,
  };
}

function inferPreviewType(values: unknown[]): PreviewValueType {
  const present = values.filter((value) => value !== null && value !== undefined && value !== "");
  if (present.length && present.every((value) => typeof value === "boolean" || ["true", "false", "yes", "no", "y", "n"].includes(String(value).trim().toLowerCase()))) return "boolean";
  if (present.length && present.every((value) => typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))))) return "number";
  if (present.length && present.every((value) => typeof value === "string" && !Number.isNaN(Date.parse(value)) && /[-/]/.test(value))) return "date";
  return "text";
}

function previewFromDesktopParse(result: DesktopParseResult): PreviewInfo {
  const rows = result.records.map((record) => record.raw);
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const inferred_types = Object.fromEntries(headers.map((header) => [header, inferPreviewType(rows.map((row) => row[header]))])) as Record<string, PreviewValueType>;
  const firstSource = result.records[0]?.source ?? {};
  const sheet = typeof firstSource.sheet === "string" ? firstSource.sheet : "CAMERA";
  const firstRow = typeof firstSource.row === "number" ? firstSource.row : 1;
  return {
    file_id: result.file_id,
    file_revision: result.file_revision,
    regions: [{
      sheet,
      start_row: firstRow,
      end_row: firstRow + rows.length,
      min_column: 1,
      max_column: headers.length,
      header_candidates: [Math.max(1, firstRow - 1)],
      headers: headers.map((value, index) => ({ row: Math.max(1, firstRow - 1), column: String.fromCharCode(65 + index), value })),
      inferred_types,
    }],
    rows,
    inferred_types,
    issues: result.report.issues ?? [],
  };
}

async function parseLocalFile(
  manifestPath: string,
  payload: FileScanPayload,
  context: FileScanContext,
): Promise<DesktopParseResult> {
  const format = parserFormat(payload.path);
  const profiles = format === "XLSX" || format === "XLS" || format === "CSV"
    ? await loadParserProfiles(manifestPath, payload.project_id, format)
    : [];
  return invoke<DesktopParseResult>("parse_file", {
    path: payload.path,
    file_id: context.file_id,
    file_revision: context.file_revision,
    profiles,
    project_id: payload.project_id,
    source_id: payload.source_id,
    source_hash: context.sha256,
  });
}

function rawRecordsFromParse(
  result: DesktopParseResult,
  context: FileScanContext,
  sourceId: string,
  path: string,
): LocalRawRecord[] {
  return result.records.flatMap((record) => {
    if (!Object.keys(record.unmapped).length) return [];
    return [{
      raw_id: `${context.file_version_id}:${record.identity}`,
      file_version_id: context.file_version_id,
      row_key: `${record.identity}:unmapped`,
      payload: JSON.stringify(record.unmapped),
      source_locator: JSON.stringify({ ...record.source, path, source_id: sourceId }),
    }];
  });
}

function parseRevisionDiff(previous: DesktopParseResult | null, current: DesktopParseResult): RevisionDiff[] {
  if (!previous) return current.records.map((record) => ({
    identity: record.identity,
    status: "ADDED",
    changed_fields: Object.keys(record.fields),
  }));
  const before = new Map(previous.records.map((record) => [record.identity, record]));
  const after = new Map(current.records.map((record) => [record.identity, record]));
  const identities = new Set([...before.keys(), ...after.keys()]);
  return [...identities].sort().map((identity) => {
    const oldRecord = before.get(identity);
    const newRecord = after.get(identity);
    if (!oldRecord && newRecord) return { identity, status: "ADDED", changed_fields: Object.keys(newRecord.fields) };
    if (oldRecord && !newRecord) return { identity, status: "REMOVED", changed_fields: Object.keys(oldRecord.fields) };
    const changedFields = [...new Set([
      ...Object.keys(oldRecord?.fields ?? {}),
      ...Object.keys(newRecord?.fields ?? {}),
      ...Object.keys(oldRecord?.unmapped ?? {}),
      ...Object.keys(newRecord?.unmapped ?? {}),
    ])].filter((field) => JSON.stringify(oldRecord?.fields[field] ?? oldRecord?.unmapped[field]) !== JSON.stringify(newRecord?.fields[field] ?? newRecord?.unmapped[field]));
    return { identity, status: changedFields.length ? "CHANGED" : "UNCHANGED", changed_fields: changedFields };
  });
}

function previousDesktopParse(
  imports: LocalImportRecord[],
  fileId: string,
  revision: number,
): DesktopParseResult | null {
  return imports
    .map((record) => {
      try {
        const payload: unknown = JSON.parse(record.payload);
        if (!isRecord(payload) || payload.file_id !== fileId || !isRecord(payload.desktop_parse)) return null;
        const previousRevision = typeof payload.file_revision === "number" ? payload.file_revision : 0;
        return previousRevision < revision ? { revision: previousRevision, parse: payload.desktop_parse as unknown as DesktopParseResult } : null;
      } catch {
        return null;
      }
    })
    .filter((item): item is { revision: number; parse: DesktopParseResult } => Boolean(item))
    .sort((left, right) => right.revision - left.revision)[0]?.parse ?? null;
}

function parseScanPayload(payload: string): FileScanPayload {
  const value: unknown = JSON.parse(payload);
  if (!isRecord(value)) throw new Error("FILE_SCAN payload is invalid");
  const projectId = value.project_id;
  const sourceId = value.source_id;
  const fileId = value.file_id;
  const path = value.path;
  const sha256 = value.sha256;
  const size = value.size;
  if (
    typeof projectId !== "string" ||
    typeof sourceId !== "string" ||
    typeof fileId !== "string" ||
    typeof path !== "string" ||
    typeof sha256 !== "string" ||
    typeof size !== "number"
  ) {
    throw new Error("FILE_SCAN payload is missing file metadata");
  }
  return {
    project_id: projectId,
    source_id: sourceId,
    file_id: fileId,
    path,
    sha256,
    size,
    modified_at: typeof value.modified_at === "string" ? value.modified_at : null,
  };
}

function rawRecordsFromResponse(
  response: ImportResponse,
  context: FileScanContext,
  sourceId: string,
  isDocument: boolean,
  path: string,
): LocalRawRecord[] {
  const rows = response.changeset?.raw_rows ?? response.preview?.rows ?? [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row, index) => {
    const record = isRecord(row) ? row : { value: row };
    const locator = record.locator ?? {
      path,
      source_id: sourceId,
      file_id: context.file_id,
      file_revision: context.file_revision,
      sheet: isDocument ? "DOCUMENT" : "CAMERA",
      row: index + (isDocument ? 1 : 2),
      column: "",
    };
    const sourceLocator = isRecord(locator)
      ? { ...locator, path: typeof locator.path === "string" ? locator.path : path, source_id: sourceId }
      : { path, source_id: sourceId, value: locator };
    const identity = typeof record.identity === "string" && record.identity
      ? record.identity
      : typeof record.__record_identity === "string" && record.__record_identity
        ? record.__record_identity
        : `row-${index + 1}`;
    return {
      raw_id: `${context.file_version_id}:${identity}`,
      file_version_id: context.file_version_id,
      row_key: identity,
      payload: JSON.stringify(row),
      source_locator: JSON.stringify(sourceLocator),
    };
  });
}

function assetsFromResponse(
  response: ImportResponse,
  payload: FileScanPayload,
  context: FileScanContext,
): Record<string, unknown>[] {
  return (response.changeset?.document_assets ?? []).flatMap((asset, index) => {
    if (!asset.id && !asset.name) return [];
    return [{
      asset_id: asset.id ?? `${context.file_version_id}:asset-${index + 1}`,
      project_id: payload.project_id,
      file_version_id: context.file_version_id,
      source_id: payload.source_id,
      file_id: context.file_id,
      source_hash: payload.sha256,
      source_path: asset.source_path ?? payload.path,
      source_locator: JSON.stringify(asset.locator ?? { path: payload.path, source_id: payload.source_id }),
      asset_version: 1,
      payload: JSON.stringify(asset),
      status: "PENDING_SYNC",
      created_at: new Date().toISOString(),
    }];
  });
}

async function storeLocalImport(
  manifestPath: string,
  importId: string,
  payload: FileScanPayload,
  context: FileScanContext,
  status: string,
  localPayload: Record<string, unknown>,
  rawRecords: LocalRawRecord[],
  attempt: number,
  response?: ImportResponse,
): Promise<void> {
  const occurredAt = new Date().toISOString();
  await invoke("store_local_import_result", {
    manifestPath,
    importId,
    projectId: payload.project_id,
    fileVersionId: context.file_version_id,
    status,
    payload: JSON.stringify(localPayload),
    createdAt: new Date().toISOString(),
    attempt,
    rawRecords,
    assets: response ? assetsFromResponse(response, payload, context) : [],
    auditEvents: [{
      audit_id: `${importId}:${attempt}:${status}:${Date.now()}`,
      project_id: payload.project_id,
      source_id: payload.source_id,
      file_id: context.file_id,
      file_version_id: context.file_version_id,
      source_hash: payload.sha256,
      actor: "desktop-import",
      occurred_at: occurredAt,
      operation: "desktop-import",
      outcome: status,
      correlation_id: importId,
      payload: JSON.stringify({ path: payload.path, status, response_status: response?.status ?? null }),
    }],
  });
}

function localImportPayload(payload: FileScanPayload, context: FileScanContext): Record<string, unknown> {
  return {
    source_id: payload.source_id,
    path: payload.path,
    file_id: context.file_id,
    file_version_id: context.file_version_id,
    file_revision: context.file_revision,
    sha256: payload.sha256,
    size: payload.size,
    modified_at: payload.modified_at,
  };
}

async function processFileScan(manifestPath: string, job: PendingJob): Promise<void> {
  const payload = parseScanPayload(job.payload);
  await jobCheckpoint(manifestPath, job, 5, "PREPARING");
  const context = await invoke<FileScanContext>("prepare_file_scan", {
    manifestPath,
    path: payload.path,
    sha256: payload.sha256,
    size: payload.size,
    modifiedAt: payload.modified_at,
    createdAt: new Date().toISOString(),
  });
  const idempotencyKey = job.idempotency_key ?? `FILE_SCAN:${payload.file_id}:${payload.sha256}`;
  const importId = `${context.file_version_id}:${payload.sha256}`;
  let desktopParse: DesktopParseResult | null = null;
  let localPayload = localImportPayload(payload, context);
  try {
    await jobCheckpoint(manifestPath, job, 10, "QUEUED");
    const existing = await invoke<LocalImportRecord[]>("list_local_imports", {
      manifestPath,
      projectId: payload.project_id,
    });
    const cached = existing.find((record) => record.import_id === importId);
    if (cached) {
      try {
        const cachedPayload: unknown = JSON.parse(cached.payload);
        if (isRecord(cachedPayload) && isRecord(cachedPayload.desktop_parse)) {
          desktopParse = cachedPayload.desktop_parse as unknown as DesktopParseResult;
          localPayload = cachedPayload;
        }
      } catch {
        // Reparse when the cached payload is not a complete local parse result.
      }
    }

    if (!desktopParse) {
      await jobCheckpoint(manifestPath, job, 20, "PARSING");
      await storeLocalImport(manifestPath, importId, payload, context, "PARSING", localPayload, [], job.attempts + 1);
      desktopParse = await parseLocalFile(manifestPath, payload, context);
      await jobCheckpoint(manifestPath, job, 55, "PARSED");
      const revisionDiff = parseRevisionDiff(previousDesktopParse(existing, context.file_id, context.file_revision), desktopParse);
      localPayload = {
        ...localPayload,
        desktop_parse: desktopParse,
        revision_diff: revisionDiff,
      };
      if (desktopParse.status === "PARTIAL") {
        localPayload.preview = previewFromDesktopParse(desktopParse);
        await storeLocalImport(
          manifestPath,
          importId,
          payload,
          context,
          "PREVIEW",
          localPayload,
          rawRecordsFromParse(desktopParse, context, payload.source_id, payload.path),
          job.attempts + 1,
        );
        return;
      }
      await storeLocalImport(
        manifestPath,
        importId,
        payload,
        context,
        desktopParse.status,
        localPayload,
        rawRecordsFromParse(desktopParse, context, payload.source_id, payload.path),
        job.attempts + 1,
      );
    }

    await jobCheckpoint(manifestPath, job, 70, "UPLOADING");
    await storeLocalImport(manifestPath, importId, payload, context, "UPLOADING", localPayload, [], job.attempts + 1);
    const revisionDiff = Array.isArray(localPayload.revision_diff) ? localPayload.revision_diff : undefined;
    const parseReport = revisionDiff ? { ...desktopParse.report, revision_diff: revisionDiff } : desktopParse.report;
    const response = desktopParse.status === "RAW_FALLBACK"
      ? await requestJson<ImportResponse>("/api/v1/projects/{project_id}/desktop-imports/raw-fallback".replace("{project_id}", payload.project_id), {
          method: "POST",
          body: JSON.stringify({
            file_id: context.file_id,
            file_revision: context.file_revision,
            idempotency_key: idempotencyKey,
            format: desktopParse.format,
            filename: payload.path.split(/[\\/]/).at(-1) ?? payload.path,
            source_hash: desktopParse.sha256,
            content_base64: await invoke<string>("read_file_base64", { path: payload.path }),
            fallback_reason: desktopParse.fallback_reason ?? "Desktop parser fallback",
            expected_profile_id: desktopParse.profile_id,
            parse_report: parseReport,
            retry_attempt: job.attempts,
            created_by: "desktop-import-fallback",
          }),
        })
      : await requestJson<ImportResponse>("/api/v1/projects/{project_id}/desktop-imports/normalized".replace("{project_id}", payload.project_id), {
          method: "POST",
          body: JSON.stringify({
            file_id: context.file_id,
            file_revision: context.file_revision,
            idempotency_key: idempotencyKey,
            format: desktopParse.format,
            source_hash: desktopParse.sha256,
            parser_version: desktopParse.parser_version,
            profile_id: desktopParse.profile_id,
            profile_version: desktopParse.profile_version,
            parsed_at: desktopParse.parsed_at,
            records: desktopParse.records,
            parse_report: parseReport,
            retry_attempt: job.attempts,
            created_by: "desktop-import",
          }),
        });
    await jobCheckpoint(manifestPath, job, 95, "SERVER_REVIEW");
    const status = response.status
      ?? (response.suppressed ? "SUPPRESSED" : response.preview ? "PREVIEW" : response.changeset?.status ?? "IMPORTED");
    localPayload = { ...localPayload, ...response, desktop_parse: desktopParse };
    await storeLocalImport(
      manifestPath,
      importId,
      payload,
      context,
      status,
      localPayload,
        rawRecordsFromResponse(response, context, payload.source_id, desktopParse.format === "WORD", payload.path),
        job.attempts + 1,
        response,
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : "File import failed";
    const cancelled = error instanceof JobCancelledError;
    const errorCode = classifyFileError(message);
    try {
      await storeLocalImport(
        manifestPath,
        importId,
        payload,
        context,
        cancelled ? "CANCELLED" : "FAILED",
        { ...localPayload, desktop_parse: desktopParse, error: message, error_code: cancelled ? "CANCELLED" : errorCode },
        [],
        job.attempts + 1,
      );
    } catch {
      // Preserve the original parser/network error so the queue retry remains authoritative.
    }
    throw error;
  }
}

export async function loadLocalImports(manifestPath: string, projectId: string): Promise<LocalImportView[]> {
  const records = await invoke<LocalImportRecord[]>("list_local_imports", { manifestPath, projectId });
  return records.flatMap((record) => {
    try {
      const value: unknown = JSON.parse(record.payload);
      if (!isRecord(value)) return [];
      const sourceId = typeof value.source_id === "string" ? value.source_id : null;
      const path = typeof value.path === "string" ? value.path : "";
      const fileId = typeof value.file_id === "string" ? value.file_id : "";
      const fileRevision = typeof value.file_revision === "number" ? value.file_revision : 1;
      const sha256 = typeof value.sha256 === "string" ? value.sha256 : "";
      const size = typeof value.size === "number" ? value.size : 0;
      const modifiedAt = typeof value.modified_at === "string" ? value.modified_at : null;
      const responsePreview = isRecord(value.preview) ? (value.preview as unknown as PreviewInfo) : null;
      const result = isRecord(value.result) ? value.result : null;
      const desktopParse = isRecord(value.desktop_parse) ? value.desktop_parse : null;
      const parseReport = desktopParse && isRecord(desktopParse.report) ? desktopParse.report : null;
      const resultIssues = result ? [...readIssues(result.invalid), ...readIssues(result.unmapped)] : [];
      const parseIssues = parseReport ? readIssues(parseReport.issues) : [];
      const changeset = isRecord(value.changeset) ? value.changeset : null;
      const desktopParseValue = desktopParse as unknown as DesktopParseResult | null;
      const revisionDiff = Array.isArray(value.revision_diff) ? value.revision_diff as RevisionDiff[] : [];
      const preview = responsePreview ?? (resultIssues.length || parseIssues.length ? {
        rows: Array.isArray(changeset?.raw_rows) ? changeset.raw_rows : [],
        issues: [...parseIssues, ...resultIssues],
      } : desktopParseValue && desktopParseValue.status === "PARTIAL" ? previewFromDesktopParse(desktopParseValue) : null);
      const error = typeof value.error === "string"
        ? value.error
        : typeof value.server_error === "string"
          ? value.server_error
          : null;
      const errorCode = typeof value.error_code === "string" ? value.error_code : null;
      return [{ ...record, source_id: sourceId, path, file_id: fileId, file_revision: fileRevision, sha256, size, modified_at: modifiedAt, preview, changeset: changeset as ImportResponse["changeset"], revision_diff: revisionDiff, desktop_parse: desktopParseValue, error_code: errorCode, error }];
    } catch {
      return [];
    }
  });
}

export async function retryFileImport(manifestPath: string, item: LocalImportView): Promise<boolean> {
  if (!item.source_id) throw new Error("Không xác định được source của file.");
  return invoke<boolean>("retry_file_scan", {
    manifestPath,
    sourceId: item.source_id,
    path: item.path,
    sha256: item.sha256,
    size: item.size,
    modifiedAt: item.modified_at,
    createdAt: new Date().toISOString(),
  });
}

export async function confirmPreviewImport(
  manifestPath: string,
  importView: LocalImportView,
  sourceId: string,
  profile: ImportProfile,
): Promise<void> {
  await invoke<boolean>("save_local_profile", {
    manifestPath,
    profileId: profile.profile_id,
    projectId: importView.project_id,
    version: profile.version,
    payload: JSON.stringify(profile),
    createdAt: new Date().toISOString(),
  });
  const context: FileScanContext = {
    file_id: importView.file_id,
    file_version_id: importView.file_version_id,
    file_revision: importView.file_revision,
    path: importView.path,
    sha256: importView.sha256,
    size: importView.size,
    modified_at: importView.modified_at,
  };
  const format = parserFormat(importView.path);
  const desktopParse = await invoke<DesktopParseResult>("parse_file", {
    path: importView.path,
    file_id: importView.file_id,
    file_revision: importView.file_revision,
    profiles: [parserProfileFromImportProfile(profile, format)],
    project_id: importView.project_id,
    source_id: sourceId,
    source_hash: importView.sha256,
  });
  const idempotencyKey = `FILE_IMPORT_PROFILE:${importView.file_id}:${importView.file_revision}:${profile.profile_id}:v${profile.version}`;
  const response = desktopParse.status === "RAW_FALLBACK"
    ? await requestJson<ImportResponse>(`/api/v1/projects/${importView.project_id}/desktop-imports/raw-fallback`, {
        method: "POST",
        body: JSON.stringify({
          file_id: importView.file_id,
          file_revision: importView.file_revision,
          idempotency_key: idempotencyKey,
          format: desktopParse.format,
          filename: importView.path.split(/[\\/]/).at(-1) ?? importView.path,
          source_hash: desktopParse.sha256,
          content_base64: await invoke<string>("read_file_base64", { path: importView.path }),
          fallback_reason: desktopParse.fallback_reason ?? "Desktop parser fallback after mapping",
          expected_profile_id: profile.profile_id,
          parse_report: desktopParse.report,
          created_by: "desktop-import-mapping-fallback",
        }),
      })
    : await requestJson<ImportResponse>(`/api/v1/projects/${importView.project_id}/desktop-imports/normalized`, {
        method: "POST",
        body: JSON.stringify({
          file_id: importView.file_id,
          file_revision: importView.file_revision,
          idempotency_key: idempotencyKey,
          format: desktopParse.format,
          source_hash: desktopParse.sha256,
          parser_version: desktopParse.parser_version,
          profile_id: desktopParse.profile_id,
          profile_version: desktopParse.profile_version,
          parsed_at: desktopParse.parsed_at,
          records: desktopParse.records,
          parse_report: desktopParse.report,
          created_by: "desktop-import-mapping",
        }),
      });
  const status = response.status ?? response.changeset?.status ?? "IMPORTED";
  const localPayload = { ...response, desktop_parse: desktopParse, source_id: sourceId, path: importView.path, file_id: importView.file_id, file_version_id: importView.file_version_id, file_revision: importView.file_revision, sha256: importView.sha256, profile, size: importView.size, modified_at: importView.modified_at };
  const occurredAt = new Date().toISOString();
  await invoke("store_local_import_result", {
    manifestPath,
    importId: importView.import_id,
    projectId: importView.project_id,
    fileVersionId: importView.file_version_id,
    status,
    payload: JSON.stringify(localPayload),
    createdAt: new Date().toISOString(),
    attempt: 0,
    rawRecords: [
      ...rawRecordsFromParse(desktopParse, context, sourceId, importView.path),
      ...rawRecordsFromResponse(response, context, sourceId, desktopParse.format === "WORD", importView.path),
    ],
    assets: assetsFromResponse(response, { project_id: importView.project_id, source_id: sourceId, file_id: importView.file_id, path: importView.path, sha256: importView.sha256, size: importView.size, modified_at: importView.modified_at }, context),
    auditEvents: [{
      audit_id: `${importView.import_id}:mapping:${Date.now()}`,
      project_id: importView.project_id,
      source_id: sourceId,
      file_id: importView.file_id,
      file_version_id: importView.file_version_id,
      source_hash: importView.sha256,
      actor: "desktop-import-mapping",
      occurred_at: occurredAt,
      operation: "mapping-confirmed",
      outcome: status,
      correlation_id: importView.import_id,
      payload: JSON.stringify({ path: importView.path, profile_id: profile.profile_id, profile_version: profile.version }),
    }],
  });
}

async function persistChangeSetResponse(
  manifestPath: string,
  item: LocalImportView,
  response: ImportResponse,
): Promise<void> {
  let current: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(item.payload);
    if (isRecord(parsed)) current = parsed;
  } catch {
    // The local import payload will be replaced by the server response below.
  }
  const changeset = response.changeset ?? current.changeset;
  const status = response.status ?? (isRecord(changeset) && typeof changeset.status === "string" ? changeset.status : item.status);
  const occurredAt = new Date().toISOString();
  await invoke("store_local_import_result", {
    manifestPath,
    importId: item.import_id,
    projectId: item.project_id,
    fileVersionId: item.file_version_id,
    status,
    payload: JSON.stringify({ ...current, ...response, changeset }),
    createdAt: new Date().toISOString(),
    attempt: 0,
    rawRecords: [],
    assets: response.changeset ? assetsFromResponse(response, { project_id: item.project_id, source_id: item.source_id ?? "", file_id: item.file_id, path: item.path, sha256: item.sha256, size: item.size, modified_at: item.modified_at }, { file_id: item.file_id, file_version_id: item.file_version_id, file_revision: item.file_revision, path: item.path, sha256: item.sha256, size: item.size, modified_at: item.modified_at }) : [],
    auditEvents: [{
      audit_id: `${item.import_id}:changeset:${Date.now()}`,
      project_id: item.project_id,
      source_id: item.source_id,
      file_id: item.file_id,
      file_version_id: item.file_version_id,
      source_hash: item.sha256,
      actor: "desktop-review",
      occurred_at: occurredAt,
      operation: "changeset-review",
      outcome: status,
      correlation_id: item.import_id,
      payload: JSON.stringify({ changeset_id: item.changeset?.id ?? null, status }),
    }],
  });
}

export async function editNormalizedChangeSet(
  manifestPath: string,
  item: LocalImportView,
  recordIdentity: string,
  field: string,
  value: unknown,
): Promise<void> {
  const changesetId = item.changeset?.id;
  if (!changesetId) throw new Error("Không tìm thấy ChangeSet để chỉnh sửa.");
  const response = await requestJson<ImportResponse>(`/api/v1/projects/${item.project_id}/file-imports/${changesetId}/edit`, {
    method: "POST",
    body: JSON.stringify({ record_identity: recordIdentity, field, value, edited_by: "desktop-review" }),
  });
  await persistChangeSetResponse(manifestPath, item, response);
}

export async function approveFileChangeSet(
  manifestPath: string,
  item: LocalImportView,
): Promise<void> {
  const changesetId = item.changeset?.id;
  if (!changesetId) throw new Error("Không tìm thấy ChangeSet để duyệt.");
  const response = await requestJson<ImportResponse>(`/api/v1/projects/${item.project_id}/file-imports/${changesetId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approved_by: "desktop-review" }),
  });
  await persistChangeSetResponse(manifestPath, item, response);
}

export async function rejectFileChangeSet(
  manifestPath: string,
  item: LocalImportView,
  reason?: string,
): Promise<void> {
  const changesetId = item.changeset?.id;
  if (!changesetId) throw new Error("Không tìm thấy ChangeSet để từ chối.");
  const response = await requestJson<ImportResponse>(`/api/v1/projects/${item.project_id}/file-imports/${changesetId}/reject`, {
    method: "POST",
    body: JSON.stringify({ rejected_by: "desktop-review", reason }),
  });
  await persistChangeSetResponse(manifestPath, item, response);
}

function parseAssetSyncJob(payload: string): AssetSyncJobPayload {
  const value: unknown = JSON.parse(payload);
  if (!isRecord(value) || typeof value.project_id !== "string" || typeof value.asset_id !== "string" || typeof value.asset_version !== "number") {
    throw new Error("ASSET_SYNC payload is invalid");
  }
  return {
    project_id: value.project_id,
    source_id: typeof value.source_id === "string" ? value.source_id : null,
    file_id: typeof value.file_id === "string" ? value.file_id : null,
    file_version_id: typeof value.file_version_id === "string" ? value.file_version_id : undefined,
    source_hash: typeof value.source_hash === "string" ? value.source_hash : null,
    asset_id: value.asset_id,
    asset_version: value.asset_version,
    source_path: typeof value.source_path === "string" ? value.source_path : null,
    source_locator: typeof value.source_locator === "string" || isRecord(value.source_locator) ? value.source_locator : null,
    payload: value.payload,
  };
}

async function processAssetSync(manifestPath: string, job: PendingJob): Promise<void> {
  await jobCheckpoint(manifestPath, job, 25, "SYNCING_ASSET");
  const asset = parseAssetSyncJob(job.payload);
  const sourceLocator = typeof asset.source_locator === "string"
    ? (() => { try { return JSON.parse(asset.source_locator); } catch { return asset.source_locator; } })()
    : asset.source_locator;
  const payload = typeof asset.payload === "string"
    ? (() => { try { return JSON.parse(asset.payload); } catch { return asset.payload; } })()
    : asset.payload;
  const response = await requestJson<{ inserted?: Array<Record<string, unknown>>; unchanged?: Array<Record<string, unknown>>; conflicts?: Array<Record<string, unknown>> }>(`/api/v1/projects/${asset.project_id}/file-assets/sync`, {
    method: "POST",
    body: JSON.stringify({
      idempotency_key: job.idempotency_key ?? job.job_id,
      actor: "desktop-asset-sync",
      assets: [{
        asset_id: asset.asset_id,
        asset_version: asset.asset_version,
        source_hash: asset.source_hash,
        source_path: asset.source_path,
        source_locator: sourceLocator,
        payload,
      }],
    }),
  });
  const conflicts = response.conflicts ?? [];
  const status = conflicts.length ? "CONFLICT_REVIEW" : "SYNCED";
  await jobCheckpoint(manifestPath, job, 90, status);
  await invoke("mark_local_asset_sync", {
    manifestPath,
    assetId: asset.asset_id,
    assetVersion: asset.asset_version,
    status,
  });
}

export async function listPendingJobs(manifestPath: string, sourceId?: string): Promise<PendingJob[]> {
  return invoke<PendingJob[]>("list_pending_jobs", { manifestPath, sourceId });
}

export async function cancelPendingJob(manifestPath: string, jobId: string): Promise<boolean> {
  return invoke<boolean>("cancel_pending_job", { manifestPath, jobId });
}

export async function processPendingFileScans(manifestPath: string, maxJobs = 4): Promise<number> {
  const jobs = await invoke<PendingJob[]>("claim_pending_jobs", {
    manifestPath,
    now: Math.floor(Date.now() / 1000),
    maxJobs,
  });
  let processed = 0;
  for (const job of jobs) {
    if (job.job_type === "ASSET_SYNC") {
      try {
        await processAssetSync(manifestPath, job);
        await invoke("complete_pending_job", { manifestPath, jobId: job.job_id });
        processed += 1;
      } catch (error) {
        if (error instanceof JobCancelledError) {
          await invoke("cancel_pending_job", { manifestPath, jobId: job.job_id });
          continue;
        }
        const message = error instanceof Error ? error.message : "Asset sync failed";
        const delaySeconds = Math.min(300, 5 * 2 ** Math.min(job.attempts + 1, 6));
        await invoke("retry_pending_job", {
          manifestPath,
          jobId: job.job_id,
          error: message,
          nextRetryAt: Math.floor(Date.now() / 1000) + delaySeconds,
          maxAttempts: 3,
        });
      }
      continue;
    }
    if (job.job_type !== "FILE_SCAN") {
      await invoke("complete_pending_job", { manifestPath, jobId: job.job_id });
      continue;
    }
    try {
      await processFileScan(manifestPath, job);
      await invoke("complete_pending_job", { manifestPath, jobId: job.job_id });
      processed += 1;
    } catch (error) {
      if (error instanceof JobCancelledError) {
        await invoke("cancel_pending_job", { manifestPath, jobId: job.job_id });
        continue;
      }
      const message = error instanceof Error ? error.message : "File import failed";
      const delaySeconds = Math.min(300, 5 * 2 ** Math.min(job.attempts + 1, 6));
      await invoke("retry_pending_job", {
        manifestPath,
        jobId: job.job_id,
        error: message,
        nextRetryAt: Math.floor(Date.now() / 1000) + delaySeconds,
        maxAttempts: 3,
      });
    }
  }
  return processed;
}
