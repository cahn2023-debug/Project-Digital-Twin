import { invoke } from "@tauri-apps/api/core";

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
