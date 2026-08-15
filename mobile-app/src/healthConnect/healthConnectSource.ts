import type { MetricType } from '../core/healthRecords';
import type {
  HealthDataSource,
  SourceCheckpoint,
  SourceReadResult,
} from '../core/ports';
import type { HealthConnectGateway } from './healthConnectGateway';
import {
  HEALTH_CONNECT_ADAPTER_ID,
  mapHealthConnectRecord,
} from './healthConnectMapping';

const HISTORY_DAYS = 30;
const PAGE_SIZE = 250;

interface SnapshotCheckpoint {
  version: 1;
  startTime: string;
  endTime: string;
  pageToken: string;
}

export class HealthConnectSource implements HealthDataSource {
  readonly adapterId = HEALTH_CONNECT_ADAPTER_ID;

  constructor(
    private readonly gateway: HealthConnectGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async readBatch(
    metricType: MetricType,
    checkpoint: SourceCheckpoint,
    signal?: AbortSignal,
  ): Promise<SourceReadResult> {
    if (signal?.aborted) {
      return { status: 'interrupted' };
    }

    const snapshot = parseCheckpoint(checkpoint, this.now);
    if (!snapshot) {
      return { status: 'failed', error: 'invalid-checkpoint' };
    }

    try {
      const sdkStatus = await this.gateway.getSdkStatus();
      if (sdkStatus !== 'available') {
        return { status: 'failed', error: 'source-unavailable' };
      }

      const grantedMetrics = await this.gateway.getGrantedMetrics();
      if (!grantedMetrics.includes(metricType)) {
        return { status: 'authorization-required' };
      }

      const response = await this.gateway.readRecords(
        metricType,
        snapshot.startTime,
        snapshot.endTime,
        snapshot.pageToken,
        PAGE_SIZE,
      );
      if (signal?.aborted) {
        return { status: 'interrupted' };
      }
      if (!Array.isArray(response.records)) {
        return { status: 'failed', error: 'read-failed' };
      }
      if (
        response.pageToken !== null &&
        typeof response.pageToken !== 'string'
      ) {
        return { status: 'failed', error: 'read-failed' };
      }

      const importedAt = this.now().toISOString();
      const upserts = response.records.map((record) =>
        mapHealthConnectRecord(record, metricType, importedAt),
      );
      const hasMore = response.pageToken !== null;
      const nextCheckpoint =
        response.pageToken === null
          ? null
          : JSON.stringify({
              version: 1,
              startTime: snapshot.startTime,
              endTime: snapshot.endTime,
              pageToken: response.pageToken,
            } satisfies SnapshotCheckpoint);

      return {
        status: 'success',
        batch: {
          upserts,
          deletions: [],
          nextCheckpoint,
          hasMore,
          snapshotScope: 'authoritative-snapshot',
        },
      };
    } catch {
      return { status: 'failed', error: 'read-failed' };
    }
  }
}

function parseCheckpoint(
  checkpoint: SourceCheckpoint,
  now: () => Date,
): {
  startTime: string;
  endTime: string;
  pageToken: string | null;
} | null {
  if (checkpoint === null) {
    const end = now();
    if (!Number.isFinite(end.getTime())) {
      return null;
    }
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - HISTORY_DAYS);
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      pageToken: null,
    };
  }

  try {
    const value: unknown = JSON.parse(checkpoint);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return null;
    }
    const parsed = value as Record<string, unknown>;
    if (
      parsed.version !== 1 ||
      typeof parsed.startTime !== 'string' ||
      typeof parsed.endTime !== 'string' ||
      typeof parsed.pageToken !== 'string' ||
      !parsed.pageToken
    ) {
      return null;
    }
    const start = Date.parse(parsed.startTime);
    const end = Date.parse(parsed.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
      return null;
    }
    return {
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      pageToken: parsed.pageToken,
    };
  } catch {
    return null;
  }
}
