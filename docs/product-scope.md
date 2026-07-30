# MVP Product Scope

Status: Accepted for architecture planning

## Outcome

The MVP proves that one mobile application can import, normalize, and retain
selected health records from the phone's platform health store without an
account or remote backend.

The first vertical path is:

1. explain why a data category is needed;
2. request read permission from the platform;
3. import available records;
4. normalize and validate them;
5. store them locally;
6. show the user whether the import succeeded, partially succeeded, or needs
   attention.

The presentation of trends or health insights is not defined by this scope.

## Included

- iOS and Android mobile applications built from one React Native codebase;
- native adapters for HealthKit and Health Connect;
- read-only access to steps, heart rate, sleep, and workouts;
- local on-phone persistence;
- foreground synchronization that can resume after interruption;
- record provenance, units, timestamps, source identifiers, and deletion
  handling;
- an extension model for new sources, destinations, and identity providers;
- a path to export normalized records through a future destination adapter.

## Deferred

- background synchronization;
- direct provider integrations such as Garmin, Fitbit, Polar, or Withings;
- remote or self-hosted destinations;
- account creation and authentication;
- cross-device synchronization;
- a finalized export format;
- analytics, recommendations, coaching, or research workflows;
- writes back to HealthKit or Health Connect.

Deferred items require their own product decision and, where applicable,
verification of provider access and licensing.

## Excluded

- direct Bluetooth integrations based on undocumented protocols;
- watchOS or Wear OS applications;
- clinical records;
- diagnosis, treatment recommendations, or medical-device claims;
- guaranteed compatibility with every watch;
- automatic merging of records from unrelated sources when equivalence cannot
  be proven.

## Compatibility definition

A watch is compatible when its data reaches HealthKit or Health Connect in a
form the MVP supports. A future official provider adapter may add compatibility
when a platform health store is insufficient.

Compatibility is evaluated per metric, not only per device. A watch may expose
steps but not sleep, for example. The user interface and documentation must
report that distinction.

## MVP metrics

| Metric | Canonical shape | Initial access |
| --- | --- | --- |
| Steps | Count over a time interval | Read only |
| Heart rate | Beats-per-minute samples over time | Read only |
| Sleep | Session interval with optional stages | Read only |
| Workout | Activity session interval and source metadata | Read only |

Platform adapters may expose richer fields. The MVP retains only fields defined
by the canonical model and required provenance.

## No-account decision

The MVP has one local owner context and no sign-in screen. Core records do not
depend on a Google, Apple, or application account identifier.

Future authentication must enter through an identity adapter. Adding an
identity provider must not change source adapters, canonical records, or the
local synchronization workflow.

## Acceptance criteria

- Denying one metric permission does not block authorized metrics.
- Re-running an import does not create duplicate source records.
- An interrupted import resumes without discarding committed records.
- Source deletions are reflected locally when the platform reports them.
- No health record or provider token is transmitted off-device.
- The application remains usable without an account or network connection.
- A second source adapter can be added without changing synchronization rules.

## Decisions still required before implementation

- local retention duration and user-facing deletion behavior;
- initial import window for each metric;
- countries and app stores for the first release;
- first export format;
- minimum supported iOS and Android versions;
- exact on-device database and encryption approach.
