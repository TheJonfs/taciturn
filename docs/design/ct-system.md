# Combat Time (CT) System

*Design document — v0.3*

## Purpose

The CT system governs turn order in tactical combat. Every active entity (units, charged actions, persistent effects with durations) accumulates CT each tick at its own Speed; on reaching the 100 threshold, it triggers — a unit takes its turn, a spell fires, an effect resolves. The system enables forward-projection of upcoming turns, which is fundamental to tactical planning.

## Rigid substrate

These are fixed by design. Modifying them would change the kind of game this is.

1. **Universal CT framework.** Anything time-bound — units, charged abilities, persistent effects — uses the same CT system, with the same threshold and accumulation rules.
2. **The 100 threshold.** Constant. Mathematically equivalent to making it variable (Speed scales linearly), but a fixed threshold keeps UI, telegraphing, and ability descriptions stable.
3. **Linear accumulation.** Each tick: `CT += Speed`. No curves, no nonlinear functions. Anything more complex undermines the player's ability to project upcoming turns.
4. **Bounded uncertainty in projection.** The simulator can always project "who acts in what order, given no new actions taken." Abilities may introduce uncertainty (e.g., "random ally gains +20 CT"), but the uncertainty must resolve to public information at a known time. Hidden or unbounded CT effects are out of scope.
5. **No direct threshold manipulation by abilities.** Speed multipliers and discrete CT pushes cover the full design space; exposing the threshold itself adds confusion without adding capability.

## Parameterizable elements

These have v1 default values but are modifiable globally (rules-level abilities/states) or locally (per-unit, per-action).

| Parameter | v1 default | Notes |
|---|---|---|
| Unit Speed | per-class baseline (TBD) | Modified by Haste/Slow multipliers, equipment, statuses |
| Action Speed (charged abilities) | per-ability baseline (TBD) | Same modifier surface as unit Speed |
| Move-only CT cost | TBD (~40-60) | CT subtracted after Move-only turn |
| Act-only CT cost | TBD (~60-80) | CT subtracted after Act-only turn |
| Move + Act CT cost | 100 | Full reset |
| Wait/Defend CT cost | 20 | Cheapest option, encourages tactical patience |
| Speed floor | 0 | Stop status sets to floor; no negative Speed |
| Speed ceiling | TBD | Cap to prevent runaway Haste stacking |

Specific values are tuning and will be revisited. The architectural commitment is that all of these are knobs, addressable by abilities and statuses.

## First-class CT operations

Three operation types are sufficient to span the design space:

1. **Speed multiplication.** `Speed *= modifier`. Used by Haste, Slow, statuses, equipment. Stacks multiplicatively (with a ceiling).
2. **Discrete CT pushes.** `CT += delta` (or `-=`). Used by Quick, Slow Action, riders on damage/heal abilities. Bounded at 0 below; can push above 100 (which simply means the next trigger is imminent).
3. **Speed floor/ceiling overrides.** Used by Stop (Speed = 0 for duration), edge cases. Different from multiplication because it's a hard set, not a relative change.

Riders on damage/heal actions (e.g., "deal less damage but reduce target CT by 20") are special-cased combinations of operation (1) or (2) with a normal action — no new primitive needed.

## Charged Actions

Charged Actions (spells, abilities, or items with non-zero cast time) are first-class entities in the engine. Like Units, they have a current CT value, an Action Speed (modifiable independently of the caster's Speed), and the same 100 trigger threshold. They appear in the projection queue alongside Units.

When a Charged Action triggers, it resolves and is removed from the active set. Treating them uniformly with Units yields two benefits: a single sorted projection queue for the upcoming-turns UI, and a clean target surface for abilities that operate on Charged Actions (counterspells, time abilities that hasten or slow a pending action, dispel-style effects).

The Charged Action retains references to its caster, target(s) at time of cast, and any state needed to resolve.

**Coordination with the Charging status.** When a Charged Action is created, the *Charging* status is applied to the casting Unit; when the Charged Action resolves or is canceled, the Charging status is removed. This pairing means abilities that target charging units (e.g., guaranteed-hit attacks against Charging targets) use the standard status hook surface, while abilities that target the Charged Action entity itself (counterspells, hasten/slow charge) use the projection queue. Both pathways are available; they target different things. See *status-effects.md* and *action-resolution.md* for the integration details.

Caster-interruption behavior (KO, displacement, status, target loss) is detailed in *action-resolution.md*.

## Tick simulation strategy

**Fast-forward to next event.** The simulator advances directly to the next entity that will hit the threshold, computed from current CT and Speed values. No per-tick iteration when nothing interesting happens between events.

Two timing references advance alongside event resolution:

- **Global tick counter.** Used for effects timed independently of any unit (battlefield hazards, weather, environmental cycles).
- **Per-unit CT.** Used for effects whose duration scales with the affected unit's tempo (FFT-style Poison ticking on the affected unit's CT cadence).

Status effects declare which reference they use; the engine resolves accordingly. Whether either, both, or neither is surfaced in the upcoming-turns UI is a UI decision, not an engine constraint.

**Tiebreaking** when multiple entities reach trigger in the same projected step proceeds in this order:

1. **Higher actual CT wins.** CT pushes can leave entities above 100 — a slower entity boosted past a faster one fires first. This is not just lexical ordering; actual CT can diverge meaningfully from "first to cross 100."
2. **Higher Speed.**
3. **Stable deterministic ID.**

## Design philosophy applied to CT abilities

The general principle (likely to be extracted to its own doc as it generalizes):

- **Pareto frontier is the default for player-facing customization.** Ability and build choices should be genuine tradeoffs, not strictly-better/worse comparisons.
- **Strictly-better belongs only at progression boundaries.** A higher-level ability replacing a lower one is fine as a progression reward, but an active loadout should never contain dead options.
- **Broad-but-weak vs narrow-but-strong is an axis distinct from raw power.** It carries archetype identity and is one of the main shapes a kit can take.

CT abilities are particularly dangerous because action economy compounds — over a long fight, "more turns" beats "stronger turns" if both are free. Therefore:

- CT abilities sit on the Pareto frontier with damage/healing. Paid for by spending the action itself, by stat profile (e.g., Time Mage as glass cannon), and/or by resource costs.
- **Self-buff CT** (e.g., self-Haste): moderate-broad — useful but not transformative, because it's reliable.
- **Enemy-debuff CT** (Slow, Stop): high-value-with-failure-risk — strong when it lands, costs something when it doesn't (resist chance, MP, charge time).
- **Burst CT** (Quick, Steal Time): narrow-and-strong — game-changing in tight situations, less impactful in dominant positions.
- **Tempo asymmetry** (cheap-Move-expensive-Act archetypes, or inverse): pure Pareto — redefines what a unit is good at without making it stronger.
- **Riders on damage/heal** (trade some damage for CT effect): Pareto by construction — explicit tradeoff at point of use.

## Decisions captured

- 100 threshold is rigid; Speed and CT pushes cover the design space.
- Linear accumulation; no curves.
- Public-resolution randomness in CT (e.g., "random ally +20 CT") is permitted; hidden/unbounded uncertainty is not.
- Charged Actions are first-class entities in the CT projection queue, equivalent to Units for engine purposes. The Charging status is applied to the caster while a Charged Action is outstanding, enabling both queue-targeting abilities (counterspells) and unit-targeting abilities (perfect-hit-on-Charging) to coexist cleanly.
- Tiebreaker hierarchy: actual CT > Speed > stable ID. Necessary because CT pushes mean "first to cross 100" and "highest CT" can diverge.
- Status durations may track in either global ticks or per-unit CT; both are supported. Effects declare which they use.
- Fast-forward simulation with both timing references advancing alongside event resolution.
- Riders that trade damage/heal for CT effect are in scope and use existing primitives.
- No direct threshold manipulation by abilities.

## Open questions / deferred

- Per-class Speed baselines and per-ability Action Speed baselines (tuning).
- Speed ceiling value (tuning, but should be picked early to bound Haste stacking).
- ~~Behavior of Charged Actions when the caster is interrupted (KO'd, statused, moved, target lost).~~ Resolved by ADR-0023: caster KO → fizzle; `onActionAttempted` block (Silence / Don't Act when shipped) → fizzle; Stop → pause via derived `computeActionSpeed = 0`; damage / movement → no interruption. Target validity per ADR-0023 follows BMG's "Interruption rules."
- Whether equipment and JP investments modify Speed.
- Whether to include a "tempo asymmetry" archetype in v1 or defer to later.
- Edge case: a Quick-style ability pushing a paused charge's CT past 100 currently still triggers (the scheduler's `ct >= threshold` shortcut wins). No v1 ability targets ChargedActions for CT push, so unhittable; tracked in ADR-0023 for the day a content consumer surfaces it.
