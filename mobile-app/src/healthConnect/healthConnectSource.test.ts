import assert from 'node:assert/strict';
import test from 'node:test';
import type { MetricType } from '../core/healthRecords';
import type {
  HealthConnectGateway,
  HealthConnectSdkStatus,
  NativeHealthConnectPage,
} from './healthConnectGateway';
import { mapHealthConnectRecord } from './healthConnectMapping';
import { HealthConnectSource } from './healthConnectSource';

const NOW = new Date('2026-07-30T18:00:00.000Z');
const START = '2026-07-29T10:00:00.000Z';
const END = '2026-07-29T11:00:00.000Z';

test('maps Health Connect steps with provenance and device details', () => {
  const record = mapHealthConnectRecord(
    nativeRecord({
      recordType: 'steps',
      count: 1234,
      startZoneOffset: '-04:00',
      deviceManufacturer: 'Samsung',
      deviceModel: 'Galaxy Watch',
    }),
    'steps',
    NOW.toISOString(),
  );

  assert.equal(record.metricType, 'steps');
  assert.deepEqual(record.payload, { count: 1234 });
  assert.equal(record.zoneOffset, '-04:00');
  assert.equal(record.source.originId, 'com.sec.android.app.shealth');
  assert.deepEqual(record.source.device, {
    manufacturer: 'Samsung',
    model: 'Galaxy Watch',
  });
});

test('maps Health Connect heart-rate samples', () => {
  const record = mapHealthConnectRecord(
    nativeRecord({
      recordType: 'heartRate',
      samples: [
        {
          timestamp: '2026-07-29T10:30:00.000Z',
          beatsPerMinute: 72,
        },
      ],
    }),
    'heartRate',
    NOW.toISOString(),
  );

  assert.equal(record.metricType, 'heartRate');
  assert.deepEqual(record.payload, {
    samples: [
      {
        timestamp: '2026-07-29T10:30:00.000Z',
        beatsPerMinute: 72,
      },
    ],
  });
});

test('maps known and unknown Health Connect sleep stages', () => {
  const record = mapHealthConnectRecord(
    nativeRecord({
      recordType: 'sleep',
      stages: [
        {
          startTime: START,
          endTime: '2026-07-29T10:30:00.000Z',
          stageType: 5,
        },
        {
          startTime: '2026-07-29T10:30:00.000Z',
          endTime: END,
          stageType: 99,
        },
      ],
    }),
    'sleep',
    NOW.toISOString(),
  );

  assert.equal(record.metricType, 'sleep');
  assert.deepEqual(
    record.payload.stages?.map((stage) => stage.stage),
    ['deep', 'unknown'],
  );
});

test('maps an unknown exercise without discarding its source type', () => {
  const record = mapHealthConnectRecord(
    nativeRecord({
      recordType: 'workout',
      exerciseType: 999,
      title: null,
      deviceManufacturer: null,
      deviceModel: null,
    }),
    'workout',
    NOW.toISOString(),
  );

  assert.equal(record.metricType, 'workout');
  assert.deepEqual(record.payload, {
    activityType: 'other',
    sourceActivityLabel: 'Health Connect exercise type 999',
  });
  assert.equal(record.source.device, undefined);
});

test('rejects a malformed native record before it enters the core', () => {
  assert.throws(
    () =>
      mapHealthConnectRecord(
        nativeRecord({
          recordType: 'steps',
          count: 'sensitive invalid value',
        }),
        'steps',
        NOW.toISOString(),
      ),
    /Invalid Health Connect number/,
  );
});

test('reports Health Connect as unavailable without reading records', async () => {
  const gateway = new FakeHealthConnectGateway();
  gateway.sdkStatus = 'unavailable';
  const source = createSource(gateway);

  const result = await source.readBatch('steps', null);

  assert.deepEqual(result, {
    status: 'failed',
    error: 'source-unavailable',
  });
  assert.equal(gateway.readCalls.length, 0);
});

test('requests authorization independently for a missing metric', async () => {
  const gateway = new FakeHealthConnectGateway();
  gateway.grantedMetrics = ['steps'];
  const source = createSource(gateway);

  const result = await source.readBatch('sleep', null);

  assert.deepEqual(result, { status: 'authorization-required' });
  assert.equal(gateway.readCalls.length, 0);
});

test('returns an explicit empty authoritative snapshot', async () => {
  const gateway = new FakeHealthConnectGateway();
  gateway.grantedMetrics = ['steps'];
  gateway.pages = [{ records: [], pageToken: null }];
  const source = createSource(gateway);

  const result = await source.readBatch('steps', null);

  assert.equal(result.status, 'success');
  if (result.status !== 'success') {
    return;
  }
  assert.deepEqual(result.batch.upserts, []);
  assert.equal(result.batch.snapshotScope, 'authoritative-snapshot');
  assert.equal(result.batch.hasMore, false);
  assert.equal(result.batch.nextCheckpoint, null);
});

test('preserves the bounded snapshot window across pages', async () => {
  const gateway = new FakeHealthConnectGateway();
  gateway.grantedMetrics = ['steps'];
  gateway.pages = [
    {
      records: [nativeRecord({ recordType: 'steps', count: 100 })],
      pageToken: 'next-page',
    },
    {
      records: [
        nativeRecord({
          recordType: 'steps',
          count: 200,
          sourceRecordId: 'record-2',
        }),
      ],
      pageToken: null,
    },
  ];
  const source = createSource(gateway);

  const first = await source.readBatch('steps', null);
  assert.equal(first.status, 'success');
  if (first.status !== 'success') {
    return;
  }
  assert.equal(first.batch.hasMore, true);
  assert.equal(typeof first.batch.nextCheckpoint, 'string');

  const second = await source.readBatch('steps', first.batch.nextCheckpoint);
  assert.equal(second.status, 'success');
  assert.equal(gateway.readCalls.length, 2);
  assert.equal(
    gateway.readCalls[0]?.startTime,
    gateway.readCalls[1]?.startTime,
  );
  assert.equal(gateway.readCalls[0]?.endTime, gateway.readCalls[1]?.endTime);
  assert.equal(gateway.readCalls[1]?.pageToken, 'next-page');
});

test('returns interrupted before contacting Health Connect', async () => {
  const gateway = new FakeHealthConnectGateway();
  const controller = new AbortController();
  controller.abort();
  const source = createSource(gateway);

  const result = await source.readBatch('steps', null, controller.signal);

  assert.deepEqual(result, { status: 'interrupted' });
  assert.equal(gateway.readCalls.length, 0);
});

test('does not expose native read failures or malformed payloads', async () => {
  const failingGateway = new FakeHealthConnectGateway();
  failingGateway.grantedMetrics = ['steps'];
  failingGateway.readError = new Error('private native details');
  const malformedGateway = new FakeHealthConnectGateway();
  malformedGateway.grantedMetrics = ['steps'];
  malformedGateway.pages = [
    {
      records: [nativeRecord({ recordType: 'steps', count: 'invalid' })],
      pageToken: null,
    },
  ];

  const failure = await createSource(failingGateway).readBatch('steps', null);
  const malformed = await createSource(malformedGateway).readBatch(
    'steps',
    null,
  );

  assert.deepEqual(failure, {
    status: 'failed',
    error: 'read-failed',
  });
  assert.deepEqual(malformed, {
    status: 'failed',
    error: 'read-failed',
  });
});

function nativeRecord(overrides: Record<string, unknown>) {
  return {
    sourceRecordId: 'record-1',
    originId: 'com.sec.android.app.shealth',
    updatedAt: '2026-07-29T12:00:00.000Z',
    deviceManufacturer: undefined,
    deviceModel: undefined,
    startTime: START,
    endTime: END,
    startZoneOffset: 'Z',
    endZoneOffset: 'Z',
    ...overrides,
  };
}

function createSource(gateway: HealthConnectGateway) {
  return new HealthConnectSource(gateway, () => new Date(NOW));
}

class FakeHealthConnectGateway implements HealthConnectGateway {
  sdkStatus: HealthConnectSdkStatus = 'available';
  grantedMetrics: MetricType[] = [];
  pages: NativeHealthConnectPage[] = [];
  readError: Error | null = null;
  readCalls: {
    metricType: MetricType;
    startTime: string;
    endTime: string;
    pageToken: string | null;
    pageSize: number;
  }[] = [];

  async getSdkStatus(): Promise<HealthConnectSdkStatus> {
    return this.sdkStatus;
  }

  async getGrantedMetrics(): Promise<readonly MetricType[]> {
    return this.grantedMetrics;
  }

  async requestPermissions(
    metrics: readonly MetricType[],
  ): Promise<readonly MetricType[]> {
    this.grantedMetrics = [...metrics];
    return this.grantedMetrics;
  }

  async readRecords(
    metricType: MetricType,
    startTime: string,
    endTime: string,
    pageToken: string | null,
    pageSize: number,
  ): Promise<NativeHealthConnectPage> {
    this.readCalls.push({
      metricType,
      startTime,
      endTime,
      pageToken,
      pageSize,
    });
    if (this.readError) {
      throw this.readError;
    }
    return this.pages.shift() ?? { records: [], pageToken: null };
  }

  openSettings(): void {}
}
