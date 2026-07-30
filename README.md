# Health

Health is a planned open-source smartwatch application for Wear OS and
watchOS. It aims to provide native experiences on each platform while sharing
business logic where that improves maintainability.

> [!WARNING]
> This project is in its initial planning phase. There are no production-ready
> builds or releases. Do not use it to make medical decisions.

## Planned architecture

- Shared business logic: Kotlin Multiplatform
- Wear OS application: Kotlin and Compose for Wear OS
- watchOS application: Swift and SwiftUI
- Backend integration: a documented HTTP or WebSocket API

Platform-specific behavior such as sensors, permissions, background execution,
tiles, complications, and Digital Crown interactions will remain in the native
applications.

The exact product requirements and health features have not been defined.
Architecture decisions will be documented as implementation begins.

## Expected repository structure

The likely structure is shown below for orientation:

```text
health/
├── shared/
├── wearos-app/
├── watchos-app/
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
infrastructure configuration, and user data are not part of this open-source
repository.

## License

Licensed under the [Apache License 2.0](LICENSE).
