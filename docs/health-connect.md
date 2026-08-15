# Android Health Connect preview

The Android preview imports steps, heart-rate samples, sleep sessions, and
exercise sessions from Health Connect. It requests read access only. Every
refresh is a foreground, paginated snapshot of the previous 30 days and stores
normalized records in memory for the current application session.

## Connect a Pixel

1. Install and open the development build on Android 9 or newer.
2. Select **Connect Health Connect**.
3. Grant any combination of the four requested data categories. Denied
   categories remain disabled without blocking granted ones.
4. Select **Refresh** to import the available records.
5. Use **Manage access** to review or revoke permissions in Health Connect.

An empty import can be valid: the selected category may contain no records in
the 30-day window. Health values and permission decisions are never written to
application logs.

## Use Samsung Health as the watch bridge

For a Samsung watch, pair the watch with Samsung Health on the phone and confirm
that the expected records appear in Samsung Health. In Samsung Health, enable
its Health Connect integration and allow it to write the desired categories.
Then grant this application read access in Health Connect and refresh.

Compatibility is category-specific. Samsung Health or the watch may not publish
every category to Health Connect, and records already in Samsung Health may
need a new synchronization before they appear.

This project does not connect directly to watches, Bluetooth devices, Google
Fit, or Samsung's proprietary SDK.

## Local Android verification

```sh
cd mobile-app
npm ci
npm run prebuild
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

In PowerShell, use `.\gradlew.bat assembleDebug` instead of `./gradlew`.

## Publishing requirements

Before a Play release, maintainers must provide a public privacy-policy URL,
complete the Play Console health-app and Health Connect data-type declarations,
and keep the declared access aligned with the four read permissions in the
manifest. The permission-rationale activity is included for Health Connect's
access-management flow; its user-facing copy must remain consistent with the
published privacy policy.
