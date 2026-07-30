import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const METRICS = ['Steps', 'Heart rate', 'Sleep', 'Workouts'] as const;

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Health
          </Text>
          <Text style={styles.subtitle}>
            A local-first foundation for your health data.
          </Text>
        </View>

        <View style={styles.connectionStatus}>
          <View style={styles.statusIndicator} />
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>No health source connected</Text>
            <Text style={styles.statusDescription}>
              Health is ready for a future source adapter. Nothing is being
              imported or transmitted.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Planned metrics
          </Text>
          <View style={styles.metricList}>
            {METRICS.map((metric) => (
              <View key={metric} style={styles.metric}>
                <Text style={styles.metricText}>{metric}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.localFirst}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Local first
          </Text>
          <Text style={styles.bodyText}>
            The initial application works without an account or backend. Health
            data will remain on this phone unless you explicitly choose a
            future export destination.
          </Text>
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Not for medical decisions</Text>
          <Text style={styles.warningText}>
            Health does not diagnose conditions or provide treatment advice.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7F5',
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    color: '#16372B',
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 46,
  },
  subtitle: {
    maxWidth: 420,
    marginTop: 10,
    color: '#39574C',
    fontSize: 18,
    lineHeight: 27,
  },
  connectionStatus: {
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
    backgroundColor: '#9A4A35',
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
    maxWidth: 520,
    marginTop: 6,
    color: '#48645A',
    fontSize: 16,
    lineHeight: 24,
  },
  section: {
    marginTop: 40,
  },
  sectionTitle: {
    color: '#193A2E',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  metricList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  metric: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#9CB7AC',
    borderRadius: 20,
    backgroundColor: '#E8F0EC',
  },
  metricText: {
    color: '#23483A',
    fontSize: 15,
    fontWeight: '600',
  },
  localFirst: {
    marginTop: 40,
  },
  bodyText: {
    maxWidth: 560,
    marginTop: 10,
    color: '#48645A',
    fontSize: 16,
    lineHeight: 25,
  },
  warning: {
    marginTop: 40,
    padding: 20,
    borderRadius: 14,
    backgroundColor: '#F5E8E3',
  },
  warningTitle: {
    color: '#672F20',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
  },
  warningText: {
    marginTop: 5,
    color: '#723B2C',
    fontSize: 15,
    lineHeight: 23,
  },
});
