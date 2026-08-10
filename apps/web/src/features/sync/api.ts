export interface StagedConflictItem {
  conflict_id: string;
  mutation_id: string;
  client_id: string;
  workspace_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  timestamp: number;
  conflicting_fields: Record<string, any>;
  server_fields: Record<string, any>;
  status: string;
  created_at: string;
}

export interface StagedConflictListResponse {
  total: number;
  conflicts: StagedConflictItem[];
}

export interface ConflictResolvePayload {
  chosen_client_id?: string;
  custom_values?: Record<string, any>;
  resolved_by?: string;
}

export async function fetchStagedConflicts(baseUrl = '/api/v1'): Promise<StagedConflictListResponse> {
  const res = await fetch(`${baseUrl}/sync/conflicts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conflicts: ${res.statusText}`);
  }
  return await res.json();
}

export async function getConflictDetail(conflictId: string, baseUrl = '/api/v1'): Promise<StagedConflictItem> {
  const res = await fetch(`${baseUrl}/sync/conflicts/${conflictId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conflict detail: ${res.statusText}`);
  }
  return await res.json();
}

export async function resolveStagedConflict(
  conflictId: string,
  payload: ConflictResolvePayload,
  baseUrl = '/api/v1'
): Promise<StagedConflictItem> {
  const res = await fetch(`${baseUrl}/sync/conflicts/${conflictId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve conflict: ${res.statusText}`);
  }
  return await res.json();
}
