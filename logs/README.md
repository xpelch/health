# Local agent logs

This directory documents the format and index for optional agent work notes.
Generated session notes, reports, traces, and temporary files are ignored by
Git.

Use `templates/session-summary.md` only when a multi-step task benefits from a
handoff record. Prefer canonical documentation or an ADR for knowledge that
must remain part of the project.

Logs must never contain:

- health records or health values;
- personal or stable device identifiers;
- access tokens, credentials, or secrets;
- copied private conversations or external documents;
- unredacted command output containing sensitive paths or configuration.

Keep the committed `index.md` limited to durable, intentionally published
entries.
