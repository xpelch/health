import HealthConnectModule from '../../modules/health-connect';
import type { MetricType } from '../core/healthRecords';
import type {
  HealthConnectGateway,
  HealthConnectSdkStatus,
  NativeHealthConnectPage,
} from './healthConnectGateway';

class NativeHealthConnectGateway implements HealthConnectGateway {
  async getSdkStatus(): Promise<HealthConnectSdkStatus> {
    if (!HealthConnectModule) {
      return 'unavailable';
    }
    return HealthConnectModule.getSdkStatusAsync();
  }

  async getGrantedMetrics(): Promise<readonly MetricType[]> {
    if (!HealthConnectModule) {
      return [];
    }
    return HealthConnectModule.getGrantedMetricsAsync();
  }

  async requestPermissions(
    metrics: readonly MetricType[],
  ): Promise<readonly MetricType[]> {
    if (!HealthConnectModule) {
      return [];
    }
    return HealthConnectModule.requestPermissionsAsync([...metrics]);
  }

  async readRecords(
    metricType: MetricType,
    startTime: string,
    endTime: string,
    pageToken: string | null,
    pageSize: number,
  ): Promise<NativeHealthConnectPage> {
    if (!HealthConnectModule) {
      throw new Error('Health Connect is unavailable.');
    }
    return HealthConnectModule.readRecordsAsync(
      metricType,
      startTime,
      endTime,
      pageToken,
      pageSize,
    );
  }

  openSettings(): void {
    HealthConnectModule?.openSettings();
  }
}

export const nativeHealthConnectGateway: HealthConnectGateway =
  new NativeHealthConnectGateway();
