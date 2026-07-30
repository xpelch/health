# ADR 0001: Mobile Health Aggregation

- Status: Accepted
- Date: 2026-07-30

## Context

The project needs to collect steps, heart rate, sleep, and workouts from
different watches. Installing and maintaining an application on every watch
platform would not cover devices whose data is available only through a phone
companion or provider ecosystem.

The MVP must work without an account, backend, or network connection and retain
data on the phone.

## Decision

Build one React Native mobile application for iOS and Android.

- Use HealthKit as the first iOS source.
- Use Health Connect as the first Android source.
- Access both through typed native adapters implemented in Swift and Kotlin.
- Use Expo Prebuild and development builds so required native capabilities and
  configuration are available.
- Normalize records before they enter local persistence.
- Perform foreground, resumable, read-only synchronization in the MVP.
- Add provider-cloud sources only through later official adapters.

## Alternatives considered

### Native watch applications

Direct watch applications can offer device-specific experiences but multiply
platform work and do not solve access for every vendor. Rejected as the
aggregation foundation.

### Fully native iOS and Android phone applications

This gives maximum platform control but duplicates most application workflow
and UI work. It remains a fallback if React Native native boundaries prove
unreliable, but it is not justified before that evidence exists.

### Direct provider APIs first

Provider APIs can fill platform-store gaps but introduce approvals, licensing,
account flows, network dependencies, and inconsistent schemas. Deferred until
a confirmed compatibility gap requires one.

## Consequences

### Positive

- One shared application workflow and UI codebase.
- Local operation without an account or backend.
- Platform API complexity remains isolated in native adapters.
- New providers can be added without changing the canonical model.

### Negative

- Swift and Kotlin expertise is still required.
- Expo Go cannot represent the production native runtime.
- Platform stores expose only data that devices or companion apps publish.
- Physical-device testing is required for permissions and background behavior.

## Follow-up

- Select native integration libraries only after a separate evaluation.
- Define local retention, supported OS versions, storage, and encryption.
- Validate one metric end to end on each physical platform before expanding to
  all four.

## Official references

- [HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Health Connect](https://developer.android.com/health-and-fitness/health-connect)
- [React Native native modules](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
