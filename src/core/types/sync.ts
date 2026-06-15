export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

export interface SyncState {
  status: SyncStatus;
  pendingEvents: number;
  lastSyncAt?: number;
}

export type OutboxEventType = 'care_registered' | 'care_deleted' | 'reminder_created' | 'reminder_deleted';

export type OutboxEventStatus = 'pending' | 'processing' | 'synced' | 'failed';

export interface OutboxEvent {
  id: string;
  type: OutboxEventType;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
  idempotencyKey: string;
}
