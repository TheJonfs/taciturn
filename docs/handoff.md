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

## From session 2026-05-06 (session 17b: Earth Mage part 2 + status side-effect infrastructure)

### Suggested next-session scope

**Session 17c — Knight expansion + equipment integration** (per `docs/roadmap-sessions-14-20.md`).

Equipment integration (per ADR-0014) is the foundational engine work:
- `Equipment` type on Unit; equipment-slot definitions on `ClassDefinition`.
- Equipped-weapon WP read at the physical base stage. Refactor `physicalPaWp` to compose `PA × WP × power_coefficient`. Existing `attack`'s power = 4 splits into `WP × coefficient` (e.g., long_sword WP 4 × ability coefficient 1).
- 1–2 starter equipment items: a stat-buff item (Strength Ring +1 PA) and a status-applying item (Boots of Haste — Haste while equipped). Tests the equipment-as-status-source path.

Knight Battle Skill expansion:
- **Power Attack** (single-target physical with extra coefficient).
- **Stasis Sword** (single-target physical that applies Stop with low chance — first content using the status-applier-on-physical pattern).
- A defensive ability — TBD between Taunt and a damage-reducer; plaintext review will pick.

Knight R/S/M:
- **Damage Reduction** support passive (multiplicative reduction on incoming physical damage; first consumer of a new `modifyIncomingDamage`-flavored hook... or composes via existing `onDamageReceived` with a multiplier; settle in plaintext).
- A class-flavored movement passive ("Slow but Steady" or similar — Knight-specific).

Plaintext-first review applies to: Power Attack, Stasis Sword, Knight defensive, Damage Reduction, the Knight movement passive, the two starter equipment items.

ADR-0028 (anticipated): equipment integration shape — the type, the apply path, the WP refactor.

The session 17b substrate that 17c inherits:

- **`system_damage`** is the symmetric counterpart to `system_heal`; equipment "thorns" (a future Cactuar-style passive that damages attackers) would emit through it.
- **`permanent_per_unit_ct` duration mode** lands; equipment "haste-while-equipped" can use plain `per_unit_ct` (since the status is anchored to equipment lifecycle, not to a duration timer). Equipment-driven status source is `'equipment'` rather than `'unit'` — the StatusInstanceSource.unitId can be null, which is already supported.
- **`onDamageReceived` emission shape** is in place; equipment with "wake-on-damage" or "consume-on-damage" semantics can plug in.
- **`onActionAttempted` `isReaction` flag** lets equipment-driven gates (a ring that suppresses voice abilities while equipped, etc.) distinguish player actions from reactions.
- **Knockback primitive** (`src/engine/map/knockback.ts`) is shipped but unused; Water Mage in session 18 is the first consumer. Knight expansion doesn't need it.
- **Earth Mage demo wiring is done** — the demo battle now has 1 Knight + 1 Earth Mage per side. Knight expansion in 17c may want to reshape the demo (more Knights with the new Battle Skill content, perhaps?) or leave it alone.

### Things noticed during the session

- **Renderer's `buildAnim` had a silent fallthrough bug.** Adding the new `system_damage` action surfaced it: the function's switch was missing cases for `system_heal`, `system_apply_status`, `status_remove`, `status_decrement_stack` (and now `system_damage`). Unmatched cases returned `undefined` (not `null`), and `startNext()`'s while loop checked `current === null` (not `null` or `undefined`), so unmatched actions left `current = undefined` and the next `tick` crashed on `a.elapsed`. Fix: explicit `return null` for all system-action types in `buildAnim`. **Worth a defensive `assertNever` exhaustiveness check** (a small follow-up — not session-blocking but the next time someone adds an action type they'll thank us).

- **Cataclysm test fixture lesson.** When a high-MA caster casts Cataclysm at the test fixture's default 60 HP target, the damage step KOs the target before the status branch runs, and `resolveAbilityEffect` skips `statusEffects` on KO'd targets. Tests for status application need to either (a) use a target with enough HP to survive, or (b) lower the spell's damage. The integration test bumped the test target to 200 HP. Worth noting in a future ability-content authoring guide so the same fixture issue doesn't keep recurring.

- **Sleep test fixture predicate.** The worked example uses `ctx.hit` rather than `ctx.finalDamage > 0` because `fireOnDamageReceived` runs at the target stage, before `finalize` settles `finalDamage`. When a real Sleep status ships (session 18+ tentative), the predicate may want to refine to "damage actually applied" — that requires either reading `ctx.baseDamage` + considering downstream stages, or moving the wake-on-damage fire to a post-finalize stage. Documented as future work in ADR-0027.

- **AoE `applyCasterEffects: false` + caster-target effect throws.** v1 has no consumer; if a future Earth-style ability needs "AoE damage *plus* a self-buff for the caster," the dispatcher needs a once-per-cast caster-effect application step. Earth's existing kit doesn't trigger this; Knight expansion in 17c is unlikely to either; surface when it does.

- **Default ruleset's `chargedActions.pausingStatusTypeIds`** still lists only `stop`. If a new pausing status arrives (Sleep would be a candidate — a Sleeping caster's spell pauses while they're asleep), the ruleset gains an entry. v1 default is correct for current content.

- **Movement Debuff has no `resistanceTag`.** It used to (the type was tagged `'earth'` in the type's `tags`), but it doesn't have a `resistanceTag` field. Earth Quake's Movement Debuff rider rolls without any resistance check today. When 'earth' resistance content arrives (a future passive like "Earth-Walker" granting +50 earth resistance), the status type needs `resistanceTag: 'earth'` added so the formula reads it. v1 is fine — no unit has earth resistance yet.

### Things considered but did not do

- **A new hook for "react to system_damage"** (e.g., a Counter-flavored reaction that fires on Poison ticks). Considered: would let "poison-trigger reflex" abilities ship. Rejected: v1 has no consumer; the architectural surface stays closed until a content consumer needs it. The structural answer is "add a hook then" — not "leave a flag for later."

- **Refactoring `runOnDamageReceived` to require the wrapper return shape** (instead of accepting both bare-ctx and wrapped). Considered: type-uniformity argument. Rejected: existing tests use bare-ctx returns; backward compat keeps them passing. The runner's normalization is one branch — small cost.

- **Sleep as v1 content.** The ADR-0027 worked example is a *test fixture*, not a shipped status. Sleep ships when a class needs it (Lightning's Crit_modifier interacts with Sleep, but Lightning lands in session 20). Surfacing the emission shape now lets 17b's content (Earth's Cataclysm + non-expiring Poison) prove out the broader pattern without committing to one specific status' tuning.

- **Multi-status reaction-cap accounting under AoE.** A future "Counter that fires multiple times per turn" would interact with the per-unit-per-turn cap; today the cap is per reactor regardless of source action. v1 default cap is generous enough (3 per turn in test rulesets) that this isn't load-bearing.

- **A separate `applyKnockback` reducer** (rather than a pure function). Considered: structural symmetry with other engine effects. Rejected: knockback is a side effect of an effect, not a player-proposed action. Pure function is the right shape; the first ability consumer (Water Mage's Base spell in 18) will call it inline during effect resolution.

- **Earth Communion in the Cataclysm test fixture.** Adding Earth Communion to the caster would push the status-application chance well above the [0, 1] clamp regardless. Cleaner to test the formula in `session-16-integration.test.ts` (where Earth Communion is the focus) and the Cataclysm AoE in 17b without it.

### Open questions for later sessions (not blocking)

- **Earth resistance content.** No v1 unit has 'earth' in their resistance map; Earth's spell tag-set goes through resistance_check with no effect. When 17c (or wave 2) adds a class with elemental resistance, Earth's damage interacts. Watch for the "Earth-Walker" or "Stone Skin" passive design around then.

- **AoE shape modifier consumer.** `modifyAoeShape` is in place but not consumed. Fire Mage's "larger AoE" rider in session 19 is the planned first user. If 17c's Knight content surfaces an unexpected use case (e.g., a Cleave Helm passive that turns single-target attacks into cross-shape — interesting but not in the 17c shortlist), the hook is ready.

- **Don't Act + reaction interaction edge case.** Counter on a Don't Act unit fires correctly; what about a Counter that itself spawns a sub-reaction (the chain would be Attack → Counter → Counter-back). The current cap is 3 per reactor per turn, so this self-limits. If a tighter "no reaction reactions" semantic is wanted, it'd be a new flag on the reaction definition (lands when content surfaces it).

- **Falling damage tag composition.** ADR-0026 falling damage is tagged `'physical'` and goes through `system_damage`'s flat path (no resistance composition). Should a "spider class" with fall-damage immunity get to gate this? Today the route is via a future hook (TBD); for v1 it's flat damage. Surface when a class needs it.

### Notes for future ADRs

- **ADR for equipment integration** (anticipated 17c) — the Equipment type, slot definitions on ClassDefinition, the WP refactor at the physical base stage. ADR-0014 anticipated; the 17c implementing ADR captures shape decisions.

- **ADR for Sleep status when it ships** — the worked test fixture is the canonical pattern; the formal Sleep ADR captures wake-on-damage tuning (predicate refinement: damage > 0 vs. ctx.hit; interaction with fortitude / immunity passives).

- **ADR for AoE caster-target effects** if a session 18+ ability needs "AoE damage + self-buff." The dispatcher's once-per-cast caster-effect handling is one block to add; the ADR captures the shape decision when it ships.
