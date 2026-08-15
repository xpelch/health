import { requireOptionalNativeModule } from 'expo-modules-core';

export type HealthMetric = 'steps' | 'heartRate' | 'sleep' | 'workout';

export type HealthConnectSdkStatus =
  | 'available'
  | 'update-required'
  | 'unavailable';

export interface NativeHealthConnectPage {
  records: unknown[];
  pageToken: string | null;
}

interface HealthConnectNativeModule {
  getSdkStatusAsync(): Promise<HealthConnectSdkStatus>;
  getGrantedMetricsAsync(): Promise<HealthMetric[]>;
  requestPermissionsAsync(metrics: HealthMetric[]): Promise<HealthMetric[]>;
  readRecordsAsync(
    metric: HealthMetric,
    startTime: string,
    endTime: string,
    pageToken: string | null,
    pageSize: number,
  ): Promise<NativeHealthConnectPage>;
  openSettings(): void;
}

export default requireOptionalNativeModule<HealthConnectNativeModule>(
  'HealthConnect',
);
