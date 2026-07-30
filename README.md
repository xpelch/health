# Health

Health is an early local-first mobile application and reusable open-source
foundation for collecting health and activity data from supported watches.

The project is a digital public good: it aims to give people and developers a
transparent, portable alternative to applications whose data model and usage
depend on one device vendor.

> [!WARNING]
> This project is in its initial implementation phase. There are no
> production-ready builds or releases. Do not use it to make medical decisions.

## MVP

The first release will:

- run on iOS and Android;
- read steps, heart rate, sleep, and workouts;
- use HealthKit on iOS and Health Connect on Android;
- normalize and store records only on the phone;
- work without an account or network connection;
- keep sources, destinations, and future identity providers replaceable.

Remote storage, account authentication, background synchronization, direct
provider APIs, and writes to platform health stores are deferred.

## Compatibility

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

Compatibility is metric-specific. A device may expose steps but not sleep, for
example.

## Architecture

- Mobile application: React Native and TypeScript
- Native project generation: Expo Prebuild with development builds
- iOS health adapter: HealthKit through a native Swift module
- Android health adapter: Health Connect through a native Kotlin module
- Core: vendor-neutral records and synchronization rules
- Persistence: replaceable local record repository
- Extensions: optional provider, export, remote-destination, and identity
  adapters

The React Native application will own the user experience and synchronization
workflow. Small native adapters will isolate access to platform APIs that are
not available directly from TypeScript.

Permissions will be requested per data type and only when needed. Source
identity, timestamps, units, duplicate detection, deletion behavior, and
incremental synchronization must remain explicit throughout the data flow.

## Expected repository structure

Application directories will be added with their first working components:

```text
health/
├── VISION.md
├── mobile-app/
│   ├── src/
│   └── modules/
│       ├── healthkit/
│       └── health-connect/
├── docs/
│   ├── adr/
│   ├── architecture.md
│   ├── data-model.md
│   ├── extensibility.md
│   ├── privacy-and-security.md
│   ├── product-scope.md
│   └── synchronization.md
└── .github/
```

The first executable shell and vendor-neutral import core live in
[`mobile-app/`](mobile-app/). HealthKit, Health Connect, persistent storage, and
accounts are not implemented in Iteration 1.

## Development

The mobile application requires Node.js 22.13 or newer and npm:

```sh
cd mobile-app
npm ci
npm run typecheck
npm run lint
npm test
```

See the [mobile application guide](mobile-app/README.md) for development-build,
Prebuild, diagnostics, and run commands.

## Documentation

- [Project vision](VISION.md)
- [MVP product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Canonical data model](docs/data-model.md)
- [Synchronization](docs/synchronization.md)
- [Privacy and security](docs/privacy-and-security.md)
- [Extensibility](docs/extensibility.md)
- [ADR 0001: Mobile health aggregation](docs/adr/0001-mobile-health-aggregation.md)
- [ADR 0002: Vendor-neutral core](docs/adr/0002-vendor-neutral-core.md)

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
