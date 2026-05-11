## ADR-0043: Derived-events stream for KO synthesis and per-unit stats

**Status:** Accepted
**Date:** 2026-05-10

## Context

Four Session-24 UI surfaces want the same derived data from the action log:

1. Action log panel — `[ko]` rows interleaved at the lethal-damage sequence number.
2. Action log panel — per-row participants (actor + targets) for the on-canvas hover-counterpart pulse.
3. Results screen — chronological KO timeline.
4. Results screen — per-unit damage / damage-taken / KOs-scored tallies, including the MVP-unit pick.

Two paths to the data:

- **Derived-events stream:** a separate module walks the log once and emits a typed event stream (`KoEvent[]`, `PerUnitStats` map, `ActionParticipants` per action). All four consumers read from the same derivation.
- **Formatter-local:** the action-log formatter tracks running HP as it walks the log, emitting `[ko]` rows inline; the results screen does its own separate walk; hover-counterpart does its own per-action lookup.

The formatter-local path is fewer lines for KO-row interleaving alone but duplicates the walk three times across consumers, with three chances to drift.

## Decision

**Derived-events stream.** New `src/ui/derived-events.ts` module exporting:

- `deriveKoEvents(log, state): KoEvent[]` — walks the log with a running-HP tracker (seeded from each unit's `baseStats.maxHpBase`, per createInitialState's "full HP at battle start" rule); emits a KO event at each HP-positive-to-zero crossing.
- `derivePerUnitStats(log, state): Map<UnitId, PerUnitStats>` — tallies damage dealt / damage taken / healing dealt / KOs scored. Credits the KO walker's `killingActor` to `kosScored`.
- `deriveActionParticipants(action): ActionParticipants` — pure per-action, no log walk; returns `{ actorId, targetIds }`. Used by the action log panel's row hover handler.

The module is pure (no React, no state mutation), tested in `src/ui/derived-events.test.ts` (9 tests).

**Charged-action attribution.** `charged_action_resolve` actions carry `source: 'system'` and no `actorId` on the envelope — the caster's id is on the originating `use_ability` (whose `outcome.chargedActionId` matches the resolve's `payload.chargedActionId`). The walker maintains a `chargedActionId → casterUnitId` map built from the cast events on first pass, then resolves the actor at attribution time. Without this, MVP-unit picks zero out for any battle where the killing damage came from a charged spell — which is the dominant case in v1's Mage-heavy content.

### Rejected alternatives

- **Formatter-local KO synthesis.** Smaller diff for the `[ko]` row alone, but the hover-counterpart and results-screen surfaces would each do their own walks. The derived module is one walk, four consumers; the duplication cost outweighs the upfront-module cost.

- **Stamp `actorId` on `charged_action_resolve` in the engine.** Engine-side change with a wider blast radius — replay tooling, log analysis, AI projection all read the action envelope. Cheaper to source the caster from the log on the UI side; engine remains the single source of truth.

- **Compute KOs inside `derivePerUnitStats` separately from `deriveKoEvents`.** Two walks where one suffices. The stats function calls the KO derivation and threads the attribution through.

## Consequences

- **`[ko]` row attribution names the killer.** Action log shows `[ko] Blue Knight defeated by Red Lightning Mage` (vs. the design doc's bare `[ko] Blue Knight defeated`) since the data flows for free from `deriveKoEvents`. Cheap polish on top of the derivation.

- **Results-screen MVP and KO timeline agree by construction.** Both read the same `KoEvent[]`; the MVP function (highest-damage-dealt; tie-broken lexically per Chris's call for v1) consumes the same `derivePerUnitStats` map.

- **Hover-counterpart works uniformly across action-log rows.** Every row carries a `participants` field; hovering any row lights up the same canvas pulse. The QueueTower mini-cards reuse the same renderer API (`setCounterpartUnits`).

- **3-turn permadeath timer is not implemented.** v1 has no permadeath mechanism, so the results screen labels the section "KO Timeline" rather than the design doc's "Permadeath Casualties." When permadeath ships (post-MVP), `deriveKoEvents` extends with a `permadeath?: { atTurn: number }` field; both UI consumers update at that point. Flag carried to handoff.

- **Initial-HP assumption is "full HP at battle start."** The walker reads `state.units.get(id).baseStats.maxHpBase`, not a snapshot of pre-battle vitals. If a future content path authors unit-specific starting HP, the walker takes that via an explicit fixture arg.

## Related

- ADR-0040 — Turn-flow state machine (the UI's pure-reducer pattern; derived-events follows the same pure-module discipline)
- `docs/audits/post-20-engine-audit.md` §Item 20 — action log shape (confirms the log is rich enough for KO synthesis + per-unit stats post-hoc)
- `docs/twentyOneDesign/battle-ui-architecture.md` §"KO Presentation" and §"Battle-End and Results Screen"
