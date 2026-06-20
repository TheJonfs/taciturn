## ADR-0087: Level system — slot-based level assignment, HP/MP scaling, dominant-stat modulation

**Status:** Accepted
**Date:** 2026-05-24
**Session:** 49

## Context

Session 49 introduces a slot-based level system as a parallel substrate to the Calculator's Math Skill (ADR-0086). Math Skill's `parameter: 'level'` predicate reads `unit.level` to select targets; without a level concept, the parameter would target every unit uniformly (every L25 unit modulo any positive integer is 25 — a meaningless cluster).

Pre-S49 every v1 unit was implicitly L25. Class baseline stats (`src/content/classes/baseline-stats.ts`) are calibrated to that reference. There was no `Unit.level` field on the engine type, no `dominantStat` on classes, and no level-modifier composition in the stat pipeline.

The blueprint defines the system:

> Slot-based level assignment in team-builder: slot 1 = L25, alternating outward (slot 2 = L24, slot 3 = L26, slot 4 = L23, slot 5 = L27).
>
> Level effects on stats:
> - L25 (slot 1): baseline.
> - L24 / L26 (slots 2 / 3): ±10% HP/MP.
> - L23 / L27 (slots 4 / 5): ±10% HP/MP AND ±1 to the class's dominant stat.

Per-class dominant stats per the blueprint:
- Knight: PA — Alchemist: PA — Hunter: PA — Assassin: SPD — Calculator / Mage classes: MA.

## Decision

### 1. `Unit.level: number` (engine type)

Added as a required readonly field on `Unit`. Set at placement-construction time via `placement.level`, defaults to 25 when omitted (back-compat with demo / hand-authored battles that don't carry a slot). Locked through battle — no in-battle level mutation; the Calculator's hypothetical "Level Shift" ability remains out of v1 scope per the brief.

`UnitPlacement.level?: number` mirrors this — optional on placements so non-team-builder configs (demo battle, integration tests) inherit the default 25.

### 2. `ClassDefinition.dominantStat: DominantStat`

Required field on every class. Type:

```ts
type DominantStat = 'pa' | 'ma' | 'spd';
```

`'spd'` matches the `BaseStats` field name (so `baseStats[dominantStat]` is direct). At L23 the unit's dominant stat is `-1`; at L27 `+1`. Below L23 / above L27 the same `±1` applies — the pattern's symmetric outward.

### 3. Stat composition: level modifiers apply at `buildBaseStats` time

Critical placement decision: level modifies `BaseStats` **before** the unit is constructed, not at `modifyStatQuery` read time. Rationale:

- Equipment / status / passive modifiers compose on top via `modifyStatQuery`. If level were a `modifyStatQuery` handler, it'd compete with equipment for ordering — and the brief specifies level modifiers apply *before* equipment.
- The Level system is structurally similar to class baseline stats: a static per-unit per-battle baseline. Folding it into `buildBaseStats` keeps the baseline composition layer the single source of truth for "what stats does this unit start with."

`buildBaseStats(classId, brave, faith, level = 25)`:
- `HP_modified = round(maxHpBase × (1 + 0.1 × (level - 25)))`
- `MP_modified = round(maxMpBase × (1 + 0.1 × (level - 25)))`
- `dominant_stat += 1 if level >= 27, -1 if level <= 23, else 0`

`Math.round` (banker's-style nearest, half-up) keeps the symmetric behavior on positive and negative level offsets; floor-only would bias negative-mod stats.

### 4. `classDominantStats` map mirrors `classBaselineStats`

`baseline-stats.ts` exports a parallel `ReadonlyMap<ClassId, DominantStat>` so `buildBaseStats` can apply the modifier without a catalog dependency at template-author time. A loader-side cross-check (in `level-substrate.test.ts`) verifies the static map agrees with each ClassDefinition's `dominantStat` field. Drift fails loud.

### 5. Slot-to-level mapping: `slotLevelFor(slotIndex)`

```ts
function slotLevelFor(slotIndex: number): number {
  if (slotIndex <= 0) return 25;
  const halfStep = Math.floor((slotIndex + 1) / 2);
  return slotIndex % 2 === 0
    ? 25 + halfStep // even ≥ 2 → +N
    : 25 - halfStep; // odd → -N
}
```

Mapping: slot 0→25, slot 1→24, slot 2→26, slot 3→23, slot 4→27. Pattern extends to larger teams (slot 5→22, slot 6→28, etc.) — MAX_TEAM_SIZE 5 today, but the formula is sound for any future expansion.

### 6. `BuiltUnit.level: number` (content type)

Required field on `BuiltUnit`. Set by the team-builder when assembling a team (active-unit position via `slotLevelFor`), set explicitly by templates that hand-author placement. Carries through `buildTeamBattleConfig` → `UnitPlacement.level` → `Unit.level`.

### 7. Legacy templates apply slot-based levels

All 8 pre-S49 templates (3 user-facing defaults + 5 legacy) updated to set per-unit `level: slotLevelFor(N)` and call `buildBaseStats(class, BRAVE, FAITH, slotLevelFor(N))`. The round-trip (template → builder → built team) is now lossless on level.

This causes a small retroactive tuning shift: pre-S49 templates were all-L25; post-S49 they get slot-based differentiation. The Mage War template's Geosage (slot 1, L24) loses 10% HP/MP; the Pyromancer (slot 2, L26) gains 10%; the Aethurge (slot 3, L23) gets -1 MA *and* -20% HP/MP. Watch-for in handoff.

### 8. UI surface: level badge per slot in team-builder roster

`RosterCard` renders a small blue pill ("L25" / "L24" / "L26" / etc.) next to each filled slot's unit name. Effects are otherwise implicit — the brief specifies "stat panel shows modified values without a breakdown." `computeDraftUnitStats` accepts a `level` parameter so the displayed stats reflect the level-adjusted values; the team-builder threads slot-derived levels into the stat computation so HP/MP/dominant-stat shifts surface immediately on slot reorder.

## Consequences

- `Unit.level` field locked through battle; mutators deferred to future class abilities (Level Shift, etc.).
- 9 class definitions get a one-line `dominantStat` annotation.
- All 8 legacy team templates apply slot-based levels; their pre-S49 L25-uniform tuning shifts slightly. Watch for playtest signal.
- New static `classDominantStats` map keyed by ClassId; cross-validated against ClassDefinition.dominantStat at test time.
- Math Skill's `parameter: 'level'` predicate gains a real signal (was implicitly always-25, always-divisible).

## Amendment (S71, 2026-06-20): level is by slot *position*, not filled-ordinal

The original implementation assigned level by **active-unit position** — the unit's
rank among the *filled* slots (decision §6 above: "active-unit position via
`slotLevelFor`"), compacting over empty slots. So a 3-unit team always took
25/24/26 regardless of which slots held them, and the captain (L25) was the
first *filled* slot.

This conflicted with the blueprint quoted in Context, which is **slot-based**:
"slot 1 = L25, slot 2 = L24, slot 3 = L26, …". A playtest surfaced the
user-visible symptom — the roster level pills shifted as the team filled (every
empty slot read the same number; a unit placed out of order showed L25 and
renumbered as earlier slots filled) and only settled once the roster was full.

Per Chris's call, the system now assigns level by **slot index**:
`slotLevelFor(slotIndex)` for every slot, filled or empty. A unit gets its slot's
level regardless of how many other slots are filled or in what order, so the
roster shows the correct level in each slot all the way and nothing shifts.

Consequences:
- **Full 5-unit teams: unchanged** (slot index == filled rank with no gaps) — the
  common Mage-War case is identical.
- **Teams under 5 units: levels now depend on placement.** A 3-unit team in slots
  1/3/5 is L25/26/27 (was 25/24/26); leaving slot 1 empty means no L25 captain.
  Placement is now a (minor) lever — accepted as the cost of a predictable, stable
  roster display. If level-gaming via slot-skipping proves undesirable, a
  contiguous-fill constraint is the mitigation (not adopted now).

Implementation: `teamBuilderStateToBuiltTeam`, `slotLevel(index)`, and the
stat-preview paths in `use-team-builder.ts` all key off the slot index;
`slotLevel` no longer takes state or returns null (every slot has a level). The
S71 `slotLevelProspective` stopgap (which estimated empty-slot levels under the
old scheme) is removed.

## Alternatives considered

- **Level as a `modifyStatQuery` handler**: rejected — would compete with equipment / status for ordering, and the brief specifies pre-equipment application.
- **Level in `Unit.classState` rather than top-level**: rejected — level is a per-battle property like HP / position, not a class-progression artifact. The brief is explicit that level locks at team-build and doesn't mutate through battle.
- **Single map combining baseline stats + dominantStat**: would couple the data shapes. Two parallel maps with a sync test is cleaner.
- **Level on `BuiltUnit` optional with a default**: rejected — explicit level on every built unit removes a confusing default that'd silently produce L25 for templates that meant to use slot-based mapping.

## References

- `docs/thirtyNinePlanning/calculator-blueprint.md` §"Level Substrate".
- `docs/thirtyNinePlanning/session-49-brief.md` §"Level system substrate".
- `src/engine/types/unit.ts` — `level` field.
- `src/engine/catalog/definitions/class-definition.ts` — `dominantStat` + `DominantStat` type.
- `src/content/classes/baseline-stats.ts` — `classDominantStats` map.
- `src/content/teams/built-team.ts` — `buildBaseStats`, `slotLevelFor`, `BASELINE_LEVEL`.
- `src/ui/team-builder-roster.tsx` — level badge.
- `src/content/teams/level-substrate.test.ts` — substrate + cross-validation tests.
- ADR-0086 (Math Skill substrate — the consumer of `unit.level`).
- ADR-0028 (stat composition pipeline — what the Level modifier composes *before*).
