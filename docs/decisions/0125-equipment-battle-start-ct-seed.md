## ADR-0125: Equipment battle-start CT seed (Greaves of Seraphis)

**Status:** Accepted
**Date:** 2026-06-26

## Context

S74's caster-accessory batch wanted Greaves of Seraphis: Speed +2 and "the
wearer starts the battle at 100 CT (acts first)" — the costed, unique
re-introduction of the pre-emption the old Haste bug handed out for free.

Speed +2 is a trivial `statMods` entry. The CT seed was the question: initial CT
is resolved once per placement in `enumeratePreBattleActions`
(`resolveInitialCT(ruleset, placement, masterSeed)` → a `system_set_ct`), and the
only override path was authoring-time `placement.initialCT`. There was no
per-unit channel by which a piece of equipment could set the wearer's starting
CT.

## Decision

Add an optional data field `battleStartCt?: number` to `EquipmentBase` — a
**setup-time data field, not a new hook** (so ground rule 8's closed hook
surface is untouched). `enumeratePreBattleActions` reads the strongest
`battleStartCt` across a unit's equipped items (`equipmentBattleStartCt`) and,
when present, emits the unit's `system_set_ct` with that value and
`source: { kind: 'equipment', itemId }` — overriding **both** the ruleset's
initial-CT formula draw and any explicit `placement.initialCT`.

- **Precedence: equipment > explicit placement.initialCT > formula draw.** The
  CT seed is a deliberate, costed build choice (the whole point of the accessory),
  so it wins. `SystemSetCtSource` gains the `{ kind: 'equipment'; itemId }`
  variant for action-log attribution.
- **The existing [0, 99] clamp stands.** `system_set_ct` clamps to
  `[0, TRIGGER_THRESHOLD - 1]` ("no unit starts pre-triggered"), so a 100-seed
  lands at 99 — the pre-trigger ceiling. Greaves authors `battleStartCt: 100`
  (the design number / flavor) and relies on the documented clamp; 99 still
  guarantees first action (it triggers in one tick, ahead of every
  formula-derived starter).
- **Applied exactly once, at setup.** The pre-battle phase runs once before turn
  0; the seed does not re-trigger.
- **Multi-piece tie-break:** when two equipped items both declare it (no v1
  case), the larger value wins, ties on item id — deterministic.

## Consequences

- Greaves of Seraphis: `{ statMods: { spd: 2 }, battleStartCt: 100 }`.
- Any future "starts the battle at CT N" equipment is one field + zero new code.
- The override is silent against `placement.initialCT`; documented in
  `create-initial-state.ts` and the field comment.

## Alternatives considered

- **A new `modifyInitialCT` hook fired per placement.** Cleaner-looking but adds
  to the closed hook surface for a single, setup-time, data-shaped concern. The
  data field reads the same way `statusGrants` does and needs no runtime chain.
- **A status grant that emits `system_set_ct` at battle start.** Indirection
  through a bespoke status with no other purpose; the data field is more direct.
- **Author `placement.initialCT: 99` on every Greaves wearer.** Pushes a
  build-derived value into hand-authored scenario data and the team-builder
  pipeline; doesn't travel with the item.
