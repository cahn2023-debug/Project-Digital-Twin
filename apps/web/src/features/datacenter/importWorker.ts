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
  row: number;
  column?: string | null;
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
  preview: PreviewInfo | null;
  error: string | null;
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
    if (!isRecord(item) || typeof item.code !== "string" || typeof item.message !== "string" || typeof item.row !== "number") return [];
    return [{
      code: item.code,
      message: item.message,
      row: item.row,
      column: typeof item.column === "string" ? item.column : null,
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
  const isDocument = /\.(md|markdown|txt|doc|docx)$/i.test(payload.path);
  const endpoint = isDocument
    ? `/api/v1/projects/${payload.project_id}/document-imports`
    : `/api/v1/projects/${payload.project_id}/file-imports/from-path`;
  const request = isDocument
    ? {
        path: payload.path,
        file_id: context.file_id,
        file_revision: context.file_revision,
        idempotency_key: idempotencyKey,
        created_by: "desktop-import",
      }
    : {
        path: payload.path,
        file_id: context.file_id,
        file_revision: context.file_revision,
        idempotency_key: idempotencyKey,
        source_hash: payload.sha256,
        created_by: "desktop-import",
      };
  const importId = `${context.file_version_id}:${payload.sha256}`;
  try {
    const response = await requestJson<ImportResponse>(endpoint, {
      method: "POST",
      body: JSON.stringify(request),
    });
    const status = response.suppressed
      ? "SUPPRESSED"
      : response.preview
        ? "PREVIEW"
        : response.changeset?.status ?? "IMPORTED";
    const localPayload = {
      ...response,
      source_id: payload.source_id,
      path: payload.path,
      file_id: context.file_id,
      file_version_id: context.file_version_id,
      file_revision: context.file_revision,
      sha256: payload.sha256,
      size: payload.size,
      modified_at: payload.modified_at,
    };
    await invoke("store_local_import_result", {
      manifestPath,
      importId,
      projectId: payload.project_id,
      fileVersionId: context.file_version_id,
      status,
      payload: JSON.stringify(localPayload),
      createdAt: new Date().toISOString(),
      rawRecords: rawRecordsFromResponse(response, context, payload.source_id, isDocument, payload.path),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File import failed";
    try {
      await invoke("store_local_import_result", {
        manifestPath,
        importId,
        projectId: payload.project_id,
        fileVersionId: context.file_version_id,
        status: "FAILED",
        payload: JSON.stringify({
          source_id: payload.source_id,
          path: payload.path,
          file_id: context.file_id,
          file_version_id: context.file_version_id,
          file_revision: context.file_revision,
          sha256: payload.sha256,
          error: message,
        }),
        createdAt: new Date().toISOString(),
        rawRecords: [],
      });
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
      const responsePreview = isRecord(value.preview) ? (value.preview as unknown as PreviewInfo) : null;
      const result = isRecord(value.result) ? value.result : null;
      const resultIssues = result ? [...readIssues(result.invalid), ...readIssues(result.unmapped)] : [];
      const changeset = isRecord(value.changeset) ? value.changeset : null;
      const preview = responsePreview ?? (resultIssues.length ? {
        rows: Array.isArray(changeset?.raw_rows) ? changeset.raw_rows : [],
        issues: resultIssues,
      } : null);
      const error = typeof value.error === "string" ? value.error : null;
      return [{ ...record, source_id: sourceId, path, file_id: fileId, file_revision: fileRevision, sha256, preview, error }];
    } catch {
      return [];
    }
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
  const response = await requestJson<ImportResponse>(
    `/api/v1/projects/${importView.project_id}/file-imports/from-path`,
    {
      method: "POST",
      body: JSON.stringify({
        path: importView.path,
        file_id: importView.file_id,
        file_revision: importView.file_revision,
        idempotency_key: `FILE_IMPORT_PROFILE:${importView.file_id}:${importView.file_revision}:${profile.profile_id}:v${profile.version}`,
        source_hash: importView.sha256 || undefined,
        created_by: "desktop-import-mapping",
        profile,
      }),
    },
  );
  const context: FileScanContext = {
    file_id: importView.file_id,
    file_version_id: importView.file_version_id,
    file_revision: importView.file_revision,
    path: importView.path,
    sha256: importView.sha256,
    size: 0,
    modified_at: null,
  };
  const status = response.changeset?.status ?? (response.preview ? "PREVIEW" : "IMPORTED");
  const localPayload = { ...response, source_id: sourceId, path: importView.path, file_id: importView.file_id, file_version_id: importView.file_version_id, file_revision: importView.file_revision, sha256: importView.sha256, profile };
  await invoke("store_local_import_result", {
    manifestPath,
    importId: importView.import_id,
    projectId: importView.project_id,
    fileVersionId: importView.file_version_id,
    status,
    payload: JSON.stringify(localPayload),
    createdAt: new Date().toISOString(),
    rawRecords: rawRecordsFromResponse(response, context, sourceId, false, importView.path),
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
