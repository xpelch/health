# Synchronization

## Scope

The MVP synchronizes authorized records from HealthKit or Health Connect into a
local canonical repository. It performs no remote synchronization and writes
nothing back to the platform health stores.

## Import pipeline

Each source and metric follows the same application workflow:

1. Confirm that the platform source is available.
2. Read the authorization context that the platform exposes.
3. Load the last committed checkpoint.
4. Request one bounded page or change batch.
5. Map records and deletions to canonical operations.
6. Validate identifiers, time ranges, values, and units.
7. Atomically store the operations and next checkpoint.
8. Repeat until the source reports no remaining page.
9. Report complete, partial, authorization-required, interrupted, or failed
   status without inventing a permission state the platform withholds.

Records and their checkpoint commit together. Advancing a checkpoint before
records are durable can silently lose data.

## Checkpoint isolation

Maintain a checkpoint for each combination:

```text
(source adapter, metric type, local owner context)
```

One metric can then fail or lose permission without invalidating other metrics.
This also follows Health Connect guidance to use separate change tokens for
independently consumed data types:

- [Synchronize Health Connect data](https://developer.android.com/health-and-fitness/health-connect/sync-data)

## HealthKit adapter

HealthKit requires authorization for each data type. The application cannot
assume that one permission decision applies to all four metrics:

- [Authorizing access to health data](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)

For read access, HealthKit does not tell an application whether the user denied
a specific type. An empty query can mean either no data or no read access. The
adapter and UI must preserve that ambiguity instead of labeling an empty result
as denied.

The adapter should use anchored queries for incremental changes. Observer
queries can notify the application that matching samples were added or removed,
but they do not replace the durable anchor:

- [HealthKit queries](https://developer.apple.com/documentation/healthkit/queries)
- [HKObserverQuery](https://developer.apple.com/documentation/healthkit/hkobserverquery)

The exact query and background-delivery configuration is deferred to the native
adapter design. Simulator behavior is not sufficient evidence for background
delivery; device testing is required.

## Health Connect adapter

Health Connect permissions are declared and requested per record category.
Steps, heart rate, sleep sessions, and exercise sessions have distinct records
and permissions:

- [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types)

The adapter uses change tokens for incremental synchronization and persists the
next token only with the imported changes. A token that expires or becomes
invalid triggers a bounded reconciliation import instead of silently starting
from the current time.

Paged reads must consume every page. Historical access and background reads can
require additional permissions, so the MVP must not assume they are available:

- [Read Health Connect data](https://developer.android.com/health-and-fitness/health-connect/read-data)

## Foreground-first policy

The MVP imports when the application is active and when the user explicitly
requests a refresh. Background synchronization is deferred because both
platforms impose additional permissions, scheduling constraints, and physical
device validation.

Foreground-first does not mean one unbounded operation. Imports remain paged,
cancellable, and resumable.

## Idempotence

- Upsert by canonical source identity.
- Applying the same source record twice produces one stored record.
- Applying the same deletion twice has no additional effect.
- Retry only the uncommitted batch.
- Record validation failure does not advance the checkpoint.
- A malformed record is isolated and reported without exposing its health
  values in logs.

## Permission changes

Permission denial and revocation are expected conditions, although a source may
not expose them directly:

- Authorized metrics continue when another metric is denied.
- Empty HealthKit results are not presented as proof of denial.
- Revocation stops new reads for that metric.
- Previously imported local data follows the user-selected retention and
  deletion policy; it is not silently removed or retained.
- The UI links to platform permission management where supported.
- Reauthorization initiates reconciliation from the last usable checkpoint or
  the allowed history window.

Health Connect specifically recommends a user-facing synchronization toggle and
access-management entry point:

- [Health Connect permissions and data access](https://developer.android.com/health-and-fitness/health-connect/ui/permissions)

## Failure states

| Failure | Behavior |
| --- | --- |
| Source unavailable | Preserve checkpoint and explain platform requirement |
| Permission denied | Continue other metrics |
| Read interrupted | Resume from last committed checkpoint |
| Invalid checkpoint | Run bounded reconciliation |
| Invalid record | Quarantine metadata only; do not log payload |
| Local storage full | Stop before advancing checkpoint |
| App terminated | Preserve committed batches |

## Open implementation decisions

- initial history window per metric;
- maximum page or batch size;
- local retention and deletion timing;
- reconciliation window after invalid checkpoints;
- whether user-initiated export includes tombstones;
- background synchronization requirements after the MVP.
