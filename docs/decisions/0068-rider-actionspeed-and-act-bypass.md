## ADR-0068: `riderSource` bypasses `actionSpeed` charge + Act budget

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 30 (ADR-0064) introduced `riderSource: UseAbilityRiderSource` on `UseAbilityPayload`. When set, three gates are bypassed:

1. **MP affordability** (`validateAction`) — the weapon pays, not the wielder.
2. **MP deduction** (`reduceUseAbility`) — same rationale; `mpSpent: 0` outcome.
3. **`onActionAttempted` pre-hooks** (`runPreHook` in `commitAction`) — Silence / Stop / Don't Act on the wielder don't gate a rider cast.

Session 31 ships Bolt Hammer with `attackProcs: [{ chance: 0.25, abilityId: 'lightning_strike' }]`. Per Session 31 decision 4 (with Chris): use the existing first-level `lightning_strike` ability directly via `abilityId` so the display name flows automatically and future renames propagate. But `lightning_strike` has `actionSpeed: 30` — a charged spell. The current reducer's `actionSpeed > 0` gate would route the rider through `commitCharged`, parking a Lightning Strike charge on the rider path's emission — not "fires Lightning Strike at the target" but "queues a Lightning Strike charge that resolves in ~3 ticks." Not the intended behavior.

Session 31's first end-to-end demo loadout (Blue Knight with Bolt Hammer) also surfaced a second blocking gate: after the original swing, the wielder's `actsAvailable` budget is 0. The proc's `use_ability` emission hit the validator's "No Act budget remaining this turn" rejection. Same conceptual issue — the wielder paid for the swing; the rider proc fires off the swing.

## Decision

**Rider casts (`riderSource !== undefined`) additionally bypass two more gates:**

**(1) `actionSpeed` charge path.** `reduceUseAbility`'s charge gate is widened from `if (ability.actionSpeed > 0)` to `if (ability.actionSpeed > 0 && !isRider)`. Rider casts resolve through the instant path regardless of the underlying ability's authored `actionSpeed`. Bolt Hammer's Lightning Strike proc fires instantly at the target, not as a queued charge.

**(2) Act budget validation + decrement.** `validateAction`'s `actsAvailable > 0` check is gated to `!isRider`; rider casts use `getActorIfActive(state, action.actorId)` (just verifies the actor exists and isn't KO'd) rather than `getCurrentTurnActor` + budget check. `reduceUseAbility`'s `decrementActBudget` call is gated to `!isReaction && !isRider`. The wielder paid for the swing's Act; the rider proc fires off the swing's resolution.

Together with ADR-0064's three bypasses, `riderSource` now controls five sites:

| Gate | Site | Bypass rationale |
|---|---|---|
| MP affordability | `validateAction` | Weapon pays |
| MP deduction | `reduceUseAbility` | Weapon pays |
| `onActionAttempted` | `runPreHook` / `commitAction` | Weapon casts, wielder's status veto-handlers don't apply |
| `actionSpeed` charge | `reduceUseAbility` (this ADR) | Proc fires off the swing; charging would defer it |
| Act budget validation + decrement | `validateAction` / `reduceUseAbility` (this ADR) | Wielder paid for the swing's Act |

## Rationale

**Same conceptual framing as ADR-0064.** "The proc is the weapon's power, not the wielder's" generalizes cleanly to "the proc rides the swing's commit, not the wielder's resources." Charge time and Act budget are wielder resources; the rider doesn't bill them.

**One-line gates instead of new substrate.** Each bypass is a one-line `&& !isRider` on an existing gate. No new hook surface; no new field shape; no new emission lane. Cheapest possible substrate that achieves the design.

**The `actionSpeed` bypass enables option A from Session 31's decision 4.** Without it, Bolt Hammer would need a sibling `lightning_strike_proc` ability with `actionSpeed: 0` — a content workaround for an engine limitation. With the bypass, Bolt Hammer's `attackProcs[].abilityId: 'lightning_strike'` references the literal first-level spell. Display name flows automatically; future renames propagate; one source of truth for Lightning Strike.

**The Act bypass surfaced from playtest reality.** Session 30's ADR-0064 didn't surface the Act gate because no v1 test exercised a procced rider during a turn where the wielder had already swung. Session 31's Blue Knight + Bolt Hammer + first integration test surfaced it immediately. Now codified; future bypass-adjacent changes have a clear precedent.

**Skipping Act decrement matters for replay correctness.** If a rider proc *consumed* an Act, a Knight with one Act could never proc (the swing pays the Act, the proc would try to pay an Act they don't have, and the chain rejects). Either procs short-circuit silently — bad for replay determinism (the proc emission still happened) — or procs throw — worse, breaks legitimate gameplay. Bypass is the clean answer.

**The bypass is keyed off `riderSource`, not a new flag.** Sibling pattern to ADR-0064's wrapper — one piece of state controls all rider behavior. A future content path that wants instant non-rider casts of a charged ability would need its own decision and shape; this ADR doesn't generalize "skip charge" beyond riders.

## Consequences

- **Bolt Hammer's Lightning Strike proc fires instantly** — no charge queued; no Charging status applied to the wielder mid-proc; the procced cast's damage lands on the same chain depth as the swing's damage.
- **The rider Act bypass means a single physical swing can drive multiple effects** — swing damage + proc damage + Rasp Pendant MP drain, all in one Act. Sibling to the existing reaction model (Counter fires off an enemy attack without consuming a turn).
- **Replay parity preserved.** The bypass is deterministic given `(state, action, seed)`; same inputs produce same instant-vs-charge decision (always instant when `riderSource` is set).
- **Procs share chain-depth with reactions** (per ADR-0064 — unchanged). A Bolt Hammer Knight attacking a Counter-equipped enemy can swing → proc Lightning → Counter → resolve chain — all within the depth-8 cap.
- **Charging via a rider is now impossible.** If a future content path *wants* a procced charged cast (rare; would be a delayed-payoff weapon effect), it needs to author a sibling ability with `actionSpeed: 0` and a manual `system_apply_status` for the Charging-style effect, rather than relying on the underlying spell's authored `actionSpeed`. v1 has no such consumer.
- **System actions emitted from a rider still skip `runPreHook`** (ADR-0064) — `source: 'system'` plus `riderSource` set means both gates short-circuit the pre-hook firing. Belt-and-suspenders; either gate would suffice today.
- **Loadout Act budget surfaces unchanged.** A Knight with one Act per turn still swings once; the swing's proc rides through without exhausting the Knight's next-turn Acts. The Act decrement happens on the swing, not on the rider.

## Consequences for the rider bypass set

The five-site bypass machinery now keyed off `riderSource` has reached the point where it deserves a one-helper read site rather than a literal `!== undefined` check at each gate. Not refactored in this ADR — the bypasses live at five distinct files (`validate.ts` Act, `validate.ts` MP, `reducers.ts` MP, `reducers.ts` Act, `reducers.ts` actionSpeed, `commit.ts` pre-hook). If a sixth gate surfaces, fold into a `isRiderCast(payload): boolean` helper and update all sites at once. Tracked as a quiet refactor for a future polish session.

## Alternatives considered

**Author a sibling `lightning_strike_proc` ability with `actionSpeed: 0`.** Rejected — would split Lightning Strike into two definitions, requiring sync if power, MP cost, tags, or range ever shift. The display name would either bind to a constant (loses the "rename Lightning Strike, watch Bolt Hammer follow" property) or drift silently. Engine-side bypass is cleaner.

**Keep charge behavior on rider; let the Lightning Strike charge on the target's CT.** Rejected — the equipment doc and Chris's design call explicitly say "fires a Lightning spell at the target" on the swing, not "parks a delayed Lightning spell on the target." Behaviorally wrong.

**Make `actionSpeed: 30` on Lightning Strike conditional / context-aware.** Rejected — `actionSpeed` is a static field on the ability. Making it dynamic would require a new authoring shape and a callback dispatch at every cast site. Not worth it for one bypass case.

**Don't bypass Act budget; force procs to consume a separate "proc Act" budget.** Rejected — adds a new budget axis (perUnitPerTurnProcs) with no v1 use case. Existing chain-depth + reactor-cap machinery already bounds the chain. Reserve for future-pacing concerns.

**Validate Act budget only at the turn-start side, never mid-chain.** Considered — would obviate this specific gate. Rejected: the broader validation contract (a unit can't act when its budget is 0) is load-bearing for player UX (the Action menu is gated on `actsAvailable > 0`). Carving an exception for riders is narrower than reshaping the validation surface.

**Add a `chargeBypass: true` field to `AttackProcDef`.** Rejected — would push the bypass decision onto the content author per proc. The rider-cast machinery is the engine's decision: rider casts ARE instant. Content shouldn't pay the schema complexity for what's a uniform engine rule.

## References

- `src/engine/actions/reducers.ts:reduceUseAbility` — `actionSpeed` charge gate (`isRider` bypass) + Act budget decrement (`isRider` bypass).
- `src/engine/actions/validate.ts:checkUseAbility` — Act budget validation (`isRider` bypass).
- `src/engine/actions/commit.ts` — `runPreHook`'s rider bypass (ADR-0064 sibling).
- `src/engine/actions/session-31-integration.test.ts` — rider charge bypass + actsAvailable bypass tests.
- ADR-0064 — `attack_proc` substrate; original three rider bypasses (MP × 2 + Silence).
- ADR-0065 — `onFinalDamage` + `system_mp_drain` (Session 30 sibling).
- Session 31 plan-review decision 4 (Bolt Hammer reuses `lightning_strike` via `abilityId`).
