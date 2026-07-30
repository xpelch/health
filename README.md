# Health

Health is an open-source smartwatch application planned for Wear OS and
watchOS.

The project is currently in its initial planning phase. The goal is to provide
native watch experiences while sharing business logic where doing so keeps the
code simple and maintainable.

## Planned architecture

- Shared business logic: Kotlin Multiplatform
- Wear OS application: Kotlin and Compose for Wear OS
- watchOS application: Swift and SwiftUI
- Backend integration: documented HTTP or WebSocket APIs
- Continuous integration: GitHub Actions

Platform-specific behavior such as sensors, permissions, background execution,
tiles, complications, and Digital Crown interactions will remain in the native
applications.

## Repository structure

The repository is intentionally small while the first requirements are being
defined. The expected structure is:

```text
health/
├── shared/
├── wearos-app/
├── watchos-app/
├── docs/
└── .github/
```

Directories will be added only when their first working component is
implemented.

## Contributing

Issues and pull requests are welcome. Contribution guidelines, build
instructions, and automated checks will be added with the first implementation.

Do not commit signing certificates, store credentials, API secrets, production
configuration, or user data.

## License

Licensed under the [Apache License 2.0](LICENSE).
