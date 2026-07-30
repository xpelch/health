# ADR 0002: Vendor-Neutral Core

- Status: Accepted
- Date: 2026-07-30

## Context

Health is intended as a forkable public-good foundation. HealthKit, Health
Connect, identity providers, storage engines, and future provider APIs can
change independently and impose incompatible payloads or policies.

Allowing one external model to become the domain model would make forks and new
integrations depend on that vendor.

## Decision

Use a ports-and-adapters boundary around:

- health-data sources;
- canonical record persistence;
- export and remote destinations;
- optional identity providers.

The core owns canonical records, validation, source identity, synchronization
states, and checkpoint rules. It depends on no vendor SDK, UI framework,
database, transport, or identity provider.

The MVP uses HealthKit and Health Connect source adapters plus a local record
repository. Authentication is absent. Future authentication and remote
destinations remain optional adapters.

## Alternatives considered

### Use HealthKit or Health Connect records as the shared model

This reduces initial mapping work but couples the other platform and all future
destinations to one vendor schema. Rejected.

### Create one universal adapter interface for all external systems

Sources, repositories, destinations, and identity providers have different
failure and state semantics. Combining them would produce a vague contract.
Rejected.

### Build independent platform applications

This minimizes shared contracts but duplicates synchronization rules and makes
consistent export harder. Rejected for the shared foundation.

## Consequences

### Positive

- Provider changes remain local to adapters.
- Core tests run without native or network dependencies.
- Forks can replace storage, identity, and remote destinations.
- Canonical versioning makes export and reuse explicit.

### Negative

- Mapping loses provider fields that are outside the accepted canonical model.
- Contract design and migrations require governance.
- Adapters need shared conformance tests.
- Some capabilities will remain platform-specific and cannot be made uniform.

## Fitness checks

- No vendor payload types in core modules.
- At least two synthetic source adapters run the same sync contract tests.
- At least two conceptual destinations fit without source changes.
- Adding authentication does not change canonical record identifiers.
- Incompatible canonical changes require an ADR and schema-version increment.
