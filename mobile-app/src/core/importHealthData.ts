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
  SourceBatch,
  SourceCheckpoint,
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

  let checkpoint: SourceCheckpoint;
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

    let rawReadResult: unknown;
    try {
      rawReadResult = await readSourceBatch(
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

    let readResult: SourceReadResult | null;
    try {
      readResult = parseSourceReadResult(rawReadResult);
    } catch {
      return stopped('read-failed', committedBatches);
    }
    if (!readResult) {
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

    let recordsAreValid: boolean;
    let deletionsAreValid: boolean;
    try {
      recordsAreValid =
        isDenseArray(readResult.batch.upserts) &&
        readResult.batch.upserts.every(
          (record) =>
            validateCanonicalRecord(
              record,
              metricType,
              source.adapterId,
            ).valid,
        );
      deletionsAreValid =
        isDenseArray(readResult.batch.deletions) &&
        readResult.batch.deletions.every(
          (deletion) =>
            validateSourceDeletion(
              deletion,
              metricType,
              source.adapterId,
            ).valid,
        );
    } catch {
      return stopped('invalid-record', committedBatches);
    }
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
  checkpoint: SourceCheckpoint,
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

function parseSourceReadResult(
  value: unknown,
): SourceReadResult | null {
  const snapshot = snapshotData(value, new WeakSet());
  if (!isObject(snapshot) || typeof snapshot.status !== 'string') {
    return null;
  }
  if (
    snapshot.status === 'authorization-required' ||
    snapshot.status === 'interrupted'
  ) {
    return { status: snapshot.status };
  }
  if (snapshot.status === 'failed') {
    return isSourceFailureCode(snapshot.error)
      ? { status: 'failed', error: snapshot.error }
      : null;
  }
  if (snapshot.status !== 'success' || !isObject(snapshot.batch)) {
    return null;
  }

  const upserts = snapshot.batch.upserts;
  const deletions = snapshot.batch.deletions;
  const hasMore = snapshot.batch.hasMore;
  const snapshotScope = snapshot.batch.snapshotScope;
  const nextCheckpoint = snapshot.batch.nextCheckpoint;
  if (
    !Array.isArray(upserts) ||
    !Array.isArray(deletions) ||
    typeof hasMore !== 'boolean' ||
    !isSourceCheckpoint(nextCheckpoint) ||
    (snapshotScope !== 'incremental' &&
      snapshotScope !== 'authoritative-snapshot') ||
    !Object.prototype.hasOwnProperty.call(
      snapshot.batch,
      'nextCheckpoint',
    )
  ) {
    return null;
  }

  return {
    status: 'success',
    batch: {
      upserts: upserts as unknown as SourceBatch['upserts'],
      deletions: deletions as unknown as SourceBatch['deletions'],
      nextCheckpoint,
      hasMore,
      snapshotScope,
    },
  };
}

function isSourceCheckpoint(value: unknown): value is SourceCheckpoint {
  return value === null || typeof value === 'string';
}

function snapshotData(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value !== 'object') {
    throw new TypeError('Source operations must contain data values.');
  }
  if (ancestors.has(value)) {
    throw new TypeError('Source operations must not contain cycles.');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return snapshotArray(value, ancestors);
    }
    if (!isObject(value)) {
      throw new TypeError('Source operations must use plain objects.');
    }
    return snapshotObject(value, ancestors);
  } finally {
    ancestors.delete(value);
  }
}

function snapshotArray(
  value: unknown[],
  ancestors: WeakSet<object>,
): unknown[] {
  const keys = Reflect.ownKeys(value);
  const expectedKeys = new Set(['length']);
  for (let index = 0; index < value.length; index += 1) {
    expectedKeys.add(String(index));
  }
  if (
    keys.some(
      (key) => typeof key !== 'string' || !expectedKeys.has(key),
    )
  ) {
    throw new TypeError('Source arrays must not have custom fields.');
  }

  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(
      value,
      String(index),
    );
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new TypeError('Source arrays must be dense data arrays.');
    }
    snapshot.push(snapshotData(descriptor.value, ancestors));
  }
  return snapshot;
}

function snapshotObject(
  value: Record<string, unknown>,
  ancestors: WeakSet<object>,
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      throw new TypeError('Source objects must not use symbol fields.');
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
      throw new TypeError('Source objects must contain enumerable data.');
    }
    snapshot[key] = snapshotData(descriptor.value, ancestors);
  }
  return snapshot;
}

function isSourceFailureCode(
  value: unknown,
): value is SourceFailureCode {
  return (
    value === 'invalid-checkpoint' ||
    value === 'read-failed' ||
    value === 'source-unavailable'
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
