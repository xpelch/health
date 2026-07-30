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

const SLEEP_STAGES = new Set<SleepStage>([
  'awake',
  'light',
  'deep',
  'rem',
  'unknown',
]);
const WORKOUT_ACTIVITY_TYPES = new Set<WorkoutActivityType>([
  'cycling',
  'running',
  'strengthTraining',
  'swimming',
  'walking',
  'other',
]);
const ZONE_OFFSET = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;

export function sourceIdentity(
  adapterId: string,
  metricType: MetricType,
  sourceRecordId: string,
): string {
  return JSON.stringify([adapterId, metricType, sourceRecordId]);
}

export function validateCanonicalRecord(
  record: CanonicalHealthRecord,
  expectedMetric: MetricType,
  expectedAdapterId: string,
): ValidationResult {
  if (
    record.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
    !isNonEmpty(record.recordId) ||
    !isInstant(record.startTime) ||
    !isInstant(record.importedAt)
  ) {
    return { valid: false, error: 'invalid-envelope' };
  }

  if (
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

  if (record.zoneOffset !== undefined && !ZONE_OFFSET.test(record.zoneOffset)) {
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
  }
}

export function validateSourceDeletion(
  deletion: SourceDeletion,
  expectedMetric: MetricType,
  expectedAdapterId: string,
): ValidationResult {
  if (
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

function validateSteps(record: StepsRecord): ValidationResult {
  if (!isTimeRange(record.startTime, record.endTime)) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (!Number.isInteger(record.payload.count) || record.payload.count < 0) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateHeartRate(record: HeartRateRecord): ValidationResult {
  if (
    record.endTime !== undefined &&
    !isTimeRange(record.startTime, record.endTime)
  ) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    record.payload.samples.length === 0 ||
    record.payload.samples.some(
      (sample) =>
        !isInstant(sample.timestamp) ||
        !Number.isFinite(sample.beatsPerMinute) ||
        sample.beatsPerMinute <= 0,
    )
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateSleep(record: SleepRecord): ValidationResult {
  if (!isTimeRange(record.startTime, record.endTime)) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    record.payload.stages?.some(
      (stage) =>
        !SLEEP_STAGES.has(stage.stage) ||
        !isTimeRange(stage.startTime, stage.endTime) ||
        Date.parse(stage.startTime) < Date.parse(record.startTime) ||
        Date.parse(stage.endTime) > Date.parse(record.endTime),
    )
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateWorkout(record: WorkoutRecord): ValidationResult {
  if (!isTimeRange(record.startTime, record.endTime)) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
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
  return isNonEmpty(value) && Number.isFinite(Date.parse(value));
}

function isOptionalInstant(value: unknown): boolean {
  return value === undefined || isInstant(value);
}

function isTimeRange(startTime: string, endTime: string): boolean {
  return isInstant(endTime) && Date.parse(startTime) <= Date.parse(endTime);
}

function isValidDevice(device: SourceProvenance['device']): boolean {
  return (
    device === undefined ||
    (isOptionalNonEmpty(device.manufacturer) &&
      isOptionalNonEmpty(device.model))
  );
}
