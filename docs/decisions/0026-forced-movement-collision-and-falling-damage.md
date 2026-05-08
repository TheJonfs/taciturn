## ADR-0026: Forced-movement collision policy and falling damage

**Status:** Accepted
**Date:** 2026-05-06

## Context

Session 17b lays the groundwork for forced movement (knockback) ahead of Water Mage's heavy use in session 18. Earth Mage doesn't directly use knockback — Water does — but the engine primitive needs a clearly specified collision and falling-damage policy before any content consumer ships.

The roadmap (sessions-14-20.md, "Session 17") flagged this as the open architectural question: when a knockback would push a unit onto a tile that's blocked, climbed, or off the map, what happens? Three candidate policies were on the table:

1. **Cancel** — knockback halts at the last legal tile or fails entirely. FFT-faithful.
2. **Damage** — knockback halts and the unit takes collision damage.
3. **Swap** — knockback swaps the moving unit with the blocker.

Falling damage is a separate orthogonal concern: when the destination is *legal* but lower, does the unit take damage from the drop?

## Decision

### Collision policy: cancel-with-height-tolerance

Forced movement (knockback) computes destination tiles step-by-step from the source position. For each candidate destination tile, the engine checks:

1. **Map edge** — if the destination is off the map, the knockback is cancelled at the last legal tile.
2. **Unit blocker** — if a unit (regardless of team) occupies the destination tile, the knockback is cancelled at the last legal tile.
3. **Height tolerance** — if the destination tile's elevation is **at least 1 unit greater** than the unit's current standing elevation, the knockback is cancelled at the last legal tile. (A unit cannot be knocked *up* a step or more.)
4. **Otherwise** — the knockback proceeds. Specifically, downward knockback is permitted regardless of drop distance; falling damage applies (see below).

If the cancel triggers on the first candidate tile (no movement happened), the unit's position is unchanged.

**Why "cancel" not "damage" or "swap":**

- *Damage on collision* requires picking a damage formula and a tag, which couples knockback to the damage pipeline and creates resistance/elemental questions for what is fundamentally a kinematic event. We may revisit if a class needs an explicit "slam them into walls" mechanic, but no v1 class designs it.
- *Swap* is mechanically interesting but creates a friendly-fire knockback paradox (a knockback shouldn't grant the user a teleport). FFT-faithful is "cancel."
- *Cancel* preserves the player's mental model: a knockback either lands the target where it would land in the open, or fails. No surprise damage, no surprise positioning.

**Why height-tolerance "at least 1 step up cancels":** parallels the Jump-stat semantics for volitional movement (a unit's Jump determines how high they can climb, and cardinal-direction movement that goes *up* a tile demands a tile within Jump). Knockback does *not* grant climbing ability — being knocked *into* an upward step is unphysical. The tolerance is `< 1` (i.e., destination elevation ≤ current elevation, plus epsilon for engine rounding) to permit lateral knockback across same-elevation tiles or downward knockback.

### Falling damage: 10 HP per level fallen, applied when drop > 1

When a knockback step terminates (either at the final intended tile or at a cancellation boundary), if the unit's final elevation is `D` units **lower** than its starting elevation (the elevation at the start of the entire knockback, not per-step):

- If `D <= 1` — no falling damage. (A 1-tile drop is recoverable; FFT-faithful.)
- If `D > 1` — falling damage = `10 × D` HP. Tagged `'physical'` (subject to physical resistance), no Counter trigger (it's not an attack).

Falling damage is applied via a **`system_damage` system action** (introduced in session 17b — see ADR-0027 for the action shape). The damage is non-elemental, non-magical, and bypasses the standard damage pipeline's variance / Faith / hit-chance stages — it's a flat formula like Poison's tick.

**Why 10 HP per level and a > 1 threshold:** at MaxHP 60-100 (v1 demo range), a 2-level drop deals 20 HP — meaningful but not lethal. A 5-level drop deals 50 HP — should be lethal for a fragile unit. Calibrated to "drop chip damage on a typical 2-3 level cliff, severe damage on a sheer drop." The `> 1` threshold means standard 1-tile elevation differences (the most common shape on v1 maps) don't pile damage onto every knockback.

**Why not scale by Jump or Move stat:** for v1 simplicity. Future classes with "graceful landing" passives can register an `onFallingDamage` modifier when needed (closed-hook discipline — the modifier becomes a deliberate engine extension at that point, not an ad-hoc rider).

### Knockback as a reusable primitive, not an ability rider

The session 17b deliverable is a pure-function primitive: `applyKnockback(state, catalog, args) → KnockbackResult`. It computes the path the unit takes, the cancellation reason (if any), the final position, and any falling-damage system action emitted. Callers (Water Mage's session-18 abilities, future content) thread it through their effect pipeline.

The primitive is **not** wired to any v1 ability — bolt, Earth Strike, Earth Quake, and Earth Cataclysm don't knockback. The primitive's first content consumer ships in session 18.

**Why pure primitive, not ability-effect type:** ability effects (damage, status, AoE) are declarative on the AbilityDefinition. Knockback is a side effect of an effect — Water Base spell is "damage with a chance to knockback 1." The natural shape is "an ability's reduction-time hook calls applyKnockback when the rider triggers." Adding a knockback effect type to the AbilityDefinition would require parsing rules for direction, distance, and trigger conditions — premature abstraction before the second consumer.

## Consequences

- New utility module `src/engine/map/knockback.ts` ships in session 17b with the pure primitive and unit tests. No content consumer in v1.
- `system_damage` system action (ADR-0027) is the falling-damage delivery mechanism. Reused by Poison's tick.
- Future "soft landing" or "stagger on collision" passives register on a future hook (TBD when the first class needs it). Today's primitive returns enough metadata (path, cancellation reason, drop distance) for downstream hooks to read.
- No changes to validateAction (knockback isn't a player-proposed action — it's a side effect of resolution).
- The closed hook surface gains nothing from this ADR. Future modifiers (soft-landing, knockback-distance multipliers) are deferred to their first consumer.

## References

- `docs/roadmap-sessions-14-20.md`, Session 17 — flagged the policy decision.
- `docs/handoff.md` (session 17a) — recommended "cancel" policy and noted the upcoming knockback design.
- ADR-0027 — `system_damage` action shape, used for the falling-damage delivery.
- `docs/design/map-and-battlefield.md` — Jump-stat semantics that motivate the height-tolerance rule.
- `src/engine/map/knockback.ts` — implementation.
