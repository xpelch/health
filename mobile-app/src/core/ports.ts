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
  upserts: readonly CanonicalHealthRecord[];
  deletions: readonly SourceDeletion[];
  nextCheckpoint: SourceCheckpoint;
}

export interface RecordRepository {
  getCheckpoint(key: CheckpointKey): Promise<SourceCheckpoint>;
  commit(batch: AtomicRecordCommit): Promise<void>;
  findByMetric(
    metricType: MetricType,
  ): Promise<readonly CanonicalHealthRecord[]>;
}
