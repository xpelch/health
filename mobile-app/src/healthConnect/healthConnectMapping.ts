import {
  CANONICAL_SCHEMA_VERSION,
  sourceIdentity,
  type CanonicalHealthRecord,
  type MetricType,
  type SleepStage,
  type WorkoutActivityType,
} from '../core/healthRecords';

export const HEALTH_CONNECT_ADAPTER_ID = 'android.health-connect';

const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const ZONE_OFFSET = /^[+-](?:0\d|1[0-7]):[0-5]\d$|^[+-]18:00$/;

interface NativeRecordBase {
  sourceRecordId: string;
  originId?: string;
  updatedAt?: string;
  deviceManufacturer?: string;
  deviceModel?: string;
  startTime: string;
  endTime: string;
  startZoneOffset?: string;
}

export function mapHealthConnectRecord(
  value: unknown,
  expectedMetric: MetricType,
  importedAt: string,
): CanonicalHealthRecord {
  const record = parseBaseRecord(value, expectedMetric);
  const envelope = {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    recordId: sourceIdentity(
      HEALTH_CONNECT_ADAPTER_ID,
      expectedMetric,
      record.sourceRecordId,
    ),
    metricType: expectedMetric,
    startTime: record.startTime,
    ...(record.startZoneOffset ? { zoneOffset: record.startZoneOffset } : {}),
    source: {
      adapterId: HEALTH_CONNECT_ADAPTER_ID,
      recordId: record.sourceRecordId,
      ...(record.originId ? { originId: record.originId } : {}),
      ...(record.updatedAt ? { updatedAt: record.updatedAt } : {}),
      ...(record.deviceManufacturer || record.deviceModel
        ? {
            device: {
              ...(record.deviceManufacturer
                ? { manufacturer: record.deviceManufacturer }
                : {}),
              ...(record.deviceModel ? { model: record.deviceModel } : {}),
            },
          }
        : {}),
    },
    importedAt: parseInstant(importedAt),
  } as const;

  if (expectedMetric === 'steps') {
    const count = readFiniteNumber(value, 'count');
    if (!Number.isInteger(count) || count < 0) {
      throw new TypeError('Invalid Health Connect steps record.');
    }
    return {
      ...envelope,
      metricType: 'steps',
      endTime: record.endTime,
      payload: { count },
    };
  }

  if (expectedMetric === 'heartRate') {
    const samples = readArray(value, 'samples').map((sample) => {
      const beatsPerMinute = readFiniteNumber(sample, 'beatsPerMinute');
      if (!Number.isInteger(beatsPerMinute) || beatsPerMinute <= 0) {
        throw new TypeError('Invalid Health Connect heart-rate sample.');
      }
      return {
        timestamp: parseInstant(readString(sample, 'timestamp')),
        beatsPerMinute,
      };
    });
    return {
      ...envelope,
      metricType: 'heartRate',
      endTime: record.endTime,
      payload: { samples },
    };
  }

  if (expectedMetric === 'sleep') {
    const stages = readArray(value, 'stages').map((stage) => ({
      startTime: parseInstant(readString(stage, 'startTime')),
      endTime: parseInstant(readString(stage, 'endTime')),
      stage: mapSleepStage(readFiniteNumber(stage, 'stageType')),
    }));
    return {
      ...envelope,
      metricType: 'sleep',
      endTime: record.endTime,
      payload: { stages },
    };
  }

  const exerciseType = readFiniteNumber(value, 'exerciseType');
  if (!Number.isInteger(exerciseType)) {
    throw new TypeError('Invalid Health Connect workout record.');
  }
  const activityType = mapExerciseType(exerciseType);
  const title = readOptionalString(value, 'title');
  return {
    ...envelope,
    metricType: 'workout',
    endTime: record.endTime,
    payload: {
      activityType,
      ...(activityType === 'other'
        ? {
            sourceActivityLabel: `Health Connect exercise type ${exerciseType}`,
          }
        : {}),
      ...(title ? { title } : {}),
    },
  };
}

function parseBaseRecord(
  value: unknown,
  expectedMetric: MetricType,
): NativeRecordBase {
  const recordType = readString(value, 'recordType');
  if (recordType !== expectedMetric) {
    throw new TypeError('Unexpected Health Connect record type.');
  }

  const startTime = parseInstant(readString(value, 'startTime'));
  const endTime = parseInstant(readString(value, 'endTime'));
  if (startTime > endTime) {
    throw new TypeError('Invalid Health Connect record range.');
  }

  return {
    sourceRecordId: readNonEmptyString(value, 'sourceRecordId'),
    originId: readOptionalString(value, 'originId'),
    updatedAt: readOptionalInstant(value, 'updatedAt'),
    deviceManufacturer: readOptionalString(value, 'deviceManufacturer'),
    deviceModel: readOptionalString(value, 'deviceModel'),
    startTime,
    endTime,
    startZoneOffset: readOptionalZoneOffset(value, 'startZoneOffset'),
  };
}

function mapSleepStage(stageType: number): SleepStage {
  if (stageType === 1 || stageType === 3 || stageType === 7) {
    return 'awake';
  }
  if (stageType === 4) {
    return 'light';
  }
  if (stageType === 5) {
    return 'deep';
  }
  if (stageType === 6) {
    return 'rem';
  }
  return 'unknown';
}

function mapExerciseType(exerciseType: number): WorkoutActivityType {
  if (exerciseType === 8 || exerciseType === 9) {
    return 'cycling';
  }
  if (exerciseType === 56 || exerciseType === 57) {
    return 'running';
  }
  if (exerciseType === 70) {
    return 'strengthTraining';
  }
  if (exerciseType === 73 || exerciseType === 74) {
    return 'swimming';
  }
  if (exerciseType === 79) {
    return 'walking';
  }
  return 'other';
}

function parseInstant(value: string): string {
  if (!UTC_INSTANT.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new TypeError('Invalid Health Connect instant.');
  }
  return value;
}

function readOptionalInstant(value: unknown, key: string): string | undefined {
  const instant = readOptionalString(value, key);
  return instant ? parseInstant(instant) : undefined;
}

function readOptionalZoneOffset(
  value: unknown,
  key: string,
): string | undefined {
  const offset = readOptionalString(value, key);
  if (!offset) {
    return undefined;
  }
  const normalized = offset === 'Z' ? '+00:00' : offset;
  if (!ZONE_OFFSET.test(normalized)) {
    throw new TypeError('Invalid Health Connect zone offset.');
  }
  return normalized;
}

function readArray(value: unknown, key: string): unknown[] {
  const object = readObject(value);
  const result = object[key];
  if (!Array.isArray(result)) {
    throw new TypeError('Invalid Health Connect array.');
  }
  return result;
}

function readFiniteNumber(value: unknown, key: string): number {
  const object = readObject(value);
  const result = object[key];
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new TypeError('Invalid Health Connect number.');
  }
  return result;
}

function readString(value: unknown, key: string): string {
  const object = readObject(value);
  const result = object[key];
  if (typeof result !== 'string') {
    throw new TypeError('Invalid Health Connect string.');
  }
  return result;
}

function readNonEmptyString(value: unknown, key: string): string {
  const result = readString(value, key);
  if (!result.trim()) {
    throw new TypeError('Invalid empty Health Connect string.');
  }
  return result;
}

function readOptionalString(value: unknown, key: string): string | undefined {
  const object = readObject(value);
  const result = object[key];
  if (result === null || result === undefined) {
    return undefined;
  }
  if (typeof result !== 'string' || !result.trim()) {
    throw new TypeError('Invalid optional Health Connect string.');
  }
  return result;
}

function readObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Invalid Health Connect record.');
  }
  return value as Record<string, unknown>;
}
