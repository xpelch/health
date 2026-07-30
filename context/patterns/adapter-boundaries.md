# Adapter boundary reminders

Canonical sources: `docs/architecture.md` and `docs/extensibility.md`.

- External SDK types end at the adapter boundary.
- Adapters map provider records into canonical domain records.
- The core orchestrates capabilities; it does not branch on provider names.
- Stable record provenance is preserved without making a vendor identifier the
  domain identity.
- Unsupported capabilities must be explicit rather than silently ignored.
- Add an interface only when at least one current workflow needs the boundary.

When adding a source, first define the mapping and failure behavior. When adding
a destination, define which canonical records it accepts and how retries avoid
duplicates. Identity remains independent of both.
