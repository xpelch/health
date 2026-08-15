# Health mobile application

This directory contains the executable Expo application and the vendor-neutral
TypeScript import core.

The current Android preview provides:

- a development-build-compatible application shell;
- canonical records for steps, heart rate, sleep, and workouts;
- source and repository ports used by the import service;
- a local Expo/Kotlin Health Connect adapter with read-only access;
- a foreground, user-triggered 30-day import into memory;
- in-memory adapters and synthetic fixtures for automated tests.

HealthKit, persistent storage, accounts, networking, background import, and
health-store writes are not implemented. Imported records disappear when the
application process ends.

## Requirements

- Node.js `22.13.0` or newer supported release;
- npm;
- Android Studio for a local Android development build;
- macOS and Xcode for a local iOS development build.

Expo Go is not the intended runtime. The application includes
`expo-dev-client` and uses Expo Prebuild with Continuous Native Generation.
Generated `android/` and `ios/` directories remain local and are not committed.

## Install

```sh
npm ci
```

## Run

Create and launch a local development build:

```sh
npm run android
```

On macOS:

```sh
npm run ios
```

After a development build is installed, start Metro for the development client:

```sh
npm start
```

Generate native projects without committing them:

```sh
npm run prebuild
```

## Validate

```sh
npm run lint
npm run typecheck
npm test
npm run doctor
npm run export:android
```

Tests use obviously fictional records and run in Node.js without React Native,
native health APIs, an account, or a network service.

See the [Health Connect guide](../docs/health-connect.md) for permissions,
Samsung Health setup, device verification, and Play Console requirements.
