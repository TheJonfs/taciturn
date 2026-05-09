# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-09 (session 20: Lightning Mage)

### Suggested next-session scope

**Session 20a — AI tier 1.5 + grand handoff.** Per session 19's handoff agreement, AI was deferred to a follow-up sub-session. Session 20a's deliverables:

1. **AI tier 1.5 heuristics** (per `docs/roadmap-sessions-14-20.md` "Session 20"):
   - Status-aware target selection (don't magic-attack Reflect-buffed targets — Reflect not yet shipped, but the AI should be agnostic to specific status names; check for damage-blocking conditions before attacking).
   - Reaction-aware planning (don't walk into Counter chains; weight target choice by reaction-trigger probability).
   - AoE handling (evaluate AoE by total expected damage across the cluster, including friendly-fire penalty).
   - Stat-aware damage projection (use the real damage formula via `runDamagePipeline`-derived computation, not the stripped-down approximation in `decideBasicAi`).
   - Two-action turn planning (consider Move + Act combinations, not independent evaluation).
   - Lightning-specific AI awareness: setup → exploit (Magnetic Mark turn N → Lightning Strike turn N+1), self-damage avoidance (don't suicide-cast Storm Caller below the self-cost), Static Embrace target selection (buff a high-damage ally before they cast).

2. **Grand handoff document for planning sessions.** A comprehensive snapshot of the state of the project at the close of session 20 — the content surface, the engine surface, the deferred items, the design questions that have surfaced. Lives in `docs/progress.md` per the existing discipline (refreshed periodically, not per-session). The session 20a writer should consolidate the handoff items below + the recently-closed work into the durable progress doc, ready for wave-2 planning.

ADRs anticipated for session 20a:
- ADR for AI tier 1.5 heuristic ordering (which checks run first, how cluster-damage projection composes with friendly-fire penalty).

The session 20 substrate that 20a inherits:
- **Crit infrastructure** (`crit_chance` / `crit_multiplier` `StatName`s; `crit_roll` damage handler at variance stage). The AI's damage projection should account for `expected_damage = base × (1 + (crit_chance/100) × (crit_multiplier - 1))` when crits are non-zero.
- **chainBonus** on `DamageSpec`. AI's AoE evaluation should fold in the cluster-size scaling — a 3-cluster Chain Lightning hits 25% harder per target than a 1-cluster.
- **selfDamage** on `ActiveAbilityDefinition` + `ability_self_cost` `SystemDamageSource` variant. AI should subtract the self-cost from the cast's expected value AND avoid casting when the cost would self-KO.
- **Vulnerable** (custom-trigger `'on_damage_received'`). AI's setup→exploit chain awareness uses this — and any future status with `customTrigger.kind === 'on_damage_received'` plugs into the same evaluator.
- **Magical reactions confirmed** (no engine work needed). Counter only fires on physical; Discharge fires on any tag. AI's reaction-trigger probability check should consume the reaction compiler's `damageTagsAny` / `damageTagsNone` filters, not assume physical-only.

### Things noticed during the session

- **Pre-existing Burn fan-out bug at [reducers.ts:1259](src/engine/actions/reducers.ts:1259).** The active-unit `turn_start` fan-out generates `status_tick` for `per_unit_ct` and `permanent_per_unit_ct` durations, but NOT for `custom + customTrigger.kind === 'on_unit_ct_100'`. Burn uses `custom`, so Burn never actually ticks on a Burned unit's normal turn. The skipped-turn fan-out (line 1231) DOES include the custom case, so Burn ticks on a Stop'd unit — inconsistent. Discovered while planning Vulnerable's `'on_damage_received'` trigger (which uses a different surface — `onDamageReceived` in the damage pipeline — so it's not affected). **Real correctness bug, deferred from session 20 because orthogonal scope.** Fix: extend the line 1259 condition to mirror line 1231 (or extract to a `shouldTick` predicate read by both fan-outs). Session 19 integration tests don't catch this because they drive Burn via direct `applyStatus` and direct `reduceStatusDecrementStack` calls rather than through `turn_start`. End-to-end demo runs likely never landed Burn's tick — flag for next session.

- **Reaction-on-charged-resolve bug fixed inline.** Pre-session-20 `reduceUseAbility` threw "no turn in progress" when called with `state.turnState === null`. This was reachable only via reactions chained off a `charged_action_resolve` (where there's no turn). Counter avoided it because its compiler filters to `'physical'` damage and charged abilities are magical; Discharge's any-tag filter exposed the gap. Fixed: the no-turn check now skips when `action.isReaction === true`, and `decrementActBudget` is also skipped for reactions or no-turn states. Captured in ADR-0032's "Magical reactions" section + a regression test in `session-20-integration.test.ts`.

- **Storm Caller's 25% maxHp self-cost is uncapped at the floor.** A Lightning Mage at 11 HP casting Storm Caller drops to 0 (KO'd by their own cost). This is intentional design — the cost is a real risk-taking lever — but worth flagging for tuning. The dispatcher's `caster.vitals.hp > 0` guard before emission means the cost only fires while alive; the actual KO from cost is `system_damage` floor-at-0, which is correct.

- **Crit and Vulnerable compose multiplicatively, no cap.** Final damage = `base × variance × resistance × vulnerable × crit`. A Lightning Mage with Static Embrace-buffed ally lands a Magnetic Mark, then crits through Vulnerable: ×1.5 × ×1.5 = ×2.25 effective. Plus Conductor's MA × 1.25 in the base, plus Lightning Strike's premium power 12. Burst damage potential is ~12 × 8 × 1.25 × 0.64 (Faith) × 1.5 × 1.5 = ~108 — sufficient to one-shot a Mage. The numbers aren't broken — Lightning's identity is "burst when the setup lands" — but post-session-20 calibration may want to soften crit composition or cap Vulnerable+crit multiplicatively. Not v1-load-bearing; flag for the post-session-20 retune.

- **Pre-existing TS strict-mode errors in test files** (carried from sessions 17c, 18, 19 handoffs). Still not addressed; `npm test` passes via Vitest's loose mode. `tsc -b --noEmit` surfaces them but they're pre-existing. Worth a session of cleanup at some point — defer until a natural lull.

### Things considered but did not do

- **Capping crit_chance at 100.** Considered but rejected — the runtime comparison `r < crit_chance / 100` simply means `r < 1+` always succeeds when crit_chance > 100, which is the correct outcome (guaranteed crit). No bug, no waste. If a future passive stacks crit_chance into pathological territory, a soft cap on `modifyStatQuery` results would be the right place — not a hardcoded clamp in the handler.

- **Splitting Storm Caller's "×4 damage" into a separate `power_multiplier` field.** Considered alongside baking power 36 directly. Rejected per Chris's explicit call: with one v1 consumer, the field doesn't earn its keep. If a second consumer ships a power-multiplied form, decompose then.

- **Routing self-damage through the seven-stage pipeline.** Considered (would compose with caster's own resistances, would let Counter fire on the caster's own self-hit). Rejected — self-cost is a *cost*, not a *hit*. A Lightning Mage shouldn't be able to Counter their own Storm Caller; a lightning-resistant caster shouldn't dodge their own ultimate. The labeled `system_damage` shape is the right mental model.

- **A new `onSelfDamage` hook.** Considered as the avenue for a future preventer. Rejected — the existing `onActionAttempted` hook already runs against every action including system actions, and the labeled `payload.source.kind === 'ability_self_cost'` lets a preventer match precisely. No new hook surface needed; a future content consumer demonstrates the avenue when one ships.

- **Multiplicative MA buff status form (parallel to Conductor passive).** Considered alongside Conductor. Rejected — no spell in this kit applies a multiplicative MA buff. Conductor as an equipped passive covers the design intent. If a future content consumer wants a temporary multiplicative MA buff (a "Lightning Catalyst" status, etc.), the status form ships then.

- **Vulnerable's resistance tag as `'magical'` rather than `'lightning'`.** Considered for symmetry with Fire's PA Down / MA Down (which use `'fire'`). Picked `'lightning'` for parity with Magnetic Mark's caster element — consistent with Fire's pattern. If a future content consumer wants a non-element-flavored Vulnerable, a parameterized resistance tag on the status definition would extend it.

- **Discharge filtering by damage tag (excluding magical).** Considered and rejected — the whole point of Discharge in session 20's plaintext review is "magical reactions confirmation." Filtering would obscure the test. The Discharge tag-agnostic shape exposes the reaction-on-charged-resolve bug, which is good — better to surface and fix than to silently never trigger.

- **Fixing the Burn fan-out bug inline.** Considered — the fix is one-line. Rejected — it's session 19 territory, my session 20 scope is content + crit/chain/self-damage substrate. Sometimes "leave the foreign drop in" is the right call; surfacing it in the handoff is the action that fits scope.

### Open questions for later sessions (not blocking)

- **Crit cap.** No explicit cap on `crit_chance` (>100 always crits) or `crit_multiplier` (no upper bound). v1 has no content that pushes either past sensible values. If progression / equipment later allows crit_chance stacking past 100, decide whether to soft-cap at the `modifyStatQuery` boundary or let "guaranteed crit" be a real outcome.

- **Crit on healing.** v1 design: heals don't crit. If a future "miracle heal" mechanic wants crit-flavored heals, the handler's `if (ctx.damageTags.has('healing')) return ctx;` line moves to its consumer.

- **Caster-target self-damage with effects.** Storm Caller's self-cost is just a `system_damage` against the caster. If a future ability wants "self-damage AND a debuff applies to caster" (e.g., a "Berserker Rage" ultimate), the dispatcher would need to chain through the apply-status path against the caster — doesn't exist today. Surface when the consumer ships.

- **chainBonus on healing.** No v1 healing AoE wants cluster-size scaling. If one ships, the helper extends to `healing_base`.

- **Self-cost scaling with caster's max-HP buffs.** Storm Caller reads `caster.baseStats.maxHpBase` (the stored value), not `runModifyStatQuery(... 'maxHp', ...)`. So Iron Helm (+20 maxHpBase) increases the self-cost (correct — bigger HP pool, bigger cost), but a future "Maxed HP +20%" status would NOT increase the cost. v1 has no such status; decide when one ships.

- **Vulnerable double-fire in chain ordering.** Documented edge case in ADR-0032 — if two damage events hit a Vulnerable target before the first `status_remove` processes (e.g., AoE that hits the same target twice via dedup-bypass; or a chain where a reactor counters and the counter targets the original Vulnerable holder), the multiplier would fire twice. v1 reaction patterns don't create this case (Counter targets the attacker, not the original target); flag if a future content consumer creates it.

- **Magnetic Mark's actionSpeed 35 vs the rest of the kit.** Deliberately slow per Chris — the player should be able to plan a follow-up exploit. AI tier 1.5 should know this — a "Magnetic Mark, then setup another spell mid-charge" sequence is the kit's tactical signature. Tier 1.0 will probably mis-evaluate this.

- **`reactor` semantics in `reduceUseAbility` for reactions.** The fix skips the no-turn check + budget decrement when `isReaction: true`. The reactor isn't the active unit — they consume MP from their own pool, not the active unit's. v1 reactions are MP-free, so the MP deduction `actor.vitals.mp - ability.mpCost` reads from the reactor (correct). If a future MP-costing reaction ships, verify the right unit pays.

### Notes for future ADRs

- **No new ADRs anticipated for session 20a's AI tier 1.5 work** unless the heuristic ordering surfaces a real architectural decision (e.g., new hook surface for "AI projection" — currently the AI just reads state directly). A heuristic ordering convention captured in `src/ai/basic.ts` comments is sufficient.

- **Burn fan-out fix is one-line; an ADR is overkill.** Direct fix + commit message is the right shape. Note in the commit that the line 1259 condition should mirror line 1231.
