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
const CANONICAL_RECORD_KEYS = new Set([
  'schemaVersion',
  'recordId',
  'metricType',
  'startTime',
  'endTime',
  'zoneOffset',
  'source',
  'importedAt',
  'payload',
]);
const CANONICAL_RECORD_REQUIRED_KEYS = new Set([
  'schemaVersion',
  'recordId',
  'metricType',
  'startTime',
  'source',
  'importedAt',
  'payload',
]);
const SOURCE_KEYS = new Set([
  'adapterId',
  'recordId',
  'originId',
  'device',
  'updatedAt',
]);
const SOURCE_REQUIRED_KEYS = new Set(['adapterId', 'recordId']);
const DEVICE_KEYS = new Set(['manufacturer', 'model']);
const STEPS_PAYLOAD_KEYS = new Set(['count']);
const STEPS_PAYLOAD_REQUIRED_KEYS = new Set(['count']);
const HEART_RATE_PAYLOAD_KEYS = new Set(['samples']);
const HEART_RATE_PAYLOAD_REQUIRED_KEYS = new Set(['samples']);
const HEART_RATE_SAMPLE_KEYS = new Set(['timestamp', 'beatsPerMinute']);
const HEART_RATE_SAMPLE_REQUIRED_KEYS = new Set([
  'timestamp',
  'beatsPerMinute',
]);
const SLEEP_PAYLOAD_KEYS = new Set(['stages']);
const SLEEP_STAGE_KEYS = new Set(['startTime', 'endTime', 'stage']);
const SLEEP_STAGE_REQUIRED_KEYS = new Set([
  'startTime',
  'endTime',
  'stage',
]);
const WORKOUT_PAYLOAD_KEYS = new Set([
  'activityType',
  'sourceActivityLabel',
  'title',
]);
const SOURCE_DELETION_KEYS = new Set([
  'adapterId',
  'metricType',
  'sourceRecordId',
]);
const SOURCE_DELETION_REQUIRED_KEYS = new Set(SOURCE_DELETION_KEYS);
const ZONE_OFFSET = /^([+-])(\d{2}):([0-5]\d)$/;
const UTC_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?Z$/;

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
    !hasOnlyKeys(
      record,
      CANONICAL_RECORD_KEYS,
      CANONICAL_RECORD_REQUIRED_KEYS,
    ) ||
    record.schemaVersion !== CANONICAL_SCHEMA_VERSION ||
    !isNonEmpty(record.recordId) ||
    !isInstant(record.startTime) ||
    !isInstant(record.importedAt)
  ) {
    return { valid: false, error: 'invalid-envelope' };
  }

  if (
    !isObject(record.source) ||
    !hasOnlyKeys(
      record.source,
      SOURCE_KEYS,
      SOURCE_REQUIRED_KEYS,
    ) ||
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
    (!hasOwn(record, 'zoneOffset') ||
      !isZoneOffset(record.zoneOffset))
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
    !hasOnlyKeys(
      deletion,
      SOURCE_DELETION_KEYS,
      SOURCE_DELETION_REQUIRED_KEYS,
    ) ||
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
  if (
    !hasOwn(record, 'endTime') ||
    !isTimeRange(record.startTime, record.endTime)
  ) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    !hasOnlyKeys(
      record.payload,
      STEPS_PAYLOAD_KEYS,
      STEPS_PAYLOAD_REQUIRED_KEYS,
    ) ||
    !Number.isSafeInteger(record.payload.count) ||
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
    (!hasOwn(record, 'endTime') ||
      !isTimeRange(record.startTime, record.endTime))
  ) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    !hasOnlyKeys(
      record.payload,
      HEART_RATE_PAYLOAD_KEYS,
      HEART_RATE_PAYLOAD_REQUIRED_KEYS,
    ) ||
    !isDenseArray(record.payload.samples) ||
    record.payload.samples.length === 0 ||
    record.payload.samples.some(
      (sample) =>
        !isObject(sample) ||
        !hasOnlyKeys(
          sample,
          HEART_RATE_SAMPLE_KEYS,
          HEART_RATE_SAMPLE_REQUIRED_KEYS,
        ) ||
        !isInstant(sample.timestamp) ||
        !Number.isFinite(sample.beatsPerMinute) ||
        (sample.beatsPerMinute as number) <= 0 ||
        compareUtcInstants(sample.timestamp, record.startTime) < 0 ||
        (record.endTime !== undefined &&
          compareUtcInstants(sample.timestamp, record.endTime) > 0),
    )
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateSleep(record: Record<string, unknown>): ValidationResult {
  if (
    !hasOwn(record, 'endTime') ||
    !isTimeRange(record.startTime, record.endTime)
  ) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    !hasOnlyKeys(record.payload, SLEEP_PAYLOAD_KEYS)
  ) {
    return { valid: false, error: 'invalid-payload' };
  }
  const stages = record.payload.stages;
  if (stages === undefined) {
    return { valid: true };
  }
  if (!isDenseArray(stages)) {
    return { valid: false, error: 'invalid-payload' };
  }
  const stagesAreValid = stages.every(
    (stage) =>
      isObject(stage) &&
      hasOnlyKeys(
        stage,
        SLEEP_STAGE_KEYS,
        SLEEP_STAGE_REQUIRED_KEYS,
      ) &&
      SLEEP_STAGES.has(stage.stage) &&
      isTimeRange(stage.startTime, stage.endTime) &&
      compareUtcInstants(stage.startTime, record.startTime) >= 0 &&
      compareUtcInstants(stage.endTime, record.endTime) <= 0,
  );
  if (!stagesAreValid || sleepStagesOverlap(stages)) {
    return { valid: false, error: 'invalid-payload' };
  }
  return { valid: true };
}

function validateWorkout(
  record: Record<string, unknown>,
): ValidationResult {
  if (
    !hasOwn(record, 'endTime') ||
    !isTimeRange(record.startTime, record.endTime)
  ) {
    return { valid: false, error: 'invalid-time-range' };
  }
  if (
    !isObject(record.payload) ||
    !hasOnlyKeys(record.payload, WORKOUT_PAYLOAD_KEYS) ||
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
  if (typeof value !== 'string') {
    return false;
  }

  const match = UTC_INSTANT.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const millisecond = Number(
    (match[7] ?? '').padEnd(3, '0').slice(0, 3),
  );
  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(hour, minute, second, millisecond);

  return (
    Number.isFinite(instant.getTime()) &&
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() === month - 1 &&
    instant.getUTCDate() === day &&
    instant.getUTCHours() === hour &&
    instant.getUTCMinutes() === minute &&
    instant.getUTCSeconds() === second &&
    instant.getUTCMilliseconds() === millisecond
  );
}

function isOptionalInstant(value: unknown): boolean {
  return value === undefined || isInstant(value);
}

function isZoneOffset(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = ZONE_OFFSET.exec(value);
  if (!match) {
    return false;
  }

  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return hours < 18 || (hours === 18 && minutes === 0);
}

function isTimeRange(startTime: unknown, endTime: unknown): boolean {
  return (
    isInstant(startTime) &&
    isInstant(endTime) &&
    compareUtcInstants(startTime, endTime) <= 0
  );
}

function isValidDevice(device: unknown): boolean {
  return (
    device === undefined ||
    (isObject(device) &&
      hasOnlyKeys(device, DEVICE_KEYS) &&
      isOptionalNonEmpty(device.manufacturer) &&
      isOptionalNonEmpty(device.model))
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

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  requiredKeys: ReadonlySet<string> = new Set(),
): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.every(
      (key) =>
        typeof key === 'string' &&
        Object.prototype.propertyIsEnumerable.call(value, key) &&
        allowedKeys.has(key),
    ) &&
    [...requiredKeys].every((key) => hasOwn(value, key))
  );
}

function hasOwn(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      return false;
    }
  }
  return true;
}

function normalizeUtcInstant(value: string): string {
  return value.replace(
    /(?:\.(\d{1,9}))?Z$/,
    (_, fraction: string | undefined) =>
      `.${(fraction ?? '').padEnd(9, '0')}Z`,
  );
}

function compareUtcInstants(left: unknown, right: unknown): number {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return Number.NaN;
  }
  const normalizedLeft = normalizeUtcInstant(left);
  const normalizedRight = normalizeUtcInstant(right);
  if (normalizedLeft === normalizedRight) {
    return 0;
  }
  return normalizedLeft < normalizedRight ? -1 : 1;
}

function sleepStagesOverlap(stages: readonly unknown[]): boolean {
  const orderedStages = [...stages].sort((left, right) => {
    if (!isObject(left) || !isObject(right)) {
      return 0;
    }
    return compareUtcInstants(left.startTime, right.startTime);
  });

  for (let index = 1; index < orderedStages.length; index += 1) {
    const previousStage = orderedStages[index - 1];
    const currentStage = orderedStages[index];
    if (
      isObject(previousStage) &&
      isObject(currentStage) &&
      compareUtcInstants(
        previousStage.endTime,
        currentStage.startTime,
      ) > 0
    ) {
      return true;
    }
  }
  return false;
}
