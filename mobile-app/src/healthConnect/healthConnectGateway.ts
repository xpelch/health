import type { MetricType } from '../core/healthRecords';
import type {
  HealthConnectSdkStatus,
  NativeHealthConnectPage,
} from '../../modules/health-connect';

export type { HealthConnectSdkStatus, NativeHealthConnectPage };

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
