## ADR-0076: Permadeath timer + `removed` unit state

**Status:** Accepted
**Date:** 2026-05-17
**Session:** 39a

## Context

Session 39 introduces the Alchemist's Phoenix Down — the first content that exercises a KO → revive code path. Today the engine has a one-way KO model: `unit.vitals.hp <= 0` puts the unit in a quiescent state (scheduler skips them, `validateAction` blocks them from acting, `defeat_all` outcome treats them as defeated). There is no revival path and no concept of "permanently out" distinct from "KO'd."

Phoenix Down's revival surfaces two adjacent design questions immediately:

1. **What happens to a KO'd unit over time?** Without a permadeath timer, a KO'd unit is just *suspended* — Phoenix Down can revive them at any point in the battle. That removes the tactical pressure FFT-canonical permadeath provides ("revive within N turns or this unit is gone for good").
2. **How does the engine model "gone for good"?** A revived unit must be distinguishable from a permadead one. The cheapest signal — `vitals.hp <= 0` — collides: both have hp=0. Either the engine needs a new piece of unit state, or a unit's permadeath has to be expressed by removing them from `state.units` outright.

Both questions land in S39a together (Phase F's first content session): the brief makes them prerequisites for the Alchemist's revival surface.

## Decision

**Three additions to the engine's unit lifecycle:**

### (1) Two new per-unit fields on `Unit`

- **`turnsKOd: number`** — permadeath counter. Initial 0. Incremented by the scheduler when a KO'd unit's virtual CT crosses the trigger threshold. Reset to 0 on revival (Phoenix Down).
- **`removed: boolean`** — terminal "permanently out of this battle" flag. Initial false. Set true when `turnsKOd` reaches the ruleset threshold. Cannot be undone in v1; Phoenix Down on a `removed` unit fails validation.

Both default-populated at `createInitialState`. The test fixture `makeUnit` defaults them to `0` / `false`. No `UnitPlacement` field — battle setup always starts fresh.

### (2) Permadeath cadence: per-unit virtual CT

Per Chris's S39 D6 confirmation: the threshold is **3 virtual would-have-been turns of the KO'd unit themselves**, scaled to their own Speed. The scheduler keeps ticking a KO'd unit's CT alongside everyone else (same `computeSpeed` path, including equipment / status modifiers). When their virtual CT crosses `TRIGGER_THRESHOLD`, the scheduler emits `system_ko_tick` instead of `turn_start`. The `reduceSystemKoTick` reducer:

- Increments `turnsKOd` by 1.
- Resets CT to 0 (next virtual cycle is fresh).
- If `turnsKOd >= permadeath.threshold`, queues a `system_unit_removed` action via `generatedActions`.
- If the unit is no longer KO'd (revived between the tick fire and the commit), the reducer is a no-op — CT stays unchanged, counter unchanged.

The cadence has a real game-design implication: a Speed-12 unit dies faster than a Speed-6 one. Fast classes pay a tempo tax on KO; slow classes get more revival window. Chris's call vs. the planner's recommended "per-ally-turn-start" alternative (which would have given every team a uniform 3-ally-turns window regardless of who KO'd).

### (3) New action kinds + scheduler discriminator

**Actions:** `system_ko_tick` (per above) and `system_unit_removed` (terminal flag flip). Both system-source; both pass-through `validateAction` per the established convention for engine-emitted actions.

**Scheduler:** new entity kind `'ko_unit'` in `buildSnapshot`. `removed` units are filtered out entirely; KO'd-but-not-removed units enter as `'ko_unit'` entries with their normal Speed. At exactly-equal CT, the comparator prefers living-unit `'unit'` entries over `'ko_unit'` entries (a real turn beats a bookkeeping tick).

**Ruleset:** new field `permadeath: { threshold: number }`. Default ruleset: `3`. The test ruleset accepts a `permadeathThreshold` override.

### (4) `removed` filtering propagated through the engine

Beyond the scheduler:

- **`unitAt`** (occupancy queries) skips removed units. Pathfinding, tile inspection, and AoE membership read through this — they automatically treat the removed unit's tile as empty.
- **`validateUseThrowItem`** rejects targeting a `removed` unit explicitly with a clear error.
- **`projectUpcoming`** (the queue tower projection) skips both KO'd and removed — the upcoming-queue UI shows real turns, not ko_tick events.
- **`evaluateBattleOutcome`'s `defeat_all`** check naturally treats removed units as defeated (their hp is 0). No explicit `removed` check needed; the existing `hp > 0` predicate covers it.

### (5) Revival: HP=1 baseline + heal layer + CT/counter reset

Phoenix Down's reducer (inside `applyConsumableEffects`):

1. If `target.vitals.hp <= 0 && !target.removed`: HP = 1, `turnsKOd = 0`, `ct = 0`.
2. Then the item's `hpRestore` layers on top (PA × 4, capped at maxHp).

CT resets to 0 (not "resume from prior" or "instant CT 100") per FFT-canonical "the revived unit re-enters the queue at the bottom." Chris's framing: revival shouldn't be a near-instant action.

## Consequences

**For S39a engine:**
- Two new fields on `Unit`. Both required; `makeUnit` factory defaults them. Direct Unit literals in tests (none beyond the factory today) would need to add them — handled.
- Three new action kinds (`use_compound`, `use_throw_item`, plus the permadeath pair). Exhaustive dispatch in `validateAction`, `reduce`, and `commit.envelopeFor` — TS `never` guards catch missed branches.
- Scheduler complexity bumps slightly (one new entity kind, one new comparator branch). The KO-virtual-CT path runs only when KO'd-but-not-removed units exist; otherwise it's no-cost.

**For S39b content (Alchemist class + UI):**
- The substrate is testable without the Alchemist class — `session-39a-integration.test.ts` exercises every action path through fixtures. S39b lands the class + Compound submenu UI + permadeath countdown badge + sample team template.
- The Alchemist UI needs a "permadeath imminent" indicator on the roster card — the count is on `unit.turnsKOd`; threshold is on `state.ruleset → ruleset.permadeath.threshold`.

**Speed-scaled cadence's downstream implications:**
- A high-Speed class (future Thief, Archer) loses revival window relative to a low-Speed Knight. This pairs with their Speed advantage — they take more turns per engine-tick generally, including virtual ones.
- Equipment that boosts Speed (Boots of Haste) shortens the revival window when worn by a KO'd unit. Future "stabilizing" equipment that reduces virtual-CT accumulation could be a content add — out of scope for v1.
- Stop status on a KO'd unit (rare, but possible if Stop was applied pre-KO) sets Speed to 0 via `speedBounds.floor` — virtual CT freezes, revival window stretches indefinitely. Defensible — the unit is "in stasis."

**`removed` semantics:**
- Removed units stay in `state.units` (action-log references and historical lookups remain valid). They don't occupy tiles; their position is dead data preserved for log readability.
- No FFT-style crystal/treasure leftover. The brief flags this as a future content add ("removed unit leaves an item"); v1 ships without.
- No revive-from-removed path. Future content (a hypothetical "Resurrection" ability that bypasses permadeath) would gate on the `removed` flag — the engine surface is ready.

**Action log readability:**
- `system_ko_tick` entries with `turnsKOdAfter: 1` / `2` show the counter advancing. `turnsKOdAfter: 3` with `removalQueued: true` immediately precedes a `system_unit_removed` entry. The action-log formatter (S39b) can render these as "Marach (KO, 1/3) → Marach (KO, 2/3) → ... → Marach removed from battle."

## Alternatives considered

**Per-ally-turn-start cadence.** Planner's initial recommendation: tick `turnsKOd` whenever any ally on the KO'd unit's team takes a turn. Cleaner uniform window ("team gets 3 ally turns"), independent of the KO'd unit's Speed. Rejected by Chris in favor of per-virtual-turn for closer FFT-canonical feel.

**Per-global-tick cadence.** Every N engine ticks, all KO'd units' counters bump. Uniform across teams and Speeds. Rejected as too divorced from the unit's own turn cadence — the engine doesn't otherwise quantize anything in "global ticks of N."

**Per-full-round cadence.** Tick once when the action queue cycles back to a marker. Requires defining what "round" means in a per-unit-CT model. Rejected as architectural surface for a 1-line numeric change.

**Removing the unit from `state.units` outright (no `removed` flag).** Cleaner state shape; aggressive cleanup. Rejected because the action log references unit ids — a downstream consumer reading old log entries would crash on `getUnit(removedId)`. The flag preserves identity.

**Reviving with HP > 1.** The brief specified PA × 4 HP on top of the revive. Earlier framing was "PA × 4 HP outright, capped at maxHp" with no baseline. The 1-HP-baseline interpretation (revive then heal) preserves the +1 from the revive even when the heal somehow caps at 0 — defensible and matches FFT's "Phoenix Down revives to 1 HP if no heal effect" lineage. Both lead to similar play; we picked the layered version for symmetry with future "revive with X% HP" items.

**Folding ko_tick + unit_removed into one action.** A single `system_ko_event` action with a payload that flags "tick" vs. "remove." Rejected because the action-log line for "ticked to 2/3" reads very differently from "removed from battle" — splitting them makes both clear and matches the action-log readability discipline.

## Notes for future sessions

- The `removed` flag composes with everything that already filters by `vitals.hp <= 0`. Future engine code that adds another "alive predicate" should be aware of both. The scheduler's three-way kind (`unit` / `ko_unit` / [excluded]) is the model.
- If `removed` ever needs to be reversible (post-v1 "Resurrection" content), the inverse action (`system_unit_unremoved`?) is a small reducer; `removed` flips false; `turnsKOd` reset; `ct` reset. The orchestrator hook chains never fire on a `removed` unit today, so there's no need for an "un-remove" event to re-fire anything.
- Permadeath ADR-future: this ADR ships the threshold-3 default. If playtest reads "too punishing for fast classes" or "too forgiving for slow classes," the right knob to turn first is the threshold per-class or per-class-Speed scaling rather than changing the cadence model.
