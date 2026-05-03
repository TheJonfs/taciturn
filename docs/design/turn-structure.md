# Turn Structure

*Design document — v0.1*

## Purpose

This document defines the lifecycle of a *Turn* — what happens between the moment a *Unit*'s CT reaches the trigger threshold and the moment control passes to the next entity in the projection queue. It also covers the broader battle flow: battle start, win/loss conditions, end of battle.

Most of the architectural weight in turn structure was settled in the *Action Resolution* and *CT System* docs. This doc fills in the boundaries between actions and clarifies a few small choices that have been deferred.

## What is a turn

A turn is the period during which a single *Unit* makes its decisions after reaching CT 100. It begins with a `turn_start` system action, contains zero or more player or system actions, and ends with a `turn_end` system action. After turn_end, control passes back to the CT projection queue, which fast-forwards to the next entity reaching threshold.

```
┌────────────────────────────────────────────────────────────────┐
│ turn_start system action                                        │
│   - reset TurnBudget                                            │
│   - fire onTurnStart hooks (regen, status durations, etc.)      │
│   - check turn-skip conditions (Stop, Sleep — fire turn_end)    │
├────────────────────────────────────────────────────────────────┤
│ player decisions (any number, any order, until budget exhausted │
│ or Wait)                                                        │
│   - Move (consumes movesAvailable)                              │
│   - UseAbility (consumes actsAvailable)                         │
│   - Wait (zeroes remaining budget)                              │
│   - SetFacing (free; see below)                                 │
├────────────────────────────────────────────────────────────────┤
│ turn_end system action                                          │
│   - apply CT cost based on what was used                        │
│   - fire onTurnEnd hooks                                        │
│   - check win/loss conditions                                   │
│   - return to projection queue                                  │
└────────────────────────────────────────────────────────────────┘
```

## Turn start

Triggered when an entity in the CT projection queue reaches the trigger threshold. The engine fires a `turn_start` system action with the entity's ID. Resolution:

1. **Reset TurnBudget.** Default budget is `{ movesAvailable: 1, actsAvailable: 1 }`, modified by any active abilities/statuses that contribute at turn-start time.
2. **Fire `onTurnStart` hooks** in standard ordering. This is where:
   - Per-unit-CT statuses tick (Poison damage, Regen healing, duration decrements).
   - Turn-based statuses decrement.
   - Class-trait turn-start effects fire.
3. **Check turn-skip conditions.** If Stop, Sleep, or any other status that prevents acting is present, the turn proceeds directly to turn_end without player input. (Sleep typically wakes on damage; Stop has its own duration. Status mechanics specific.)
4. **Hand control to player or AI** for decision-making.

Note: charged actions reaching threshold trigger `charged_action_resolve` instead, not `turn_start` — they're entities in the queue but not units taking turns.

## Player decision phase

Between turn_start and turn_end, the active unit's controller (player or AI) commits actions. Each action goes through the normal action lifecycle (validate → resolve → log).

Order of Move and Act is free — FFT-style. Player can Act first, then Move; Move first, then Act; or just one. The TurnBudget enforces "one of each" by default; abilities can extend.

The player UI shows:
- Current turn budget (what's available)
- Cumulative CT cost preview (what the turn will cost when ended)
- Action options (highlighted by validation result)

The phase ends when one of:
- Player Waits.
- All budgets exhausted and player commits turn_end (UI prompts).
- Status forces immediate turn end (rare; e.g., Berserk's forced action might bypass user choice for the Act and immediately end turn).

## Set Facing

Direction-setting happens in two ways:

- **Implicit.** Movement updates facing to point in the direction of the last step. Attacks update facing to face the target.
- **Explicit.** A `set_facing` action lets the player override facing. Free to use, no budget consumption.

In FFT, the player gets one explicit facing choice at the end of the turn. We follow this convention: after all budgeted actions are taken (or Wait), the player has one final opportunity to set facing before turn_end commits. This is a minor UX flow but worth specifying.

If the player makes no explicit facing choice, the implicit-facing-from-last-action stands.

## Turn end

Triggered by Wait, by all budgets being exhausted and the player confirming, or by a forced end-turn condition. Resolution:

1. **Apply CT cost.** Based on what was consumed:
   - Both movesAvailable and actsAvailable consumed → full Move+Act CT cost (default 100, full reset).
   - Only movesAvailable consumed → Move-only cost.
   - Only actsAvailable consumed → Act-only cost.
   - Neither consumed (Wait) → Wait cost.
   - Custom budget configurations need explicit cost rules; default formula is "the highest cost matching what was actually consumed."
2. **Fire `onTurnEnd` hooks** in standard ordering. Statuses or class traits with turn-end behavior fire here.
3. **Check status durations.** Per-unit-CT statuses that haven't already ticked check expiry; durations counted in turns decrement here.
4. **Check win/loss conditions** (see Battle outcomes below).
5. **Return to projection queue.** The CT system fast-forwards to the next entity to reach threshold.

## Battle start

Triggered by transition into a battle GameState. Resolution:

1. **Initialize state** from configuration: place units at starting positions, assign teams, set initial CT.
2. **Apply battle-start effects** from class traits, equipment, terrain. (Some abilities or statuses might apply at battle start — defer specifics.)
3. **Initialize CT projection queue** with all units (and any pre-placed charged actions, environmental hazards with CT-based timing).
4. **Fire battle-start hooks** if any.
5. **Begin turn cycle.** The engine fast-forwards to the first entity reaching threshold; that entity's turn begins.

Initial CT values matter for first-turn order. v1 default: each unit's initial CT is between 0 and 100 derived from a stable function of (battle seed, unit ID, Speed) — fast-Speed units start with higher CT and tend to act first, with some variance to keep openings feeling distinct rather than purely deterministic. (FFT used roughly this; specific formula is tuning.)

## Battle outcomes

Win/loss conditions are evaluated at well-defined check points (turn_end is the standard one; some conditions also check on damage application, e.g., "objective unit defeated"). The Ruleset declares the conditions for a given battle.

Common conditions, declared as data:

- **Defeat all enemy units.** Default for most battles.
- **Defeat specific enemy unit(s).** Boss/objective patterns.
- **Survive N turns.** Defensive/escape patterns.
- **Reach specific tile.** Escape/objective patterns.
- **Protect specific ally unit(s).** Failure if they fall.

```typescript
interface VictoryCondition {
  side: TeamId;
  predicate: (state: GameState) => boolean;
  description: string;  // human-readable
}

interface RulesetVictory {
  conditions: VictoryCondition[];
  // first satisfied condition wins; ordering matters for tiebreaks
}
```

When a victory condition is satisfied, the engine emits a `battle_end` system action with the winning team. The GameState's `outcome` field is populated. No further actions process.

Defeat conditions (e.g., all your units fall) are typically the same predicate evaluated for the opposite team.

## Forced turns and AI

Several flows force action without normal player input:

- **AI-controlled units.** Same turn structure; the controller is an AI module rather than the UI. AI consumes the same TurnBudget, validates actions through the same path, commits through the same reducer.
- **Stop / Sleep / Don't Act.** Turn skips player input phase entirely; turn_end fires immediately after turn_start.
- **Berserk.** Player gets no Act choice; AI module picks an attack action against the nearest enemy. Move may still be available (Berserk in FFT lets the unit move toward target then attack).
- **Charm / Confuse.** Unit becomes temporarily controlled by opposing AI for the duration.

The architectural commitment is that all of these route through the same action lifecycle — only the controller (who chooses the actions) varies.

## Spectator and replay flows

Replay walks the action log forward, applying actions through the reducer to reconstruct state at any point. Because outcomes are stored on actions and resolution is deterministic, replay is straightforward.

For online/spectator views, the same flow applies: the spectator client receives committed actions and applies them locally. This is why immutable state, stored outcomes, and per-action seeds matter — they make every consumer's view of the battle reconstructible from the same log.

## Decisions captured

- A turn is bracketed by `turn_start` and `turn_end` system actions.
- Turn start: reset budget, fire onTurnStart hooks (status ticks, regen), check turn-skip conditions, hand control to controller.
- Decision phase: free order of Move/Act, governed by TurnBudget; ends on Wait, budget exhaustion, or forced end.
- Set Facing has both implicit (after movement/attack) and explicit (player choice at turn end, free) modes.
- Turn end: apply CT cost based on consumed budgets, fire onTurnEnd hooks, decrement turn-based status durations, check win conditions, return to projection.
- Battle start: place units, apply initial effects, initialize CT queue with semi-random initial CT values, begin first turn.
- Victory conditions are data on the Ruleset; standard check point is turn_end.
- Forced-action turns (Stop, Berserk, Charm, AI control) route through the same action lifecycle with different controllers.
- Replay walks the action log forward applying the reducer; outcomes stored on actions make this deterministic without re-rolling RNG.

## Open questions / deferred

- **Initial CT formula specifics.** Deterministic plus some variance; exact formula is tuning.
- **Charged action interrupted by KO.** What does the `charged_action_resolve` do if its caster is KO'd before resolution? Likely fizzles silently; needs `onChargeInterrupted` hook implementation. Punt to status/ability-design phase.
- **Reaction limits on KO'd units.** A unit KO'd mid-turn shouldn't react to subsequent damage; current design implicitly handles this via "actor exists and not KO'd" invariant on validation, but reactions go through a slightly different path — confirm.
- **End-of-battle cleanup.** When `battle_end` fires, what's preserved for the post-battle screen (unit final states, statistics, MVP, etc.) is a UI/progression concern. Defer.
- **Mid-battle save/resume.** Possible since GameState is fully serializable and the action log reconstructs state. Whether v1 supports it is a feature decision.
- **Per-turn reaction limits.** Mentioned in action-resolution as "default N=1 reaction per unit per turn." Where this counter resets — turn_end of the reactor, or turn_end of the original actor whose action triggered the reaction — needs concrete decision. Probably: at the reactor's own turn_start.
- **Turn timer for online play.** When we add online, turns probably need time limits. Defer.
- **Animation pacing during turns.** The renderer paces visual events by reading the action log and interpolating; specifics are renderer concerns. Worth flagging that turn boundaries are natural pacing points (the renderer can wait for "all animations from this turn complete" before showing the next).
