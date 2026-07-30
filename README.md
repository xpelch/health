# Health

Health is a planned open-source mobile application that brings health and
fitness data from supported watches into one place. The application will run on
iOS and Android and synchronize through the health data sources available on
the user's phone.

> [!WARNING]
> This project is in its initial planning phase. There are no production-ready
> builds or releases. Do not use it to make medical decisions.

## Compatibility approach

Health will integrate with platform health stores first:

- HealthKit on iOS;
- Health Connect on Android.

These stores can provide data written by a compatible watch or its companion
application after the user grants access. Optional provider integrations may be
added when a device does not expose the required data through a platform store
and its provider offers a suitable official API.

The project does not claim direct compatibility with every watch. A device is
supported only when its data is available through HealthKit, Health Connect, or
an explicitly implemented provider integration. Proprietary devices without an
accessible integration cannot be supported.

## Planned architecture

- Mobile application: React Native and TypeScript
- Native project generation: Expo Prebuild with development builds
- iOS health adapter: HealthKit through a native Swift module
- Android health adapter: Health Connect through a native Kotlin module
- Optional provider adapters: official account-based APIs where required
- Backend: ASP.NET Core with a documented API
- Shared contracts: explicit schemas for normalized health records

The React Native application will own the user experience and synchronization
workflow. Small native adapters will isolate access to platform APIs that are
not available directly from TypeScript. The backend, if required by the product
scope, will receive normalized records rather than provider-specific payloads.

Permissions will be requested per data type and only when needed. Source
identity, timestamps, units, duplicate detection, deletion behavior, and
incremental synchronization must remain explicit throughout the data flow.

The initial health metrics, retention rules, and server-side synchronization
requirements have not yet been defined. They must be decided before the first
end-to-end implementation.

## Expected repository structure

The likely structure is shown below for orientation:

```text
health/
├── mobile-app/
│   ├── src/
│   └── modules/
│       ├── healthkit/
│       └── health-connect/
├── backend/
├── contracts/
├── docs/
└── .github/
```

These directories will be added with their first working components rather
than as empty placeholders. Build and test instructions will be documented once
an implementation exists.

## Contributing

Issues and focused pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) before contributing and follow the
[Code of Conduct](CODE_OF_CONDUCT.md) in all project spaces.

Report suspected vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

Signing certificates, store credentials, production secrets, private
infrastructure configuration, provider credentials, and user health data are
not part of this open-source repository.

## License

Licensed under the [Apache License 2.0](LICENSE).
