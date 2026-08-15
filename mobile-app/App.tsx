import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HealthConnectPanel } from './src/healthConnect/HealthConnectPanel';

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

        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Android health source
          </Text>
          <View style={styles.healthConnectPanel}>
            <HealthConnectPanel />
          </View>
        </View>

        <View style={styles.localFirst}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Local first
          </Text>
          <Text style={styles.bodyText}>
            The initial application works without an account or backend. Health
            data will remain on this phone unless you explicitly choose a future
            export destination.
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
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#193A2E',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
  },
  healthConnectPanel: {
    marginTop: 16,
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
