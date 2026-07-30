export const CANONICAL_SCHEMA_VERSION = 1 as const;

export type MetricType = 'steps' | 'heartRate' | 'sleep' | 'workout';

export interface SourceProvenance {
  adapterId: string;
  recordId: string;
  originId?: string;
  device?: {
    manufacturer?: string;
    model?: string;
  };
  updatedAt?: string;
}

interface RecordEnvelope {
  schemaVersion: typeof CANONICAL_SCHEMA_VERSION;
  recordId: string;
  startTime: string;
  zoneOffset?: string;
  source: SourceProvenance;
  importedAt: string;
}

export interface StepsRecord extends RecordEnvelope {
  metricType: 'steps';
  endTime: string;
  payload: {
    count: number;
  };
}

export interface HeartRateRecord extends RecordEnvelope {
  metricType: 'heartRate';
  endTime?: string;
  payload: {
    samples: readonly {
      timestamp: string;
      beatsPerMinute: number;
    }[];
  };
}

export type SleepStage = 'awake' | 'light' | 'deep' | 'rem' | 'unknown';

export interface SleepRecord extends RecordEnvelope {
  metricType: 'sleep';
  endTime: string;
  payload: {
    stages?: readonly {
      startTime: string;
      endTime: string;
      stage: SleepStage;
    }[];
  };
}

export type WorkoutActivityType =
  | 'cycling'
  | 'running'
  | 'strengthTraining'
  | 'swimming'
  | 'walking'
  | 'other';

export interface WorkoutRecord extends RecordEnvelope {
  metricType: 'workout';
  endTime: string;
  payload: {
    activityType?: WorkoutActivityType;
    sourceActivityLabel?: string;
    title?: string;
  };
}

export type CanonicalHealthRecord =
  | StepsRecord
  | HeartRateRecord
  | SleepRecord
  | WorkoutRecord;

export interface SourceDeletion {
  adapterId: string;
  metricType: MetricType;
  sourceRecordId: string;
}

export type ValidationErrorCode =
  | 'invalid-envelope'
  | 'invalid-source'
  | 'invalid-time-range'
  | 'invalid-zone-offset'
  | 'invalid-payload'
  | 'unexpected-metric'
  | 'unexpected-source';

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ValidationErrorCode };

const SLEEP_STAGES: ReadonlySet<unknown> = new Set<SleepStage>([
  'awake',
  'light',
  'deep',
  'rem',
  'unknown',
]);
const WORKOUT_ACTIVITY_TYPES: ReadonlySet<unknown> = new Set<WorkoutActivityType>(
  [
    'cycling',
    'running',
    'strengthTraining',
    'swimming',
    'walking',
    'other',
  ],
);
const ZONE_OFFSET = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;
const UTC_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function sourceIdentity(
  adapterId: string,
  metricType: MetricType,
  sourceRecordId: string,
): string {
  return JSON.stringify([adapterId, metricType, sourceRecordId]);
}

export function validateCanonicalRecord(
  record: unknown,
  expectedMetric: MetricType,
  expectedAdapterId: string,
): ValidationResult {
  if (!isObject(record)) {
    return { valid: false, error: 'invalid-envelope' };
  }

  if (
    record.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
    !isNonEmpty(record.recordId) ||
    !isInstant(record.startTime) ||
    !isInstant(record.importedAt)
  ) {
    return { valid: false, error: 'invalid-envelope' };
  }

  if (
    !isObject(record.source) ||
    !isNonEmpty(record.source.adapterId) ||
    !isNonEmpty(record.source.recordId) ||
    !isOptionalNonEmpty(record.source.originId) ||
    !isOptionalInstant(record.source.updatedAt) ||
    !isValidDevice(record.source.device)
  ) {
    return { valid: false, error: 'invalid-source' };
  }

  if (record.metricType !== expectedMetric) {
    return { valid: false, error: 'unexpected-metric' };
  }

  if (record.source.adapterId !== expectedAdapterId) {
    return { valid: false, error: 'unexpected-source' };
  }

  if (
    record.zoneOffset !== undefined &&
    !isZoneOffset(record.zoneOffset)
  ) {
    return { valid: false, error: 'invalid-zone-offset' };
  }

  switch (record.metricType) {
    case 'steps':
      return validateSteps(record);
    case 'heartRate':
      return validateHeartRate(record);
    case 'sleep':
      return validateSleep(record);
    case 'workout':
      return validateWorkout(record);
    default:
      return { valid: false, error: 'unexpected-metric' };
  }
}

export function validateSourceDeletion(
  deletion: unknown,
  expectedMetric: MetricType,
  expectedAdapterId: string,
): ValidationResult {
  if (
    !isObject(deletion) ||
    !isNonEmpty(deletion.adapterId) ||
    !isNonEmpty(deletion.sourceRecordId)
  ) {
    return { valid: false, error: 'invalid-source' };
  }
  if (deletion.metricType !== expectedMetric) {
    return { valid: false, error: 'unexpected-metric' };
  }
  if (deletion.adapterId !== expectedAdapterId) {
    return { valid: false, error: 'unexpected-source' };
  }
  return { valid: true };
}

function validateSteps(record: Record<string, unknown>): ValidationResult {
  if (!isTimeRange(record.startTime, record.endTime)) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    !Number.isInteger(record.payload.count) ||
    (record.payload.count as number) < 0
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateHeartRate(
  record: Record<string, unknown>,
): ValidationResult {
  if (
    record.endTime !== undefined &&
    !isTimeRange(record.startTime, record.endTime)
  ) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    !Array.isArray(record.payload.samples) ||
    record.payload.samples.length === 0 ||
    record.payload.samples.some(
      (sample) =>
        !isObject(sample) ||
        !isInstant(sample.timestamp) ||
        !Number.isFinite(sample.beatsPerMinute) ||
        (sample.beatsPerMinute as number) <= 0,
    )
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateSleep(record: Record<string, unknown>): ValidationResult {
  if (!isTimeRange(record.startTime, record.endTime)) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (!isObject(record.payload)) {
    return { valid: false, error: 'invalid-payload' };
  }
  const stages = record.payload.stages;
  if (
    stages !== undefined &&
    (!Array.isArray(stages) ||
      stages.some(
        (stage) =>
          !isObject(stage) ||
          !SLEEP_STAGES.has(stage.stage) ||
          !isTimeRange(stage.startTime, stage.endTime) ||
          instantValue(stage.startTime) < instantValue(record.startTime) ||
          instantValue(stage.endTime) > instantValue(record.endTime),
      ))
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateWorkout(
  record: Record<string, unknown>,
): ValidationResult {
  if (!isTimeRange(record.startTime, record.endTime)) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    (record.payload.activityType !== undefined &&
      !WORKOUT_ACTIVITY_TYPES.has(record.payload.activityType)) ||
    !isOptionalNonEmpty(record.payload.sourceActivityLabel) ||
    !isOptionalNonEmpty(record.payload.title)
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalNonEmpty(value: unknown): boolean {
  return value === undefined || isNonEmpty(value);
}

function isInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !UTC_INSTANT.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === normalizeUtcInstant(value)
  );
}

function isOptionalInstant(value: unknown): boolean {
  return value === undefined || isInstant(value);
}

function isZoneOffset(value: unknown): value is string {
  return typeof value === 'string' && ZONE_OFFSET.test(value);
}

function isTimeRange(startTime: unknown, endTime: unknown): boolean {
  return (
    isInstant(startTime) &&
    isInstant(endTime) &&
    instantValue(startTime) <= instantValue(endTime)
  );
}

function isValidDevice(device: unknown): boolean {
  return (
    device === undefined ||
    (isObject(device) &&
      isOptionalNonEmpty(device.manufacturer) &&
      isOptionalNonEmpty(device.model))
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeUtcInstant(value: string): string {
  return value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_, fraction: string | undefined) =>
      `.${(fraction ?? '').padEnd(3, '0')}Z`,
  );
}

function instantValue(value: unknown): number {
  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
}
