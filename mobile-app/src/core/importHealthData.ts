import type { MetricType } from './healthRecords';
import {
  validateCanonicalRecord,
  validateSourceDeletion,
} from './healthRecords';
import type {
  HealthDataSource,
  RecordCommitResult,
  RecordRepository,
  ReconciliationState,
  SourceFailureCode,
  SourceReadResult,
} from './ports';
import { NO_SOURCE_CHECKPOINT } from './ports';

export type ImportFailureCode =
  | SourceFailureCode
  | 'batch-limit-reached'
  | 'checkpoint-conflict'
  | 'checkpoint-read-failed'
  | 'invalid-batch-limit'
  | 'invalid-record'
  | 'reconciliation-not-authoritative'
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
  if (
    !Number.isInteger(maxBatches) ||
    !Number.isFinite(maxBatches) ||
    maxBatches <= 0
  ) {
    return {
      status: 'failed',
      committedBatches: 0,
      error: 'invalid-batch-limit',
    };
  }

  const key = {
    sourceAdapterId: source.adapterId,
    metricType,
  } as const;

  let checkpoint: unknown;
  let reconciliationState: ReconciliationState | null;
  try {
    checkpoint = await repository.getCheckpoint(key);
    reconciliationState = await repository.getReconciliationState(key);
  } catch {
    return {
      status: 'failed',
      committedBatches: 0,
      error: 'checkpoint-read-failed',
    };
  }
  let expectedCheckpoint =
    reconciliationState?.expectedCheckpoint ?? checkpoint;
  let expectedReconciliationSessionId =
    reconciliationState?.sessionId ?? null;
  if (reconciliationState) {
    checkpoint = reconciliationState.checkpoint;
  }

  let committedBatches = 0;
  let processedBatches = 0;
  let isReconciling = reconciliationState !== null;
  let checkpointResetAttempted = false;
  while (processedBatches < maxBatches) {
    if (signal?.aborted) {
      return stopped('interrupted', committedBatches);
    }

    let readResult: unknown;
    try {
      readResult = await readSourceBatch(
        source,
        metricType,
        checkpoint,
        signal,
      );
    } catch {
      return stopped('read-failed', committedBatches);
    }

    if (signal?.aborted) {
      return stopped('interrupted', committedBatches);
    }

    if (!isSourceReadResult(readResult)) {
      return stopped('read-failed', committedBatches);
    }

    if (readResult.status !== 'success') {
      if (readResult.status === 'failed') {
        if (
          readResult.error === 'invalid-checkpoint' &&
          !checkpointResetAttempted
        ) {
          if (isReconciling) {
            if (!expectedReconciliationSessionId) {
              return stopped(
                'repository-commit-failed',
                committedBatches,
              );
            }
            let discardResult;
            try {
              discardResult = await repository.discardReconciliation(
                key,
                expectedCheckpoint,
                expectedReconciliationSessionId,
              );
            } catch {
              return stopped(
                'repository-commit-failed',
                committedBatches,
              );
            }
            if (discardResult.status === 'checkpoint-conflict') {
              return stopped('checkpoint-conflict', committedBatches);
            }
          }
          checkpoint = NO_SOURCE_CHECKPOINT;
          isReconciling = true;
          checkpointResetAttempted = true;
          expectedReconciliationSessionId = null;
          continue;
        }
        return stopped(readResult.error, committedBatches);
      }
      return stopped(readResult.status, committedBatches);
    }

    const recordsAreValid =
      isDenseArray(readResult.batch.upserts) &&
      readResult.batch.upserts.every(
        (record) =>
          validateCanonicalRecord(
            record,
            metricType,
            source.adapterId,
          ).valid,
      );
    const deletionsAreValid =
      isDenseArray(readResult.batch.deletions) &&
      readResult.batch.deletions.every(
        (deletion) =>
          validateSourceDeletion(
            deletion,
            metricType,
            source.adapterId,
          ).valid,
      );
    if (!recordsAreValid || !deletionsAreValid) {
      return stopped('invalid-record', committedBatches);
    }

    processedBatches += 1;
    if (isReconciling) {
      if (
        readResult.batch.snapshotScope !==
        'authoritative-snapshot'
      ) {
        return stopped(
          'reconciliation-not-authoritative',
          committedBatches,
        );
      }
    }

    let commitResult: RecordCommitResult;
    try {
      commitResult = await repository.commit({
        key,
        expectedCheckpoint,
        expectedReconciliationSessionId,
        mode: isReconciling
          ? readResult.batch.hasMore
            ? 'stage-reconciliation'
            : 'complete-reconciliation'
          : 'incremental',
        upserts: readResult.batch.upserts,
        deletions: readResult.batch.deletions,
        nextCheckpoint: readResult.batch.nextCheckpoint,
      });
      if (commitResult.status === 'checkpoint-conflict') {
        return stopped('checkpoint-conflict', committedBatches);
      }
    } catch {
      return stopped('repository-commit-failed', committedBatches);
    }

    checkpoint = readResult.batch.nextCheckpoint;
    if (isReconciling && readResult.batch.hasMore) {
      if (!commitResult.reconciliationState) {
        return stopped('repository-commit-failed', committedBatches);
      }
      expectedReconciliationSessionId =
        commitResult.reconciliationState.sessionId;
      continue;
    }

    expectedCheckpoint = checkpoint;
    committedBatches += 1;

    if (!readResult.batch.hasMore) {
      return { status: 'complete', committedBatches };
    }
  }

  return stopped('batch-limit-reached', committedBatches);
}

async function readSourceBatch(
  source: HealthDataSource,
  metricType: MetricType,
  checkpoint: unknown,
  signal?: AbortSignal,
): Promise<SourceReadResult> {
  if (!signal) {
    return source.readBatch(metricType, checkpoint);
  }
  if (signal.aborted) {
    return { status: 'interrupted' };
  }

  return new Promise<SourceReadResult>((resolve, reject) => {
    const stop = () => resolve({ status: 'interrupted' });
    signal.addEventListener('abort', stop, { once: true });

    source.readBatch(metricType, checkpoint, signal).then(
      (result) => {
        signal.removeEventListener('abort', stop);
        resolve(result);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', stop);
        reject(error);
      },
    );
  });
}

function isSourceReadResult(value: unknown): value is SourceReadResult {
  if (!isObject(value) || typeof value.status !== 'string') {
    return false;
  }
  if (
    value.status === 'authorization-required' ||
    value.status === 'interrupted'
  ) {
    return true;
  }
  if (value.status === 'failed') {
    return (
      value.error === 'invalid-checkpoint' ||
      value.error === 'read-failed' ||
      value.error === 'source-unavailable'
    );
  }
  if (value.status !== 'success' || !isObject(value.batch)) {
    return false;
  }

  return (
    Array.isArray(value.batch.upserts) &&
    Array.isArray(value.batch.deletions) &&
    typeof value.batch.hasMore === 'boolean' &&
    (value.batch.snapshotScope === 'incremental' ||
      value.batch.snapshotScope === 'authoritative-snapshot') &&
    Object.prototype.hasOwnProperty.call(value.batch, 'nextCheckpoint')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDenseArray(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      return false;
    }
  }
  return true;
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
