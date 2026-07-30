import {
  sourceIdentity,
  type CanonicalHealthRecord,
  type MetricType,
} from '../core/healthRecords';
import type {
  AtomicRecordCommit,
  CheckpointKey,
  HealthDataSource,
  RecordRepository,
  SourceCheckpoint,
  SourceReadResult,
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
        },
      }
    );
  }
}

export class InMemoryRecordRepository implements RecordRepository {
  private records = new Map<string, CanonicalHealthRecord>();
  private checkpoints = new Map<string, SourceCheckpoint>();
  private shouldFailNextCommit = false;

  async getCheckpoint(key: CheckpointKey): Promise<SourceCheckpoint> {
    return this.checkpoints.get(checkpointKey(key)) ?? null;
  }

  async commit(batch: AtomicRecordCommit): Promise<void> {
    if (this.shouldFailNextCommit) {
      this.shouldFailNextCommit = false;
      throw new Error('Synthetic repository commit failure.');
    }

    const nextRecords = new Map(this.records);
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

    const nextCheckpoints = new Map(this.checkpoints);
    nextCheckpoints.set(
      checkpointKey(batch.key),
      batch.nextCheckpoint,
    );

    this.records = nextRecords;
    this.checkpoints = nextCheckpoints;
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
