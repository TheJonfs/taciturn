# Documentation

This directory contains design and architecture documentation for the project. Conventions:

- **`design/`** — *what* the systems are and *why* they're shaped that way. Authoritative for system design. If implementation diverges, either implementation or the doc is wrong.
- **`architecture/`** — *how* the design maps to code. Module boundaries, dependency rules, testing patterns.
- **`decisions/`** — Architecture Decision Records (ADRs). Short notes capturing significant decisions made during implementation, especially when the choice deserves explanation later.

## Design docs

Read these first when working on a system. They build on each other in roughly this order:

1. **[Glossary](design/glossary.md)** — proper nouns and terminology used throughout. Open this in a tab.
2. **[CT System](design/ct-system.md)** — the time and turn-order foundation everything else builds on.
3. **[Ability Slots](design/ability-slots.md)** — how abilities are equipped and constrained on units.
4. **[Core Types](design/core-types.md)** — Unit, Tile, Map, Action, GameState. The shapes everything else uses.
5. **[Map and Battlefield](design/map-and-battlefield.md)** — movement, range, line-of-sight, area-of-effect, tile properties.
6. **[Status Effects](design/status-effects.md)** — status system and the cross-cutting hook system that statuses, passives, equipment, and class traits all use.
7. **[Action Resolution](design/action-resolution.md)** — action lifecycle, validation, damage pipeline, reactions and the action chain.
8. **[Turn Structure](design/turn-structure.md)** — turn boundaries, battle flow, victory conditions.

## Architecture

- **[Overview](architecture/architecture-overview.md)** — directory structure, module boundaries, dependency rules, testing patterns.

## Decisions

ADRs accumulate as the project grows. They're short documents (typically a page or less) that capture:
- The decision made.
- The context and constraints.
- Alternatives considered.
- Consequences accepted.

Format: numbered, immutable once written. If a later decision supersedes an earlier one, it references and supersedes rather than editing the original.

## Contributing to docs

If implementation reveals that a design doc is wrong or incomplete:
1. Update the design doc.
2. Note the change in commit message.
3. If the change implies decisions made during implementation, capture those as ADRs.

Don't let docs drift. The point of having them is to maintain a shared mental model that survives across sessions and contributors.
