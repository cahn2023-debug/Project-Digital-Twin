import { invoke } from "@tauri-apps/api/core";

export interface FileScanContext {
  file_id: string;
  file_version_id: string;
  file_revision: number;
  path: string;
  sha256: string;
  size: number;
  modified_at: string | null;
}

export interface LocalRawRecord {
  raw_id: string;
  file_version_id: string;
  row_key: string;
  payload: string;
  source_locator: string;
}

export interface LocalImport {
  import_id: string;
  project_id: string;
  file_version_id: string;
  status: string;
  payload: string;
  created_at: string;
}

export interface LocalImportHistory {
  import_id: string;
  project_id: string;
  file_version_id: string;
  attempt: number;
  status: string;
  payload: string;
  created_at: string;
}

export interface PendingJob {
  job_id: string;
  job_type: string;
  payload: string;
  status: string;
  idempotency_key: string | null;
  created_at: string;
  attempts: number;
  next_retry_at: number;
  last_error: string | null;
}

export async function claimPendingJobs(
  manifestPath: string,
  now: number,
  maxJobs = 10,
): Promise<PendingJob[]> {
  return invoke<PendingJob[]>("claim_pending_jobs", {
    manifestPath,
    now,
    maxJobs,
  });
}

export async function prepareFileScan(
  manifestPath: string,
  file: Pick<FileScanContext, "path" | "sha256" | "size" | "modified_at">,
): Promise<FileScanContext> {
  return invoke<FileScanContext>("prepare_file_scan", {
    manifestPath,
    path: file.path,
    sha256: file.sha256,
    size: file.size,
    modifiedAt: file.modified_at,
    createdAt: new Date().toISOString(),
  });
}

export async function storeLocalImportResult(
  manifestPath: string,
  importId: string,
  projectId: string,
  fileVersionId: string,
  status: string,
  payload: string,
  rawRecords: LocalRawRecord[],
  attempt = 0,
): Promise<void> {
  return invoke("store_local_import_result", {
    manifestPath,
    importId,
    projectId,
    fileVersionId,
    status,
    payload,
    attempt,
    createdAt: new Date().toISOString(),
    rawRecords,
  });
}

export async function listLocalImports(manifestPath: string, projectId: string): Promise<LocalImport[]> {
  return invoke<LocalImport[]>("list_local_imports", { manifestPath, projectId });
}

export async function listLocalImportHistory(
  manifestPath: string,
  projectId: string,
  importId?: string,
): Promise<LocalImportHistory[]> {
  return invoke<LocalImportHistory[]>("list_local_import_history", { manifestPath, projectId, importId });
}

export async function saveLocalProfile(
  manifestPath: string,
  profileId: string,
  projectId: string,
  version: number,
  payload: string,
): Promise<boolean> {
  return invoke<boolean>("save_local_profile", {
    manifestPath,
    profileId,
    projectId,
    version,
    payload,
    createdAt: new Date().toISOString(),
  });
}

export async function completePendingJob(manifestPath: string, jobId: string): Promise<boolean> {
  return invoke<boolean>("complete_pending_job", { manifestPath, jobId });
}

export async function retryPendingJob(
  manifestPath: string,
  jobId: string,
  error: string,
  nextRetryAt: number,
  maxAttempts = 3,
): Promise<boolean> {
  return invoke<boolean>("retry_pending_job", {
    manifestPath,
    jobId,
    error,
    nextRetryAt,
    maxAttempts,
  });
}
