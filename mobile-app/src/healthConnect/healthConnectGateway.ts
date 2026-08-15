import type { MetricType } from '../core/healthRecords';

export type HealthConnectSdkStatus =
  | 'available'
  | 'update-required'
  | 'unavailable';

export interface NativeHealthConnectPage {
  records: unknown;
  pageToken: unknown;
}

export interface HealthConnectGateway {
  getSdkStatus(): Promise<HealthConnectSdkStatus>;
  getGrantedMetrics(): Promise<readonly MetricType[]>;
  requestPermissions(
    metrics: readonly MetricType[],
  ): Promise<readonly MetricType[]>;
  readRecords(
    metricType: MetricType,
    startTime: string,
    endTime: string,
    pageToken: string | null,
    pageSize: number,
  ): Promise<NativeHealthConnectPage>;
  openSettings(): void;
}
