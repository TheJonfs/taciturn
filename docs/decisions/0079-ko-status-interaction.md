## ADR-0079: KO/status interaction — finite-duration statuses clear at KO; infinite-duration persist

**Status:** Accepted
**Date:** 2026-05-18
**Session:** 41

## Context

Session 39a (ADR-0076) introduced the KO ↔ revive lifecycle (Phoenix Down) and the permadeath timer, but left an adjacent question undefined: **what happens to a KO'd unit's other statuses at the moment of KO, and on revival?** S39's revive path resets HP, `turnsKOd`, and `ct` — and leaves statuses untouched. The KO transition path itself (`detectKO` in `reducers.ts`) ran the source-KO sweep (clearing statuses *sourced by* the KO'd unit, e.g. Taunted, Charging) and stripped in-flight ChargedActions belonging to the caster, but did nothing to statuses *on* the KO'd unit.

S40's playtest signal surfaced this as a real design hole. Two failure modes:

- **Lossy.** A Knight running into a Slow + Don't Move + Blind combo, then taking a KO, then revived — comes back still Slowed / Don't-Moved / Blinded with the full original duration. The revival is barely a recovery.
- **Sticky.** A unit with a short-duration buff (Combat Focus +1 PA for 3 turns) gets KO'd and revived; the buff persists. Less common but conceptually parallel — revival "preserves" something that wasn't supposed to outlive the encounter.

The implicit rule was "no rule," which leaned lossy in practice (most playtest-visible statuses are debuffs).

S41 settles the rule.

## Decision

**Statuses with infinite duration persist through KO and revival; statuses with finite duration clear at KO.**

The predicate is single-source-of-truth on the existing duration field:

```typescript
// src/engine/status/duration.ts
export function isInfiniteDuration(instance: StatusInstance): boolean {
  return instance.remainingDuration === null;
}
```

This is true for the four no-decay `DurationMode`s — `permanent`, `conditional`, `permanent_per_unit_ct`, `custom` — all of which `applyStatus.computeInitialDuration` stores as `null`. It is false for the three counted modes — `global_ticks`, `per_unit_ct`, `turn_based`.

Equipment-sourced status instances (per ADR-0028) are always applied with null duration; they fall on the infinite side and persist naturally. No separate kind-check is needed.

### Implementation: clear-at-KO sweep

At both `detectKO` sites in `reducers.ts` (ability damage path ~line 608; `system_damage` path ~line 1843), a new sweep runs as a sibling to the existing `collectSourceKoSweep`:

```typescript
function collectKoStatusClearSweep(state: GameState, koUnitId: UnitId): ProposedAction[] {
  const unit = state.units.get(koUnitId);
  if (unit === undefined) return [];
  const emissions: ProposedAction[] = [];
  const seenTypes = new Set<StatusTypeId>();
  for (const inst of unit.statuses) {
    if (isInfiniteDuration(inst)) continue;
    if (seenTypes.has(inst.typeId)) continue;
    seenTypes.add(inst.typeId);
    emissions.push({
      type: 'status_remove',
      source: 'system',
      payload: { targetId: koUnitId, statusTypeId: inst.typeId },
    });
  }
  return emissions;
}
```

The sweep emits one `status_remove` per affected `(target, type)` pair (de-duplicated). `removeStatus` strips all matching instances at once — STACK_INDEPENDENT or stacked cases collapse to one emission. Each emission lands as its own action-log line, preserving readability and replay determinism.

The clear runs *at KO transition*, not *at revival*. Two reasons: (a) Chris's framing ("KO should remove many statuses from the target when KO'd"); (b) action-log clarity — the clearing event happens at the KO moment, attributable to the action that delivered the KO, not at the revival action.

### Revival is unchanged

Phoenix Down's reducer in `applyConsumableEffects` continues to do exactly what S39 set down: HP=1, `turnsKOd=0`, `ct=0`, then heal layer. No status handling needed — the clear happened at KO, and any persistent (infinite-duration) statuses still on the unit are already present and functional. Auto-statuses (Regen-Auto from Tintinibar, Protect/Shell/Haste from future equipment, etc.) are implicitly handled by the rule: they have null duration, persist through KO, and become immediately functional on revival without re-grant logic.

### Belt-and-suspenders tick gating

The scheduler already filters KO'd units (per ADR-0076 — KO'd units are `'ko_unit'` entries and get `system_ko_tick` instead of `turn_start`), so onTick handlers don't normally fire for KO'd units. But for replay edge cases and to make the invariant explicit at the handler level, persistent-status onTick handlers gate on alive state:

- **Burn** (`custom` / `on_unit_ct_100`): already gated pre-S41.
- **Regen** / **Regen-Auto** (shared `regenOnTick`): gate added.
- **Poison** (`permanent_per_unit_ct`): gate added.

The pattern matches Burn's: `if (target === undefined || target.vitals.hp <= 0) return {};` at handler entry.

### Charging interacts with the source-KO sweep, not this one

Charging is `durationMode: 'conditional'` (null duration), so the new sweep skips it. But Charging is self-applied (source.unitId === caster) and its StatusEffectType has `removeOnSourceKO: true`, so the pre-existing `collectSourceKoSweep` already emits the `status_remove` for it. Both sweeps run at every detectKO site; they cover orthogonal cases without overlap on the cleared set.

## Rationale

**Why the predicate over a separate flag.** A `clearedByKO: boolean` field on `StatusEffectType` would add a per-type knob with three failure modes: (a) authors forget to set it on new statuses; (b) the default value (true? false?) is a contested implicit; (c) the field has no other consumer, so it's dead weight 99% of the time. Deriving from the existing duration field exploits the meaningful coincidence — *every* finite-duration status semantically expresses "transient situation that fades with time," and *every* infinite-duration status semantically expresses "persistent identity that fades only on explicit removal." Mapping the KO-clear rule onto that distinction is conceptually correct, not a coincidence we're exploiting.

**Why clear-at-KO, not clear-at-revival.** Chris's framing leans on the KO event being the "thing that strips you of your buffs and debuffs." Mechanically, both placements produce the same observable behavior (revival sees a clean slate of persistent statuses either way) — the difference is in the action log and in what the unit looks like during the KO window before revival (if any). Clear-at-KO is clearer: the action-log row sequence reads "Marach takes 78 damage → Marach KO'd → Marach loses Slow / Don't Move / Blind." Clear-at-revival would defer the clearing into the revival action's outcome, mixing two distinct things (the revive itself and the status reset) into one event.

**Why no special case for auto-statuses.** A KO'd unit with Regen-Auto from Tintinibar should resume regenerating on revival without any "re-grant" logic. The simplest way to guarantee that is to leave the auto-status on the unit through KO (it has null duration, so it's already on the infinite side of the rule), and rely on tick gating to suppress ticks during the KO window. This eliminates a class of "did we remember to re-apply auto-statuses on revival?" bugs entirely.

**Why three corner cases were accepted as-is.** Burn, Cataclysm Poison, and Magnetic Mark Vulnerable all encode as null-duration types (Burn `custom`, Poison `permanent_per_unit_ct`, Vulnerable `custom`) — they have lifecycle mechanics that don't decrement by time. Under the new rule, all three persist through KO+revival. This is a defensible trade-off:

- *Burn* / *Cataclysm Poison*: thematically defensible — "the burn / poison doesn't care that you went down; it'll keep eating at you when you come back." The KO window itself doesn't tick (per the gating), so the damage doesn't compound while down — only the stacks persist for post-revival ticks. Mechanically: Phoenix Down brings you back at 1 HP into Burn / Poison, which is a real tactical pressure on the Alchemist's revival timing.

- *Magnetic Mark Vulnerable*: the Aethurge's Marked-then-bursted target persists the mark through KO. Coverage-wise this is the most defensible: Magnetic Mark is meant to set up a follow-up. If a target gets bursted to KO, then revived, the mark surviving makes the follow-up still a viable play. If playtest reads this as too oppressive, the right lever is the Mark's interaction with damage, not the KO/status rule's universality.

The alternative — special-case these three into the "clear at KO" bucket — would either require a per-type override flag (re-introducing the dead-weight knob discussed above) or a hard-coded enumeration in the sweep. Both add complexity for a behavior the design can live with.

**Why finite stat buffs clear (D1).** Combat Focus's `+1 PA for 3 turns` clears on KO+revival under the rule. This is a minor design loss (an Alchemist's just-procced PA buff vanishes when they go down), but the alternative path — preserving stat buffs across KO — requires a `preserveStatBuff: boolean` flag that re-introduces the per-type dead-weight problem. The rule's clarity is worth the small loss. Conceptual model: persistent identity (infinite duration, equipment/class-derived) survives KO; transient situation (finite duration, proc/spell-derived) doesn't. If playtest reads Combat Focus's loss-on-KO as punishing, the lever is the buff's duration, not the KO interaction.

**Why finite stat debuffs clear (D2).** Symmetric with buffs. Spell-applied PA-Down / MA-Down (finite duration) clears on KO+revival; equipment-sourced stat shifts (always permanent / null duration) persist. The audit confirmed the existing `pa-down` / `ma-down` / `pa-up` / `ma-up` / `speed-down` types are all `durationMode: 'permanent'` — they're the *carrier* statuses for equipment grants, and the time-limited variants (Combat Focus for PA-up) use separate types. So the rule lands cleanly on the existing taxonomy.

## Consequences

**Substrate:**
- New module: `src/engine/status/duration.ts` (predicate).
- New private helper in `reducers.ts`: `collectKoStatusClearSweep`.
- Two two-line wirings at the existing `detectKO` sites.
- Tick gates on `regenOnTick` (covers Regen + Regen-Auto) and Poison's onTick. Burn already had its gate.

**Behavior:**
- Finite-duration statuses on a KO'd unit clear at the moment of KO. Each appears as a `status_remove` row in the action log, attributable to the KO event.
- Infinite-duration statuses persist through KO and revival. Auto-statuses functional immediately on revival without re-grant.
- The KO-clear sweep runs alongside the source-KO sweep at every detectKO site; they cover orthogonal cases (statuses sourced *by* vs statuses *on* the KO'd unit).

**Tests:** +N (TBD on landing) across `apply-remove`, integration suites, and tick-gating coverage.

**No action-log format change.** `status_remove` already has a formatter; the new emissions render with the existing template.

**No animator change.** `status_remove` is already an `ActionType` with animator wiring; the additional emissions ride the existing path.

**Action log readability.** A KO'd unit with three finite-duration statuses produces three additional `[Marach lost X]` lines after the KO row. This is informative (the player sees what carried over and what didn't), and the panel-side status display reflects the cleared set immediately.

**Replay determinism.** Preserved — the sweep is pure on `(state, koUnitId)` and emits actions in stable iteration order over `unit.statuses`.

## Alternatives considered

**Clear-at-revival instead of clear-at-KO.** Same observable effect on persisted statuses; differs in action-log structure and in what the KO'd unit looks like during the down window. Rejected per the action-log readability argument: the clear event belongs attributable to the KO, not the revival.

**Per-type `clearedByKO: boolean` flag.** Lets authors explicitly choose per-status. Rejected — adds dead weight for nearly every status, and the duration-derived predicate covers the design intent without per-type knobs.

**Hard-coded enumeration of clear-on-KO status types in the sweep.** Maximum control, minimum elegance. Rejected — the duration shape is *already* the semantic distinction; encoding it twice (once as duration mode, once as an enumerated list) is duplicated truth.

**Preserve all stat buffs, clear other debuffs.** The original framing in Chris's first pass. Rejected per D1's discussion — requires the dead-weight flag, breaks the predicate-only elegance, and the design loss (Combat Focus clearing) is small.

**Auto-statuses cleared at KO and re-granted at revival.** The "re-apply equipment status grants on revival" path. Rejected — adds revival-time logic, risks "did we re-grant all of them?" bugs, and the null-duration-persists path eliminates the problem class entirely.

**Special-case the three corner cases (Burn / Poison / Vulnerable) into the cleared bucket.** Requires the per-type flag or hard-coded list. Rejected per the trade-off in Rationale — the persistence is defensible (thematic for Burn / Poison; mechanically interesting for Vulnerable) and playtest can drive future refinement if needed.

## References

- `src/engine/status/duration.ts` — `isInfiniteDuration` predicate.
- `src/engine/actions/reducers.ts` — `collectKoStatusClearSweep`; wirings at the two `detectKO` sites (~lines 608, 1843).
- `src/content/statuses/regen.ts` — alive-state gate in `regenOnTick` (covers Regen + Regen-Auto).
- `src/content/statuses/poison.ts` — alive-state gate in Poison's onTick.
- `src/content/statuses/burn.ts` — pre-existing alive-state gate (precedent).
- ADR-0028 — equipment-sourced status grants (null duration, immune to in-battle removal; the infinite-duration persistence rule subsumes this naturally).
- ADR-0030 — `custom` durationMode (Burn, Vulnerable); the null-duration encoding the predicate keys on.
- ADR-0076 — KO state machine; permadeath timer; revival sequence (this ADR extends the KO transition path without touching revival).
- `docs/design/status-effects.md` — "Removal" section; the new KO-clear path is a removal trigger like duration expiry and dispel.
