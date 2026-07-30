# Privacy and Security

## Current data boundary

The MVP reads authorized health records and stores normalized copies on the
phone. It has no account, backend, analytics upload, advertising integration,
or provider-cloud connector.

Local-only storage reduces network exposure but does not make the data safe by
itself. Device compromise, insecure backups, excessive logs, exports, and
overbroad permissions remain material risks.

## Privacy rules

- Request only the four metric categories in the accepted MVP scope.
- Explain the purpose before the system permission prompt.
- Treat each permission independently.
- Do not block local use because the user denied an optional metric.
- Do not collect identifiers for advertising or cross-application tracking.
- Do not log record values, provider tokens, stable health identifiers, or raw
  platform payloads.
- Do not transmit health records off-device in the MVP.
- Make pause, deletion, permission management, and future export discoverable.
- State which source supplied a record when presenting or exporting it.

Apple and Android both require granular health-data permissions and user-facing
purpose declarations:

- [HealthKit authorization](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data)
- [Health Connect permissions](https://developer.android.com/health-and-fitness/health-connect/ui/permissions)

## Storage requirements

The local repository must:

- use application-private storage;
- avoid plaintext data in logs, caches, temporary files, and crash reports;
- make checkpoint and record updates atomic;
- separate credentials from health records;
- support complete user-initiated deletion;
- document its operating-system backup behavior;
- define corruption recovery without uploading data.

The database and at-rest encryption mechanism are not selected yet. The choice
must consider key storage, backup behavior, platform support, maintenance, and
failure recovery before implementation.

## Retention and deletion

Retention duration is still a product decision. Until it is resolved, the
implementation must not claim indefinite or automatic retention.

The decision must define:

- default local retention;
- whether users can select a shorter period;
- what “delete all” removes, including checkpoints and exports;
- how source deletions affect local records;
- whether system backups can restore deleted data;
- what a future destination must delete.

## Export

Portability requires export, but export also moves data outside application
protections. The first export design must:

- require an explicit user action;
- describe the included metrics and time range;
- use a documented, versioned format;
- warn that the destination application controls the exported copy;
- avoid embedding authentication credentials;
- preserve provenance and units;
- allow cancellation before sharing.

The format is deferred until the canonical schema is implemented.

## Optional identity

No identity provider is required by the MVP. Future Google, Apple, OpenID
Connect, passkey, or other adapters must be optional and destination-specific.

- The core receives an opaque owner context, not provider claims.
- Provider subject identifiers remain in the identity boundary.
- Tokens use platform-protected credential storage.
- Authentication does not imply authorization to health metrics.
- Signing out of a remote destination does not destroy local data without a
  separate user decision.
- A fork can replace identity providers without migrating canonical records.

## Threats and controls

| Threat | Required control |
| --- | --- |
| Excessive platform access | Per-metric permission requests |
| Sensitive logs | Structured redaction and no health payload logging |
| Duplicate or altered records | Provenance, validation, and source identity |
| Partial writes | Atomic record and checkpoint commits |
| Stolen provider token | Separate protected credential storage |
| Unintended upload | No network destination in the MVP |
| Data remaining after deletion | Tested deletion across records and checkpoints |
| Malicious export consumer | Explicit warning and user-selected destination |

## Regulatory boundary

The project makes no claim of compliance with HIPAA, GDPR, medical-device
rules, or another regulatory framework. Applicability depends on countries,
deployment, operators, data use, and product claims and requires qualified
review before release.
