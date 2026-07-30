import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_SCHEMA_VERSION,
  type HeartRateRecord,
  type StepsRecord,
} from './healthRecords';
import { importMetric } from './importHealthData';
import type { SourceReadResult } from './ports';
import {
  InMemoryHealthDataSource,
  InMemoryRecordRepository,
} from '../testing/inMemoryAdapters';

const ADAPTER_ID = 'synthetic.fixture-source';
const STEPS_SOURCE_RECORD_ID = 'fictional-step-record';

function stepsRecord(count = 12): StepsRecord {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    recordId: 'fixture-local-step-record',
    metricType: 'steps',
    startTime: '2040-01-01T10:00:00.000Z',
    endTime: '2040-01-01T10:05:00.000Z',
    zoneOffset: '+00:00',
    source: {
      adapterId: ADAPTER_ID,
      recordId: STEPS_SOURCE_RECORD_ID,
      originId: 'fictional-origin',
    },
    importedAt: '2040-01-01T10:06:00.000Z',
    payload: { count },
  };
}

function heartRateRecord(): HeartRateRecord {
  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    recordId: 'fixture-local-heart-record',
    metricType: 'heartRate',
    startTime: '2040-01-01T11:00:00.000Z',
    source: {
      adapterId: ADAPTER_ID,
      recordId: 'fictional-heart-record',
    },
    importedAt: '2040-01-01T11:01:00.000Z',
    payload: {
      samples: [
        {
          timestamp: '2040-01-01T11:00:00.000Z',
          beatsPerMinute: 60,
        },
      ],
    },
  };
}

function upsertResult(
  record: StepsRecord | HeartRateRecord,
  nextCheckpoint: string,
): SourceReadResult {
  return {
    status: 'success',
    batch: {
      upserts: [record],
      deletions: [],
      nextCheckpoint,
      hasMore: false,
    },
  };
}

test('imports a valid synthetic steps batch', async () => {
  const repository = new InMemoryRecordRepository();
  const source = new InMemoryHealthDataSource(ADAPTER_ID, {
    steps: [upsertResult(stepsRecord(), 'steps-checkpoint-1')],
  });

  const result = await importMetric({
    source,
    metricType: 'steps',
    repository,
  });

  assert.deepEqual(result, { status: 'complete', committedBatches: 1 });
  assert.equal((await repository.findByMetric('steps')).length, 1);
  assert.equal(
    await repository.getCheckpoint({
      sourceAdapterId: ADAPTER_ID,
      metricType: 'steps',
    }),
    'steps-checkpoint-1',
  );
});

test('replaying the same batch does not duplicate a record', async () => {
  const repository = new InMemoryRecordRepository();
  const repeatedBatch = upsertResult(stepsRecord(), 'steps-checkpoint-1');
  const source = new InMemoryHealthDataSource(ADAPTER_ID, {
    steps: [repeatedBatch, repeatedBatch],
  });

  await importMetric({ source, metricType: 'steps', repository });
  await importMetric({ source, metricType: 'steps', repository });

  assert.equal((await repository.findByMetric('steps')).length, 1);
});

test('a failed atomic commit preserves the previous checkpoint', async () => {
  const repository = new InMemoryRecordRepository();
  await repository.commit({
    key: { sourceAdapterId: ADAPTER_ID, metricType: 'steps' },
    upserts: [],
    deletions: [],
    nextCheckpoint: 'previous-checkpoint',
  });
  repository.failNextCommit();
  const source = new InMemoryHealthDataSource(ADAPTER_ID, {
    steps: [upsertResult(stepsRecord(), 'uncommitted-checkpoint')],
  });

  const result = await importMetric({
    source,
    metricType: 'steps',
    repository,
  });

  assert.deepEqual(result, {
    status: 'failed',
    committedBatches: 0,
    error: 'repository-commit-failed',
  });
  assert.equal(
    await repository.getCheckpoint({
      sourceAdapterId: ADAPTER_ID,
      metricType: 'steps',
    }),
    'previous-checkpoint',
  );
  assert.equal((await repository.findByMetric('steps')).length, 0);
});

test('a source deletion removes the matching record idempotently', async () => {
  const repository = new InMemoryRecordRepository();
  const deletion: SourceReadResult = {
    status: 'success',
    batch: {
      upserts: [],
      deletions: [
        {
          adapterId: ADAPTER_ID,
          metricType: 'steps',
          sourceRecordId: STEPS_SOURCE_RECORD_ID,
        },
      ],
      nextCheckpoint: 'steps-checkpoint-2',
      hasMore: false,
    },
  };
  const source = new InMemoryHealthDataSource(ADAPTER_ID, {
    steps: [
      upsertResult(stepsRecord(), 'steps-checkpoint-1'),
      deletion,
      deletion,
    ],
  });

  await importMetric({ source, metricType: 'steps', repository });
  await importMetric({ source, metricType: 'steps', repository });
  await importMetric({ source, metricType: 'steps', repository });

  assert.equal((await repository.findByMetric('steps')).length, 0);
});

test('checkpoints are isolated by metric', async () => {
  const repository = new InMemoryRecordRepository();
  const source = new InMemoryHealthDataSource(ADAPTER_ID, {
    steps: [upsertResult(stepsRecord(), 'steps-checkpoint')],
    heartRate: [
      upsertResult(heartRateRecord(), 'heart-rate-checkpoint'),
    ],
  });

  await importMetric({ source, metricType: 'steps', repository });
  await importMetric({ source, metricType: 'heartRate', repository });

  assert.equal(
    await repository.getCheckpoint({
      sourceAdapterId: ADAPTER_ID,
      metricType: 'steps',
    }),
    'steps-checkpoint',
  );
  assert.equal(
    await repository.getCheckpoint({
      sourceAdapterId: ADAPTER_ID,
      metricType: 'heartRate',
    }),
    'heart-rate-checkpoint',
  );
});

test('invalid records do not persist, advance, or expose payloads', async () => {
  const repository = new InMemoryRecordRepository();
  const privatePayloadValue = 987654321;
  const source = new InMemoryHealthDataSource(ADAPTER_ID, {
    steps: [
      upsertResult(
        stepsRecord(-privatePayloadValue),
        'invalid-checkpoint',
      ),
    ],
  });

  const result = await importMetric({
    source,
    metricType: 'steps',
    repository,
  });

  assert.deepEqual(result, {
    status: 'failed',
    committedBatches: 0,
    error: 'invalid-record',
  });
  assert.equal(
    JSON.stringify(result).includes(String(privatePayloadValue)),
    false,
  );
  assert.equal((await repository.findByMetric('steps')).length, 0);
  assert.equal(
    await repository.getCheckpoint({
      sourceAdapterId: ADAPTER_ID,
      metricType: 'steps',
    }),
    null,
  );
});

test('the same service accepts multiple sources and repositories', async () => {
  const firstRepository = new InMemoryRecordRepository();
  const secondRepository = new InMemoryRecordRepository();
  const firstSource = sourceWithAdapterId('synthetic.fixture-source-a');
  const secondSource = sourceWithAdapterId('synthetic.fixture-source-b');

  const firstResult = await importMetric({
    source: firstSource,
    metricType: 'steps',
    repository: firstRepository,
  });
  const secondResult = await importMetric({
    source: secondSource,
    metricType: 'steps',
    repository: secondRepository,
  });

  assert.equal(firstResult.status, 'complete');
  assert.equal(secondResult.status, 'complete');
  assert.equal((await firstRepository.findByMetric('steps')).length, 1);
  assert.equal((await secondRepository.findByMetric('steps')).length, 1);
});

function sourceWithAdapterId(adapterId: string): InMemoryHealthDataSource {
  const record = stepsRecord();
  return new InMemoryHealthDataSource(adapterId, {
    steps: [
      upsertResult(
        {
          ...record,
          source: { ...record.source, adapterId },
        },
        `${adapterId}-checkpoint`,
      ),
    ],
  });
}
