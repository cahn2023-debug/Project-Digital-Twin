import { invoke } from '@tauri-apps/api/core';

export interface DbStatusResponse {
  is_initialized: boolean;
  is_healthy: boolean;
  message: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
}

export interface SyncBatchResult {
  total_processed: number;
  synced_count: number;
  conflict_count: number;
  failed_count: number;
  message: string;
}

export async function initEncryptedDatabase(dbPath: string, secretPasskey: string): Promise<DbStatusResponse> {
  return await invoke<DbStatusResponse>('init_encrypted_database', { dbPath, secretPasskey });
}

export async function checkEncryptedDatabaseHealth(): Promise<DbStatusResponse> {
  return await invoke<DbStatusResponse>('check_encrypted_database_health');
}

export async function pushClientMutation(
  entityType: string,
  entityId: string,
  action: string,
  payload: string
): Promise<any> {
  return await invoke('push_client_mutation', { entityType, entityId, action, payload });
}

export async function getPendingMutationCount(): Promise<number> {
  return await invoke<number>('get_pending_mutation_count');
}

export async function setNetworkStatus(online: boolean): Promise<boolean> {
  return await invoke<boolean>('set_network_status', { online });
}

export async function triggerManualSync(batchSize?: number): Promise<SyncBatchResult> {
  return await invoke<SyncBatchResult>('trigger_manual_sync', { batchSize });
}

export async function resolveMutationConflict(eventId: string, choice: 'USE_SERVER' | 'OVERWRITE_WITH_CLIENT'): Promise<boolean> {
  return await invoke<boolean>('resolve_mutation_conflict', { eventId, choice });
}
