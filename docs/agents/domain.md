# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`VISION.md`** at the repo root — the product direction.
- **`context/index.yaml`** — the routing index to canonical documentation. Read the paths relevant to the area you're about to work in.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this repo):

```
/
├── VISION.md
├── AGENTS.md
├── context/
│   └── index.yaml                  ← routes to canonical docs
├── docs/
│   ├── adr/
│   │   ├── 0001-mobile-health-aggregation.md
│   │   └── 0002-vendor-neutral-core.md
│   └── ...                         ← canonical docs
└── mobile-app/
```

The index only routes to canonical documentation; do not duplicate product or architecture rules elsewhere.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the canonical docs. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't defined yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0002 (vendor-neutral core) — but worth reopening because…_
