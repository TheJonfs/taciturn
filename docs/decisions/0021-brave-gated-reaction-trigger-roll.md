## ADR-0021: Brave-gated reaction trigger roll; Counter fires on attempt, not on connect

**Status:** Accepted (supersedes ADR-0019's "reactions trigger on hit, not on miss" consequence)
**Date:** 2026-05-06

## Context

ADR-0019 landed the `evasion_check` pipeline handler at the target stage and noted as a consequence: *"Reactions still trigger on hit, not on miss. The Counter check today gates on `damageDealt > 0`. A missed attack produces `damageDealt = 0`, so Counter doesn't fire — that's the correct behavior; you don't counter what didn't connect."*

The Battle Mechanics Guide describes Brave's role as the trigger probability for Reactions: `trigger_chance = Brave / 100`. A unit at Brave 100 reacts deterministically; lower Brave is probabilistic. FFT canonically allows Reactions to fire on attempt regardless of damage outcome (a Brave-passing Counter against a missed attack still counter-attacks).

ADR-0019's "fires on hit only" consequence was narrower than FFT's behavior. Reconciliation: in session 14, settling Counter's gating against the FFT canon and the BMG's Brave formula required both removing the `damageDealt > 0` gate and introducing the Brave roll as a generic per-reaction filter. Without the Brave roll, removing the gate would turn Counter into a 100%-on-every-attempt reaction, which is a regression — the BMG-prescribed probabilistic shape would be missing.

## Decision

**Two paired changes:**

1. **`runOnActionTargeted` rolls Brave per proposed reaction before enqueueing.** The runner reads the reactor's effective Brave through `modifyStatQuery` (so future buff/debuff statuses modifying brave compose), computes `trigger_chance = clamp(Brave / 100, 0, 1)`, and rolls per-reaction against a deterministic sub-stream of the action seed. Reactions that fail the roll are silently dropped before reaching `commitAction`'s reaction queue.

2. **Counter's gate flips: removes `damageDealt > 0`, keeps `'physical'` tag check.** Counter fires on physical UseAbility attempts targeting the reactor regardless of whether damage landed. Healing-tagged effects continue to skip Counter (a hypothetical hybrid `physical + healing` ability is not the canonical Counter target).

The combined effect on the demo: Knights at Brave 100 trigger Counter deterministically against any incoming physical attempt, which matches today's behavior since Knights' evasion 0/0/0 means every physical attempt currently lands. The change becomes observable when classes with non-zero evasion ship (a Thief in wave 2) or when Blind status reduces hit chance — both will produce miss outcomes that still trigger Counter.

## Rationale

**Why the Brave roll lives in the runner.** Reaction handlers (Counter, future Auto-Potion, future Reflect) all need the same Brave gating. Putting the roll in each handler duplicates the math and risks drift. The runner is the single chokepoint for "a unit is about to react"; gating there means every reaction inherits the probabilistic shape uniformly.

**Why per-reaction rolls, not per-handler.** A handler can propose multiple reactions (defensive against future content); the BMG's formula is "trigger chance per reaction trigger," not "trigger chance per registered hook." Per-reaction rolls give each proposed reaction an independent Brave roll. The seed sub-stream uses `seed XOR (BRAVE_REACTION_SUB_STREAM + i)` where `i` is the reaction's index in the proposed list — deterministic, replay-safe, and stays distinct from the variance roll (sub-stream 0) and evasion roll (sub-stream 1).

**Why short-circuit at Brave ≥ 100 and Brave ≤ 0.** Brave 100 is the test-unit baseline for deterministic reaction triggering; bypassing the roll keeps replay/test results bit-stable and avoids wasting an RNG draw the cap would round away. Brave 0 (impossible today; Stat caps clamp to [1, 100]) is documented as deterministic non-trigger for symmetry.

**Why Counter still gates on the `'physical'` tag.** Counter is the *physical-reaction archetype*; Magic Counter / Counter Magic are separate passives that gate on `'magical'`. Removing the physical gate would conflate the archetypes. Counter's healing-tag check (skip if `'healing'` is present) preserves the "don't counter heals" intuition.

**Why `damageDealt > 0` is no longer a gate.** It encoded "the Counter was meaningful only if damage landed," which is true for outcome (a Counter on a missed attack does nothing if the attacker is killed by the Counter regardless of whether the original attack landed) but wrong for trigger (the FFT canonical behavior fires Counter on attempt). The Brave roll is the correct probabilistic gate; `damageDealt > 0` was the wrong abstraction for the wrong purpose.

## Consequences

- **`runOnActionTargeted` gains a `seed` parameter.** Callers (today only `reduceUseAbility`) pass the per-action seed of the *incoming* action. The reducer already had the seed available on the action envelope.

- **ADR-0019's "Reactions still trigger on hit, not on miss" consequence is superseded.** The amendment is recorded here; ADR-0019's status remains "Accepted" because its primary decision (evasion_check at the target stage) is unchanged. The consequence list of ADR-0019 has a back-reference added to this ADR.

- **Counter's comment block updated.** The class-level comment in `src/content/abilities/counter.ts` now describes the FFT-faithful "fires on attempt, Brave-gated" behavior and references this ADR.

- **Demo behavior unchanged.** Knight evasion 0/0/0 + Brave 100 → every physical attack lands and every Counter fires deterministically. The only difference would be visible in a fixture with non-zero evasion or a Brave < 100 unit, neither of which exists in v1 content.

- **Determinism preserved across replay.** Same per-action seed → same Brave roll outcomes. The sub-stream constant (2) and per-reaction index folded together produce a unique sub-seed per reaction; replay reads the same outcomes from the action log without rerunning the rolls.

- **Future Magic Counter / Counter Magic / Auto-Potion inherit the Brave gate.** New reaction passives plugged into `onActionTargeted` automatically participate in the per-reaction Brave roll. Each can add its own internal gating (tag, status, threshold) on top.

## Alternatives considered

**Keep `damageDealt > 0` and skip the Brave roll.** Rejected — preserves the wrong gate (FFT-divergent) and skips the BMG-prescribed probabilistic shape entirely. Demo behavior would still be deterministic, but the design intent of "Brave matters for reactions" would be unimplemented even at the test-fixture level.

**Roll Brave inside Counter's hook handler.** Rejected — duplicates the roll across every reaction passive. Future Auto-Potion / Reflect would each need their own copy. The runner is the right chokepoint.

**Roll once per turn (Brave applies once for all proposed reactions).** Rejected — the BMG formula is "per Reaction trigger chance." A unit with two reactions registered should roll independently for each; treating all as one roll discards information. The reaction cap (one per turn) handles the "multiple reactions firing in sequence" concern at a different layer.

**Defer Brave roll until session 16+ when low-Brave content arrives.** Rejected — the gate change for Counter (no more `damageDealt > 0`) needs the Brave gate as its replacement filter. Shipping just the gate change without the Brave roll means Counter fires 100% on every physical attempt, which is a regression. The two changes are coupled and land together.

## References

- `docs/battle-mechanics-guide.md` — "Brave > Reaction trigger chance" section.
- `src/engine/hooks/runners.ts` — `runOnActionTargeted` with the Brave roll.
- `src/content/abilities/counter.ts` — Counter's flipped gate.
- `src/engine/actions/reducers.ts` — `reduceUseAbility` passes `action.seed` to the runner.
- ADR-0019 — `evasion_check` at the target stage; this ADR amends one of its consequences.
- ADR-0020 — magical damage formula (the parallel session 14 work).
