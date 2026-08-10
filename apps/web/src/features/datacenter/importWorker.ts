import { invoke } from "@tauri-apps/api/core";
import { requestJson } from "../../shared/api";

type PendingJob = {
  job_id: string;
  job_type: string;
  payload: string;
  idempotency_key: string | null;
  attempts: number;
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
    raw_rows?: unknown[];
  } | null;
  preview?: PreviewInfo | null;
  suppressed?: boolean;
};

export type PreviewRegion = {
  sheet: string;
  start_row: number;
  end_row: number;
  min_column: number;
  max_column: number;
  header_candidates: number[];
  headers: Array<{ row: number; column: string; value: unknown }>;
};

export type PreviewIssue = {
  code: string;
  message: string;
  row?: number | null;
  line?: number | null;
  column?: string | null;
  action?: string | null;
};

export type PreviewInfo = {
  file_id?: string;
  file_revision?: number;
  regions?: PreviewRegion[];
  skipped_sheets?: string[];
  rows?: unknown[];
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
  error: string | null;
};

type DesktopParseRecord = {
  fields: Record<string, unknown>;
  unmapped: Record<string, unknown>;
  source: Record<string, unknown>;
};

type DesktopParseResult = {
  file_id: string;
  file_revision: number;
  path: string;
  sha256: string;
  parsed_at: number;
  format: "XLSX" | "CSV" | "TXT" | "MARKDOWN" | "WORD" | "UNSUPPORTED";
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
  aliases: Record<string, string[]>;
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
    }];
  });
}

function parserFormat(path: string): DesktopParseResult["format"] {
  const extension = path.split(/[.]/).at(-1)?.toLowerCase();
  if (extension === "xlsx" || extension === "xlsm") return "XLSX";
  if (extension === "csv") return "CSV";
  if (extension === "txt") return "TXT";
  if (extension === "md" || extension === "markdown") return "MARKDOWN";
  if (extension === "docx") return "WORD";
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
        required_fields: ["code"],
        aliases: isRecord(value.aliases) ? value.aliases : {},
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
    required_fields: Object.keys(profile.aliases).filter((field) => field === "code"),
    aliases: profile.aliases,
  };
}

async function parseLocalFile(
  manifestPath: string,
  payload: FileScanPayload,
  context: FileScanContext,
): Promise<DesktopParseResult> {
  const format = parserFormat(payload.path);
  const profiles = format === "XLSX" || format === "CSV"
    ? await loadParserProfiles(manifestPath, payload.project_id, format)
    : [];
  return invoke<DesktopParseResult>("parse_file", {
    path: payload.path,
    file_id: context.file_id,
    file_revision: context.file_revision,
    profiles,
  });
}

function rawRecordsFromParse(
  result: DesktopParseResult,
  context: FileScanContext,
  sourceId: string,
  path: string,
): LocalRawRecord[] {
  return result.records.flatMap((record, index) => {
    if (!Object.keys(record.unmapped).length) return [];
    return [{
      raw_id: `${context.file_version_id}:unmapped-${index + 1}`,
      file_version_id: context.file_version_id,
      row_key: `unmapped-${index + 1}`,
      payload: JSON.stringify(record.unmapped),
      source_locator: JSON.stringify({ ...record.source, path, source_id: sourceId }),
    }];
  });
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
    return {
      raw_id: `${context.file_version_id}:row-${index + 1}`,
      file_version_id: context.file_version_id,
      row_key: `row-${index + 1}`,
      payload: JSON.stringify(row),
      source_locator: JSON.stringify(sourceLocator),
    };
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
): Promise<void> {
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
      await storeLocalImport(manifestPath, importId, payload, context, "PARSING", localPayload, [], job.attempts + 1);
      desktopParse = await parseLocalFile(manifestPath, payload, context);
      localPayload = {
        ...localPayload,
        desktop_parse: desktopParse,
      };
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

    await storeLocalImport(manifestPath, importId, payload, context, "UPLOADING", localPayload, [], job.attempts + 1);
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
            parse_report: desktopParse.report,
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
            parse_report: desktopParse.report,
            created_by: "desktop-import",
          }),
        });
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
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "File import failed";
    try {
      await storeLocalImport(
        manifestPath,
        importId,
        payload,
        context,
        "FAILED",
        { ...localPayload, desktop_parse: desktopParse, error: message },
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
      const preview = responsePreview ?? (resultIssues.length || parseIssues.length ? {
        rows: Array.isArray(changeset?.raw_rows) ? changeset.raw_rows : [],
        issues: [...parseIssues, ...resultIssues],
      } : null);
      const error = typeof value.error === "string"
        ? value.error
        : typeof value.server_error === "string"
          ? value.server_error
          : null;
      return [{ ...record, source_id: sourceId, path, file_id: fileId, file_revision: fileRevision, sha256, size, modified_at: modifiedAt, preview, error }];
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
  });
}

export async function processPendingFileScans(manifestPath: string, maxJobs = 4): Promise<number> {
  const jobs = await invoke<PendingJob[]>("claim_pending_jobs", {
    manifestPath,
    now: Math.floor(Date.now() / 1000),
    maxJobs,
  });
  let processed = 0;
  for (const job of jobs) {
    if (job.job_type !== "FILE_SCAN") {
      await invoke("complete_pending_job", { manifestPath, jobId: job.job_id });
      continue;
    }
    try {
      await processFileScan(manifestPath, job);
      await invoke("complete_pending_job", { manifestPath, jobId: job.job_id });
      processed += 1;
    } catch (error) {
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
