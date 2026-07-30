# Platform permission cautions

Canonical sources: `docs/synchronization.md` and
`docs/privacy-and-security.md`.

- Permission state is part of synchronization state, not a one-time setup step.
- Request only the record categories required by an enabled feature.
- Treat denied, unavailable, and temporarily failing access as different
  outcomes when the platform exposes that distinction.
- Some platform APIs deliberately make denied reads indistinguishable from an
  empty result. Do not claim access from the absence of an error.
- A permission change must not corrupt checkpoints or delete previously
  imported records.
- User-facing errors should explain the affected capability without exposing
  record values in logs or diagnostics.
