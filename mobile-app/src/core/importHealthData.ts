import type { MetricType } from './healthRecords';
import {
  validateCanonicalRecord,
  validateSourceDeletion,
} from './healthRecords';
import type {
  HealthDataSource,
  RecordRepository,
  SourceFailureCode,
} from './ports';

export type ImportFailureCode =
  | SourceFailureCode
  | 'batch-limit-reached'
  | 'checkpoint-read-failed'
  | 'invalid-record'
  | 'repository-commit-failed';

type PartialReason =
  | ImportFailureCode
  | 'authorization-required'
  | 'interrupted';

export type ImportResult =
  | { status: 'complete'; committedBatches: number }
  | {
      status: 'partial';
      committedBatches: number;
      reason: PartialReason;
    }
  | { status: 'authorization-required'; committedBatches: 0 }
  | { status: 'interrupted'; committedBatches: 0 }
  | { status: 'failed'; committedBatches: 0; error: ImportFailureCode };

export interface ImportMetricRequest {
  source: HealthDataSource;
  metricType: MetricType;
  repository: RecordRepository;
  signal?: AbortSignal;
  maxBatches?: number;
}

const DEFAULT_MAX_BATCHES = 100;

export async function importMetric({
  source,
  metricType,
  repository,
  signal,
  maxBatches = DEFAULT_MAX_BATCHES,
}: ImportMetricRequest): Promise<ImportResult> {
  const key = {
    sourceAdapterId: source.adapterId,
    metricType,
  } as const;

  let checkpoint: unknown;
  try {
    checkpoint = await repository.getCheckpoint(key);
  } catch {
    return {
      status: 'failed',
      committedBatches: 0,
      error: 'checkpoint-read-failed',
    };
  }

  let committedBatches = 0;
  while (committedBatches < maxBatches) {
    if (signal?.aborted) {
      return stopped('interrupted', committedBatches);
    }

    let readResult;
    try {
      readResult = await source.readBatch(metricType, checkpoint);
    } catch {
      return stopped('read-failed', committedBatches);
    }

    if (readResult.status !== 'success') {
      if (readResult.status === 'failed') {
        return stopped(readResult.error, committedBatches);
      }
      return stopped(readResult.status, committedBatches);
    }

    const recordsAreValid = readResult.batch.upserts.every(
      (record) =>
        validateCanonicalRecord(record, metricType, source.adapterId).valid,
    );
    const deletionsAreValid = readResult.batch.deletions.every(
      (deletion) =>
        validateSourceDeletion(deletion, metricType, source.adapterId).valid,
    );
    if (!recordsAreValid || !deletionsAreValid) {
      return stopped('invalid-record', committedBatches);
    }

    try {
      await repository.commit({
        key,
        upserts: readResult.batch.upserts,
        deletions: readResult.batch.deletions,
        nextCheckpoint: readResult.batch.nextCheckpoint,
      });
    } catch {
      return stopped('repository-commit-failed', committedBatches);
    }

    checkpoint = readResult.batch.nextCheckpoint;
    committedBatches += 1;

    if (!readResult.batch.hasMore) {
      return { status: 'complete', committedBatches };
    }
  }

  return stopped('batch-limit-reached', committedBatches);
}

function stopped(
  reason: PartialReason,
  committedBatches: number,
): ImportResult {
  if (committedBatches > 0) {
    return { status: 'partial', committedBatches, reason };
  }
  if (reason === 'authorization-required') {
    return { status: reason, committedBatches: 0 };
  }
  if (reason === 'interrupted') {
    return { status: reason, committedBatches: 0 };
  }
  return {
    status: 'failed',
    committedBatches: 0,
    error: reason,
  };
}
