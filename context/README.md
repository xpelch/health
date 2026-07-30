# Agent context

This directory is a small routing layer for coding agents. It highlights
operational cautions and points to canonical project documentation.

It is intentionally not a second knowledge base. Product requirements,
architecture, data contracts, and durable decisions remain in `VISION.md`,
`README.md`, `docs/`, and `docs/adr/`.

## How to use it

1. Open `.meta/index.yaml`.
2. Select entries matching the area being changed.
3. Read every listed canonical source before implementation.
4. Treat context notes as reminders, not substitutes for source inspection.

## Adding context

Add a note only when it prevents a recurring mistake or improves routing.
Keep it short, link the authoritative document, and register it in the index.
Never store secrets, health records, user identifiers, or copied external
content here.
