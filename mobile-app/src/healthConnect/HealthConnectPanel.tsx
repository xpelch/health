import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ALL_METRIC_TYPES,
  type MetricType,
} from '../core/healthRecords';
import { importMetric, type ImportResult } from '../core/importHealthData';
import { InMemoryRecordRepository } from '../testing/inMemoryAdapters';
import type { HealthConnectSdkStatus } from './healthConnectGateway';
import { HealthConnectSource } from './healthConnectSource';
import { nativeHealthConnectGateway } from './nativeHealthConnectGateway';

const METRICS: readonly MetricType[] = ALL_METRIC_TYPES;

const METRIC_LABELS: Record<MetricType, string> = {
  steps: 'Steps',
  heartRate: 'Heart rate',
  sleep: 'Sleep',
  workout: 'Workouts',
};

type OperationState =
  | 'idle'
  | 'requesting'
  | 'importing'
  | 'complete'
  | 'partial'
  | 'failed';

export function HealthConnectPanel() {
  const repository = useMemo(() => new InMemoryRecordRepository(), []);
  const source = useMemo(
    () => new HealthConnectSource(nativeHealthConnectGateway),
    [],
  );
  const [sdkStatus, setSdkStatus] = useState<
    HealthConnectSdkStatus | 'checking'
  >('checking');
  const [grantedMetrics, setGrantedMetrics] = useState<
    readonly MetricType[]
  >([]);
  const [operation, setOperation] =
    useState<OperationState>('idle');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [counts, setCounts] = useState<Record<MetricType, number>>({
    steps: 0,
    heartRate: 0,
    sleep: 0,
    workout: 0,
  });
  const [origins, setOrigins] = useState<readonly string[]>([]);
  const [lastImportedAt, setLastImportedAt] = useState<string | null>(
    null,
  );

  const refreshAccess = useCallback(async () => {
    try {
      const status = await nativeHealthConnectGateway.getSdkStatus();
      setSdkStatus(status);
      if (status !== 'available') {
        setGrantedMetrics([]);
        return;
      }
      setGrantedMetrics(
        await nativeHealthConnectGateway.getGrantedMetrics(),
      );
    } catch {
      setSdkStatus('unavailable');
      setGrantedMetrics([]);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(() => {
      void refreshAccess();
    }, 0);
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (state === 'active') {
          void refreshAccess();
        }
      },
    );
    return () => {
      clearTimeout(initialRefresh);
      subscription.remove();
    };
  }, [refreshAccess]);

  const refreshSummaries = useCallback(async () => {
    const entries = await Promise.all(
      METRICS.map(async (metricType) => {
        const records = await repository.findByMetric(metricType);
        return [metricType, records] as const;
      }),
    );
    const nextCounts: Record<MetricType, number> = {
      steps: 0,
      heartRate: 0,
      sleep: 0,
      workout: 0,
    };
    const nextOrigins = new Set<string>();
    for (const [metricType, records] of entries) {
      nextCounts[metricType] = records.length;
      for (const record of records) {
        if (record.source.originId) {
          nextOrigins.add(record.source.originId);
        }
      }
    }
    setCounts(nextCounts);
    setOrigins([...nextOrigins].sort());
  }, [repository]);

  const importGrantedMetrics = useCallback(
    async (metrics: readonly MetricType[]) => {
      if (!syncEnabled || metrics.length === 0) {
        return;
      }
      setOperation('importing');
      const results = await Promise.all(
        metrics.map((metricType) =>
          importMetric({
            source,
            metricType,
            repository,
          }),
        ),
      );
      await refreshSummaries();
      setLastImportedAt(new Date().toISOString());
      setOperation(summarizeResults(results));
    },
    [refreshSummaries, repository, source, syncEnabled],
  );

  const connect = useCallback(async () => {
    setOperation('requesting');
    try {
      const granted =
        await nativeHealthConnectGateway.requestPermissions(METRICS);
      setGrantedMetrics(granted);
      setOperation('idle');
      await importGrantedMetrics(granted);
    } catch {
      setOperation('failed');
      await refreshAccess();
    }
  }, [importGrantedMetrics, refreshAccess]);

  const refresh = useCallback(async () => {
    await refreshAccess();
    try {
      const granted =
        await nativeHealthConnectGateway.getGrantedMetrics();
      setGrantedMetrics(granted);
      await importGrantedMetrics(granted);
    } catch {
      setOperation('failed');
    }
  }, [importGrantedMetrics, refreshAccess]);

  const allMetricsGranted = METRICS.every((metric) =>
    grantedMetrics.includes(metric),
  );
  const status = describeStatus(
    sdkStatus,
    operation,
    grantedMetrics.length,
    allMetricsGranted,
    syncEnabled,
  );
  const isBusy =
    operation === 'requesting' || operation === 'importing';

  return (
    <View style={styles.panel}>
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: status.color },
          ]}
        />
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>{status.title}</Text>
          <Text style={styles.statusDescription}>
            {status.description}
          </Text>
        </View>
      </View>

      <Text style={styles.consentText}>
        Health reads only the categories you approve. Data stays on this
        phone and is never written back to Health Connect.
      </Text>

      <View style={styles.metricList}>
        {METRICS.map((metric) => {
          const granted = grantedMetrics.includes(metric);
          return (
            <View
              key={metric}
              style={[
                styles.metric,
                granted && styles.metricGranted,
              ]}
            >
              <Text style={styles.metricText}>
                {METRIC_LABELS[metric]}
              </Text>
              <Text style={styles.metricState}>
                {granted ? 'Allowed' : 'Not allowed'}
              </Text>
            </View>
          );
        })}
      </View>

      {sdkStatus === 'available' ? (
        <View style={styles.actions}>
          {grantedMetrics.length === 0 ? (
            <ActionButton
              label={
                operation === 'requesting'
                  ? 'Opening Health Connect…'
                  : 'Connect Health Connect'
              }
              onPress={() => void connect()}
              disabled={isBusy}
              primary
            />
          ) : (
            <ActionButton
              label={
                operation === 'importing' ? 'Importing…' : 'Refresh'
              }
              onPress={() => void refresh()}
              disabled={isBusy || !syncEnabled}
              primary
            />
          )}
          {grantedMetrics.length > 0 && !allMetricsGranted ? (
            <ActionButton
              label="Review permissions"
              onPress={() => void connect()}
              disabled={isBusy}
            />
          ) : null}
          <ActionButton
            label="Manage access"
            onPress={() => nativeHealthConnectGateway.openSettings()}
            disabled={isBusy}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: syncEnabled }}
        disabled={isBusy || sdkStatus !== 'available'}
        onPress={() => setSyncEnabled((enabled) => !enabled)}
        style={styles.syncToggle}
      >
        <View
          style={[
            styles.checkbox,
            syncEnabled && styles.checkboxEnabled,
          ]}
        />
        <View style={styles.syncCopy}>
          <Text style={styles.syncTitle}>Sync with Health Connect</Text>
          <Text style={styles.syncDescription}>
            Turn this off to pause all reads without changing system
            permissions.
          </Text>
        </View>
      </Pressable>

      {lastImportedAt ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Session import</Text>
          <Text style={styles.sessionWarning}>
            Preview only — imported records are cleared when the app
            restarts.
          </Text>
          <View style={styles.countGrid}>
            {METRICS.map((metric) => (
              <View key={metric} style={styles.countItem}>
                <Text style={styles.count}>{counts[metric]}</Text>
                <Text style={styles.countLabel}>
                  {METRIC_LABELS[metric]}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.summaryMeta}>
            Last import: {new Date(lastImportedAt).toLocaleString()}
          </Text>
          <Text style={styles.summaryMeta}>
            Origins: {origins.length ? origins.join(', ') : 'None found'}
          </Text>
        </View>
      ) : null}

      <View style={styles.samsungHelp}>
        <Text style={styles.helpTitle}>Using a Galaxy Watch?</Text>
        <Text style={styles.helpText}>
          In Samsung Health, enable Health Connect and allow Samsung
          Health to share steps, heart rate, sleep, and workouts. Health
          reads the phone’s Health Connect store, not the watch directly.
        </Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        primary ? styles.primaryButton : styles.secondaryButton,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={
          primary ? styles.primaryButtonText : styles.secondaryButtonText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function summarizeResults(results: readonly ImportResult[]): OperationState {
  if (results.every((result) => result.status === 'complete')) {
    return 'complete';
  }
  if (
    results.some(
      (result) =>
        result.status === 'complete' || result.status === 'partial',
    )
  ) {
    return 'partial';
  }
  return 'failed';
}

function describeStatus(
  sdkStatus: HealthConnectSdkStatus | 'checking',
  operation: OperationState,
  grantedCount: number,
  allMetricsGranted: boolean,
  syncEnabled: boolean,
) {
  if (sdkStatus === 'checking') {
    return {
      title: 'Checking Health Connect',
      description: 'Confirming availability on this Android device.',
      color: '#6E7E77',
    };
  }
  if (sdkStatus === 'unavailable') {
    return {
      title: 'Health Connect unavailable',
      description:
        'Health Connect requires a supported Android phone with Google Play services.',
      color: '#9A4A35',
    };
  }
  if (sdkStatus === 'update-required') {
    return {
      title: 'Health Connect update required',
      description:
        'Update the Health Connect provider before connecting this app.',
      color: '#9A4A35',
    };
  }
  if (!syncEnabled) {
    return {
      title: 'Health Connect paused',
      description:
        'No health data will be read until synchronization is resumed.',
      color: '#786A35',
    };
  }
  if (operation === 'requesting') {
    return {
      title: 'Choose what to share',
      description:
        'Health Connect is opening its system permission screen.',
      color: '#2C6D57',
    };
  }
  if (operation === 'importing') {
    return {
      title: 'Importing from Health Connect',
      description:
        'Reading an authorized, bounded 30-day snapshot on this phone.',
      color: '#2C6D57',
    };
  }
  if (operation === 'failed') {
    return {
      title: 'Import could not finish',
      description:
        'Your existing session data was preserved. Check access and try again.',
      color: '#9A4A35',
    };
  }
  if (operation === 'partial') {
    return {
      title: 'Import partially completed',
      description:
        'Some authorized categories imported; another category needs attention.',
      color: '#786A35',
    };
  }
  if (operation === 'complete') {
    return {
      title: 'Health Connect import complete',
      description:
        'The authorized 30-day snapshot is available for this session.',
      color: '#2C6D57',
    };
  }
  if (grantedCount === 0) {
    return {
      title: 'Health Connect not connected',
      description:
        'Connect to choose access for steps, heart rate, sleep, and workouts.',
      color: '#9A4A35',
    };
  }
  if (!allMetricsGranted) {
    return {
      title: 'Health Connect partially connected',
      description:
        'Allowed categories can import independently from categories you declined.',
      color: '#786A35',
    };
  }
  return {
    title: 'Health Connect connected',
    description: 'All four categories are available for a manual refresh.',
    color: '#2C6D57',
  };
}

const styles = StyleSheet.create({
  panel: {
    gap: 24,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#BDD0C8',
  },
  statusIndicator: {
    width: 12,
    height: 12,
    marginTop: 5,
    borderRadius: 6,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    color: '#193A2E',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  statusDescription: {
    marginTop: 6,
    color: '#48645A',
    fontSize: 16,
    lineHeight: 24,
  },
  consentText: {
    color: '#48645A',
    fontSize: 15,
    lineHeight: 23,
  },
  metricList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    minWidth: 130,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C4D3CD',
    borderRadius: 12,
    backgroundColor: '#EDF2EF',
  },
  metricGranted: {
    borderColor: '#75A28F',
    backgroundColor: '#E2EFE9',
  },
  metricText: {
    color: '#23483A',
    fontSize: 15,
    fontWeight: '600',
  },
  metricState: {
    marginTop: 3,
    color: '#5A7067',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  primaryButton: {
    backgroundColor: '#1F5B46',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#78978A',
    backgroundColor: '#F4F7F5',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#23483A',
    fontSize: 15,
    fontWeight: '700',
  },
  syncToggle: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 2,
    borderWidth: 2,
    borderColor: '#78978A',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  checkboxEnabled: {
    borderWidth: 6,
    borderColor: '#1F5B46',
    backgroundColor: '#FFFFFF',
  },
  syncCopy: {
    flex: 1,
  },
  syncTitle: {
    color: '#193A2E',
    fontSize: 16,
    fontWeight: '600',
  },
  syncDescription: {
    marginTop: 3,
    color: '#5A7067',
    fontSize: 14,
    lineHeight: 21,
  },
  summary: {
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#E8F0EC',
  },
  summaryTitle: {
    color: '#193A2E',
    fontSize: 18,
    fontWeight: '700',
  },
  sessionWarning: {
    marginTop: 5,
    color: '#672F20',
    fontSize: 14,
    lineHeight: 21,
  },
  countGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 18,
  },
  countItem: {
    minWidth: 90,
  },
  count: {
    color: '#16372B',
    fontSize: 26,
    fontWeight: '700',
  },
  countLabel: {
    color: '#48645A',
    fontSize: 13,
  },
  summaryMeta: {
    marginTop: 10,
    color: '#48645A',
    fontSize: 13,
    lineHeight: 19,
  },
  samsungHelp: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderColor: '#BDD0C8',
  },
  helpTitle: {
    color: '#193A2E',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    marginTop: 6,
    color: '#48645A',
    fontSize: 14,
    lineHeight: 22,
  },
});
