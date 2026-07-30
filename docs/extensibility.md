# Extensibility

## Goal

A fork should be able to add a health-data source, local or remote destination,
identity provider, or client experience without changing canonical
synchronization rules.

Extensibility is provided through small contracts around known variation
points. It is not a plugin marketplace or a promise to support arbitrary future
behavior.

## Extension boundaries

| Extension | Input | Output |
| --- | --- | --- |
| Source adapter | Permission state and checkpoint | Canonical changes and next checkpoint |
| Record repository | Canonical operations | Atomic commit result |
| Destination adapter | Canonical records and deletions | Destination checkpoint and status |
| Identity adapter | User-initiated sign-in request | Opaque authenticated context |
| Client application | Core queries and commands | A specialized user experience |

## Source adapters

The MVP defines two source adapters:

- HealthKit;
- Health Connect.

A future provider adapter must document:

- official API and access approval;
- supported metrics and source granularity;
- permission or OAuth scopes;
- pagination and incremental cursor behavior;
- update and deletion semantics;
- rate limits and retry expectations;
- stable source identifiers;
- unit and time mappings;
- licensing and redistribution constraints;
- test strategy without committing real health data.

An adapter maps at the boundary. Provider payload types and credentials never
enter the core.

## Destinations

The MVP has one destination in the broad architectural sense: the local record
repository. A second conceptual destination is a user-initiated file export.
Future remote or self-hosted destinations use the same canonical records.

A destination owns:

- its transport and credentials;
- its checkpoint;
- retry and conflict behavior;
- deletion propagation;
- serialization of a versioned canonical contract.

It does not own source permissions or provider-specific mapping.

## Identity providers

Identity is optional. A destination that requires a remote account requests an
identity adapter; local storage does not.

The identity contract exposes the smallest useful result:

- authenticated or unauthenticated state;
- opaque local account reference;
- required reauthentication state;
- explicit sign-out.

Google, Apple, OpenID Connect, passkeys, and custom deployments may require
different native or web flows. Those differences remain inside adapters. The
core does not branch on provider name.

## Reusable core

The aggregation core should be independently testable and should not import UI,
React Native, native-platform, storage, transport, or authentication packages.
It contains:

- canonical record definitions;
- validation and normalization results;
- synchronization commands and states;
- source identity and checkpoint rules;
- destination-neutral export contracts.

The initial mobile application consumes this core. A research tool, accessibility
client, personal dashboard, or specialized fork can reuse it with different
adapters and presentation.

## Contract evolution

- Version serialized canonical records.
- Keep source and destination checkpoints opaque to the core.
- Add optional canonical fields compatibly.
- Record incompatible changes in an ADR and increment the schema version.
- Provide migration before removing a stored field.
- Do not expand a shared contract solely for one provider convenience.

## Adapter acceptance checks

An adapter is ready when:

- contract tests pass using synthetic, non-personal fixtures;
- denial, revocation, paging, retry, update, and deletion paths are covered;
- it introduces no provider types into the core;
- logs contain no record payloads or tokens;
- its permissions and external constraints are documented;
- removing it leaves other adapters and core tests functional.
