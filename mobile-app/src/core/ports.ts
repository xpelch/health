import type {
  CanonicalHealthRecord,
  MetricType,
  SourceDeletion,
} from './healthRecords';

export type SourceCheckpoint = unknown;
export const NO_SOURCE_CHECKPOINT: SourceCheckpoint = null;

export interface CheckpointKey {
  sourceAdapterId: string;
  metricType: MetricType;
}

export interface SourceBatch {
  upserts: readonly CanonicalHealthRecord[];
  deletions: readonly SourceDeletion[];
  nextCheckpoint: SourceCheckpoint;
  hasMore: boolean;
  snapshotScope: 'incremental' | 'authoritative-snapshot';
}

export type SourceFailureCode =
  | 'invalid-checkpoint'
  | 'read-failed'
  | 'source-unavailable';

export type SourceReadResult =
  | { status: 'success'; batch: SourceBatch }
  | { status: 'authorization-required' }
  | { status: 'interrupted' }
  | { status: 'failed'; error: SourceFailureCode };

export interface HealthDataSource {
  readonly adapterId: string;
  readBatch(
    metricType: MetricType,
    checkpoint: SourceCheckpoint,
    signal?: AbortSignal,
  ): Promise<SourceReadResult>;
}

export interface AtomicRecordCommit {
  key: CheckpointKey;
  expectedCheckpoint: SourceCheckpoint;
  mode:
    | 'incremental'
    | 'stage-reconciliation'
    | 'complete-reconciliation';
  upserts: readonly CanonicalHealthRecord[];
  deletions: readonly SourceDeletion[];
  nextCheckpoint: SourceCheckpoint;
}

export type RecordCommitResult =
  | { status: 'committed' }
  | { status: 'checkpoint-conflict' };

export interface ReconciliationState {
  checkpoint: SourceCheckpoint;
  expectedCheckpoint: SourceCheckpoint;
}

export interface RecordRepository {
  getCheckpoint(key: CheckpointKey): Promise<SourceCheckpoint>;
  getReconciliationState(
    key: CheckpointKey,
  ): Promise<ReconciliationState | null>;
  commit(batch: AtomicRecordCommit): Promise<RecordCommitResult>;
  findByMetric(
    metricType: MetricType,
  ): Promise<readonly CanonicalHealthRecord[]>;
}
