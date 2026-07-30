# Canonical Data Model

## Purpose

The canonical model gives synchronization, storage, export, and future client
applications a stable language that does not expose HealthKit, Health Connect,
or provider payload types.

This is a conceptual contract. Exact TypeScript schemas and serialization
formats will be decided during implementation.

## Record envelope

Every canonical record carries:

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Version of the canonical contract |
| `recordId` | Stable local identifier |
| `metricType` | Steps, heart rate, sleep, or workout |
| `startTime` | Inclusive start instant |
| `endTime` | End instant when the metric spans an interval |
| `zoneOffset` | Source-provided offset when available |
| `source.adapterId` | Adapter that produced the record |
| `source.originId` | Platform application or provider origin when available |
| `source.recordId` | Stable identifier assigned by the source |
| `source.device` | Non-identifying device metadata when useful and permitted |
| `source.updatedAt` | Source modification time when available |
| `importedAt` | Time Health imported the record |
| `payload` | Metric-specific normalized values |

The model must distinguish “not supplied by the source” from a meaningful zero
or empty value.

## Metric payloads

### Steps

- integer count;
- start and end time;
- no derived distance or calories in the MVP.

### Heart rate

- one or more samples;
- sample timestamp;
- beats per minute;
- no diagnosis or interpretation.

### Sleep

- session start and end;
- optional stage intervals;
- source stage value mapped to a documented canonical stage or retained as
  unknown;
- no inferred sleep stage when the source does not provide one.

### Workout

- session start and end;
- canonical activity type when a safe mapping exists;
- original source activity label when needed for provenance;
- optional title and device metadata if non-sensitive and useful;
- detailed routes and location are outside the MVP.

## Time and units

Instants are stored in an unambiguous UTC representation. A source-provided zone
offset is retained separately because local-day grouping cannot always be
reconstructed from UTC alone.

Adapters convert values to canonical units at the boundary and retain enough
provenance to explain that conversion. They must not infer a missing zone
offset.

Health Connect records explicitly include time, zone-offset, unit, and metadata
fields depending on record type. Its guidance recommends supplying zone offsets
when available:

- [Health Connect data format](https://developer.android.com/health-and-fitness/health-connect/data-format)

## Identity and deduplication

The primary source identity is:

```text
(adapterId, source.recordId, metricType)
```

That tuple is unique in the local repository. An update replaces the canonical
representation of the same source record.

If a source does not provide a stable identifier, its adapter must define and
document a deterministic fallback before it can be accepted. A content hash is
a last resort and must include metric type, normalized values, time range, and
source origin.

Records from different sources are not automatically treated as duplicates.
They may describe the same physical event with different precision or
provenance. Aggregated views may later apply source-priority rules, but the raw
canonical records remain distinct.

For cumulative Health Connect data such as steps, the platform aggregation API
can reduce double counting across sources:

- [Reading Health Connect data](https://developer.android.com/health-and-fitness/health-connect/read-data)

## Deletions

Source deletions are synchronization events. The local repository removes the
corresponding record or retains a minimal tombstone when a destination needs to
receive the deletion later. Tombstones contain identifiers and deletion
metadata, not the deleted health payload.

The exact local deletion-retention policy remains an implementation decision.

## Versioning

- Additive optional fields may remain within one schema version.
- Meaning changes, field removal, or incompatible unit changes require a new
  schema version.
- Adapters declare which canonical version they produce.
- Stored records are migrated explicitly; readers do not guess a version.
- Provider-specific fields do not enter the canonical contract merely because
  one adapter exposes them.
