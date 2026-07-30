# Sensitive-data handling

Canonical source: `docs/privacy-and-security.md`.

Health records and their metadata can reveal sensitive facts even when names
are absent. Apply these rules to code, tests, tools, and agent workflows:

- use clearly synthetic fixtures;
- redact tokens, stable device identifiers, source record identifiers, and
  health values from diagnostics;
- log counts, durations, states, and error categories instead of records;
- keep secrets in platform-supported local configuration;
- minimize retained data and make deletion behavior explicit;
- review any network boundary before health data can cross it.

If a debugging task requires real user data, stop and request a privacy-safe,
redacted reproduction instead of copying the data into the repository.
