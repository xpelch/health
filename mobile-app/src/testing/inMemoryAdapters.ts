import {
  sourceIdentity,
  type CanonicalHealthRecord,
  type MetricType,
} from '../core/healthRecords';
import {
  NO_SOURCE_CHECKPOINT,
  type AtomicRecordCommit,
  type CheckpointKey,
  type HealthDataSource,
  type RecordRepository,
  type RecordCommitResult,
  type ReconciliationState,
  type SourceCheckpoint,
  type SourceReadResult,
} from '../core/ports';

type ScriptedResponses = Partial<
  Record<MetricType, readonly SourceReadResult[]>
>;

export class InMemoryHealthDataSource implements HealthDataSource {
  private readonly positions = new Map<MetricType, number>();

  constructor(
    readonly adapterId: string,
    private readonly responses: ScriptedResponses,
  ) {}

  async readBatch(
    metricType: MetricType,
    checkpoint: SourceCheckpoint,
  ): Promise<SourceReadResult> {
    const responses = this.responses[metricType] ?? [];
    const position = this.positions.get(metricType) ?? 0;
    const response = responses[position];
    this.positions.set(metricType, position + 1);

    return (
      response ?? {
        status: 'success',
        batch: {
          upserts: [],
          deletions: [],
          nextCheckpoint: checkpoint,
          hasMore: false,
          snapshotScope: 'incremental',
        },
      }
    );
  }
}

export class InMemoryRecordRepository implements RecordRepository {
  private records = new Map<string, CanonicalHealthRecord>();
  private checkpoints = new Map<string, SourceCheckpoint>();
  private reconciliations = new Map<
    string,
    {
      records: Map<string, CanonicalHealthRecord>;
      state: ReconciliationState;
    }
  >();
  private shouldFailNextCommit = false;

  async getCheckpoint(key: CheckpointKey): Promise<SourceCheckpoint> {
    return (
      this.checkpoints.get(checkpointKey(key)) ??
      NO_SOURCE_CHECKPOINT
    );
  }

  async getReconciliationState(
    key: CheckpointKey,
  ): Promise<ReconciliationState | null> {
    return this.reconciliations.get(checkpointKey(key))?.state ?? null;
  }

  async commit(
    batch: AtomicRecordCommit,
  ): Promise<RecordCommitResult> {
    const currentCheckpoint =
      this.checkpoints.get(checkpointKey(batch.key)) ??
      NO_SOURCE_CHECKPOINT;
    if (
      !checkpointsAreEqual(
        currentCheckpoint,
        batch.expectedCheckpoint,
      )
    ) {
      return { status: 'checkpoint-conflict' };
    }

    if (this.shouldFailNextCommit) {
      this.shouldFailNextCommit = false;
      throw new Error('Synthetic repository commit failure.');
    }

    const key = checkpointKey(batch.key);
    if (batch.mode === 'stage-reconciliation') {
      const stagedRecords =
        this.reconciliations.get(key)?.records ?? new Map();
      this.reconciliations.set(key, {
        records: applyOperations(stagedRecords, batch),
        state: {
          checkpoint: batch.nextCheckpoint,
          expectedCheckpoint: batch.expectedCheckpoint,
        },
      });
      return { status: 'committed' };
    }

    let nextRecords: Map<string, CanonicalHealthRecord>;
    if (batch.mode === 'complete-reconciliation') {
      const stagedRecords =
        this.reconciliations.get(key)?.records ?? new Map();
      const completeSnapshot = applyOperations(stagedRecords, batch);
      nextRecords = recordsWithoutSourceSnapshot(this.records, batch.key);
      for (const [identity, record] of completeSnapshot) {
        nextRecords.set(identity, record);
      }
    } else {
      nextRecords = applyOperations(this.records, batch);
    }

    const nextCheckpoints = new Map(this.checkpoints);
    nextCheckpoints.set(
      checkpointKey(batch.key),
      batch.nextCheckpoint,
    );

    this.records = nextRecords;
    this.checkpoints = nextCheckpoints;
    this.reconciliations.delete(key);
    return { status: 'committed' };
  }

  async findByMetric(
    metricType: MetricType,
  ): Promise<readonly CanonicalHealthRecord[]> {
    return [...this.records.values()].filter(
      (record) => record.metricType === metricType,
    );
  }

  failNextCommit(): void {
    this.shouldFailNextCommit = true;
  }
}

function checkpointKey(key: CheckpointKey): string {
  return JSON.stringify([key.sourceAdapterId, key.metricType]);
}

function checkpointsAreEqual(
  left: SourceCheckpoint,
  right: SourceCheckpoint,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function applyOperations(
  records: ReadonlyMap<string, CanonicalHealthRecord>,
  batch: AtomicRecordCommit,
): Map<string, CanonicalHealthRecord> {
  const nextRecords = new Map(records);
  for (const record of batch.upserts) {
    nextRecords.set(
      sourceIdentity(
        record.source.adapterId,
        record.metricType,
        record.source.recordId,
      ),
      record,
    );
  }
  for (const deletion of batch.deletions) {
    nextRecords.delete(
      sourceIdentity(
        deletion.adapterId,
        deletion.metricType,
        deletion.sourceRecordId,
      ),
    );
  }
  return nextRecords;
}

function recordsWithoutSourceSnapshot(
  records: ReadonlyMap<string, CanonicalHealthRecord>,
  key: CheckpointKey,
): Map<string, CanonicalHealthRecord> {
  return new Map(
    [...records].filter(
      ([, record]) =>
        record.source.adapterId !== key.sourceAdapterId ||
        record.metricType !== key.metricType,
    ),
  );
}
