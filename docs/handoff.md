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

## From session 2026-05-06 (session 17a: AoE substrate)

### Suggested next-session scope

Session 17 was split into 17a/17b/17c per the user's call mid-session. 17a (this session, just landed) is the engine substrate: AoE per-target dispatch, per-target seed branching, `modifyAoeShape` hook, vertical tolerance enforcement, reaction-cap accounting fix. ADR-0025 captures the decisions.

**Session 17b** — Earth Mage (part 2) + new statuses. Per `docs/roadmap-sessions-14-20.md`:

- Earth's AoE spell (Cross-shape damage + Move/Jump debuff rider) and Ultimate (Cross-shape with Poison + Don't Act + Don't Move).
- New status types: **non-expiring Poison** (no duration tick, cleared by ability/item), **Don't Act**, **Don't Move**, content **Stop** (the engine Stop already exists for Charging interaction; this is the content-side debuff).
- Knockback / forced movement (lay groundwork; Water Mage in 18 is the heavy user). Forced movement collision policy decision: recommend "cancel" per the roadmap.
- **`onDamageReceived` emission shape extension** — Sleep's wake-on-damage is the canonical worked example. v1 doesn't have Sleep yet, but the pattern lands here cleanly so 17b's content can opt in. Shape: `OnDamageReceivedResult = { ctx: DamageContext; emittedActions?: ProposedAction[] }`. Backward-compatible with handlers that just return `ctx`.
- Plaintext-first review for the AoE/Ultimate ability designs and the four new statuses.

**Session 17c** — Knight expansion + equipment integration (per ADR-0014).

- Equipment integration: `Equipment` type on Unit, equipment-slot definitions on classes, equipped-weapon WP read at the physical base stage, refactor of `physicalPaWp` to compose `PA × WP × power_coefficient`.
- Knight Battle Skill expansion: Power Attack, Stasis Sword (status applier — applies Stop with low chance), defensive ability.
- Knight R/S/M abilities: Damage Reduction support, class-flavored movement passive.
- 1–2 starter equipment items: stat-buff (Strength Ring +1 PA), status-applying (Boots of Haste — Haste while equipped).

The session 17a substrate that 17b/17c inherits:

- **`AoeSpec` on `AbilityEffects`** is the canonical AoE author surface. Earth's AoE/Ultimate set `effects.aoe = { shape: { kind: 'cross', radius: 1 } }` and the dispatcher handles per-target fan-out automatically. Per-effect `target: 'caster'` rejects under AoE today — surface if a future ability needs both.
- **`perTargetSeed(actionSeed, targetIndex)`** is the convention for per-target RNG independence. `targetIndex === 0` is identity (single-target callers see no RNG drift). Earth's AoE/Ultimate inherit per-target seed branching automatically by routing through the dispatcher.
- **`modifyAoeShape` hook** is the engine surface for shape-modifying riders. Fire's "larger AoE" rider in session 19 plugs in here; v1 chain is identity. A potential Knight 17c equipment passive could legitimately register here too (e.g., a "Cleave Helm" that turns single-tile attacks into cross-shape), though no such item is on the 17c shortlist.
- **`GeneratedReaction { action, reactorId }`** is the chain-control shape for emitted reactions. The cap-accounting fix is in place: any 17b/17c reaction (Counter chains in equipment, Stasis-Sword counter-style, etc.) accounts correctly without thinking about it.
- **`AoeShape` lives in `engine/types/aoe-shape.ts`** — content authors and the catalog tier name it from `@engine/index.ts`. Algorithms (`shapeOffsets`, `aoeFootprint`) stay in `engine/map/`.
- **Friendly fire is sourced from the ruleset** (`ruleset.behaviors.friendlyFire`, v1 default `true`). Per-ability override is not implemented; if 17b/17c needs "this ability ignores allies," add `affectsAllies?: boolean` to AoeSpec then.
- **Caster exclusion defaults to `true`** — FFT-canonical. Earth AoE / Ultimate omit the flag. Lightning Mage's "Nova" in session 20 will be the first `excludeCaster: false` consumer.
- **Vertical tolerance enforcement** is on by default (ruleset value 1, per-ability override). Earth's AoE on a multi-layer feature (bridge) hits both layers within tolerance per spec.
- **Earth Mage demo battle** — still not wired (carried from session 16's handoff). Remains a small interleaved task; could land as part of 17b after Earth's AoE/Ultimate ship.

### Things noticed during the session

- **Caster-target status effects in AoE throw** in the dispatcher. v1 has no consumer, but if 17b's plaintext review surfaces a "self-buff while AoE-damaging" design, the dispatcher needs a once-per-cast caster-effect application step before the per-target loop. The throw makes the constraint surface immediately rather than silently dropping one effect.

- **Empty AoE footprint is allowed.** A tile-anchored AoE on a tile where no one stands and no nearby tiles have units returns `perTargetResults: []`. MP and Act budget were already deducted by the reducer pre-flight; the empty result is the deserved fizzle. Renderer's animator treats `perTargetResults[0] === undefined` as a brief pause (doesn't crash).

- **Stable target order is by lexicographic UnitId.** Tests rely on this for deterministic per-target assertions. `'b' < 'c' < 'd' < 'e'` in the test fixture is an example; production unit ids (e.g., `red_knight_n`, `blue_mage_s`) sort the same way. Session 17b's content tests inherit the property without thinking about it.

- **`reduceChargedActionResolve`'s pre-flight silent-fizzle cases stay in the reducer.** The dispatcher would emit a hit=true result for empty-tile-no-caster-effects cases; the reducer pre-flight preserves the existing "no per-target result emitted" semantics. AoE-flagged charged spells (none in v1, but a future "Charged Cross-Quake" pattern) skip the pre-flight and go through the dispatcher even on empty anchors — the AoE expansion may find nearby units regardless.

- **`onDamageReceived` emission shape extension is genuinely small.** The handler return becomes `{ ctx, emittedActions? }`; the runner collects emissions and the reducer enqueues them. Sleep's wake-on-damage is the canonical example. Worth landing in 17b alongside Earth's AoE/Ultimate as a focused, testable change. ADR follow-up to ADR-0024.

- **Per-target seed branching has an implicit upper bound on AoE size.** Each target gets its own derived seed; `targetIndex` is a 32-bit integer in practice. The mixer step disperses well across the 32-bit space, so collision risk is negligible for any realistic AoE. Worth noting only if a future content authoring guide describes the convention.

- **`GeneratedReaction.reactorId` is now the canonical reaction-bookkeeping field.** Future reaction surfaces (a hypothetical `runOnAllyDamaged` for "Cover" reactions) inherit the contract: emit `{ action, reactorId }` pairs. The runner's contract is "the reactor is `args.unit.id` at the time the hook fires" — stable and pure.

### Things considered but did not do

- **AoE per-target dispatch threading the index *into* the existing seed sub-streams** (e.g., `seed XOR (targetIndex << 12)` instead of a separate `perTargetSeed` helper). Considered: avoids the helper indirection. Rejected: the XOR approach correlates low-bit positions across targets when sub-stream offsets are also low (variance 0, evasion 1, brave 2, status chance 3). The mixer-based `perTargetSeed` produces well-distributed independent streams.

- **Folding AoE expansion *into* `resolveAbilityEffect`** (single function handles both per-target and AoE). Considered: fewer functions. Rejected: `resolveAbilityEffect` is the per-target body; AoE is the fan-out. Mixing them would couple two concerns. Splitting them keeps each focused (and each testable).

- **Per-ability `affectsAllies` flag on AoeSpec** to override the ruleset's friendly-fire policy for specific abilities. Considered as a hedge. Rejected: v1 has no consumer; YAGNI. Adding the flag when a future "Selective Storm" consumer ships is one line of code.

- **Caster status effects in AoE applied once before the per-target loop** (vs. throwing). Considered: more flexible. Rejected: v1 has no consumer; the throw makes the constraint surface immediately rather than silently dropping behavior. The "apply once before loop" pattern is one block to add when it lands.

- **Multi-target charged spell AoE expansion at the TargetRef level.** Today's `reduceChargedActionResolve` loops over `ca.targets`, then dispatches per ref. A multi-ref AoE (e.g., a charged spell that anchors at multiple tiles) would expand each ref's anchor into its own footprint. v1 has only single-ref charged spells; if a future spell needs multi-ref AoE, the loop structure already supports it without reducer changes.

- **A separate `runApplyCasterEffects` extracted out of `resolveAbilityEffect`.** Considered: cleanly separates the caster-effect-once-per-cast concern. Rejected: would require restructuring single-target callers too. The `applyCasterEffects: boolean` flag on `resolveAbilityEffect` is a smaller intrusion that gets the AoE behavior right without touching the single-target path.

### Open questions for later sessions (not blocking)

- **AoE-as-rider vs. AoE-as-base.** Today every AoE *is* the ability — the AoE shape is fixed in the spec. Future "AoE rider" abilities (e.g., a Berserker passive that turns single-target attacks into AoEs) would either use `modifyAoeShape` (if the ability already declares an AoE the passive can rewrite) or need a separate hook to *introduce* an AoE on a non-AoE ability. Surface when a consumer ships.

- **Per-target ordering and reaction Counter chains.** When AoE target 0's reaction (Counter) damages target 1 (a teammate), target 1's resolution may now find them KO'd. The dispatcher's per-target guard skips KO'd targets — but what about the Counter chain that ran *during* target 0's resolution? In v1 the chain processes synchronously inside `commitAction`, so target 1's resolution runs after target 0's reaction chain has fully drained. Confirmed by the test suite. Worth re-verifying when 17b's Earth AoE actually lands a Counter-bearing reactor.

- **Reaction cap interaction with multi-hit-on-same-reactor AoE.** A future AoE that hits the same reactor twice (e.g., a chain-lightning AoE that bounces back to a unit it already hit) would account two reactions. With cap = 1, the second is dropped. Today the cap is per-reactor-per-turn so this just works; documenting here in case a future "Reflect" reaction needs different semantics.

- **`modifyAoeShape` priority semantics.** The chain composes in source-tier and per-handler priority order. If a Status sets the shape to cross-radius-1 and a Class trait sets it to diamond-radius-2, which wins? Today: the last handler in the chain wins (the chain is left-to-right; the final shape is whatever the last handler returned). When a content author writes a passive that should "force" the shape regardless of other modifiers, they'd need a high priority value to run last. Worth surfacing in a content-authoring doc when the first modifier consumer ships.

### Notes for future ADRs

- A future ADR on `onDamageReceived` emission shape extension — when 17b lands Sleep's wake-on-damage, capture the per-hook extension pattern (parallels ADR-0024's `onTick` extension).

- A future ADR on equipment integration — 17c's first concrete consumer lands the `Equipment` type, equipment-slot definitions, and the WP base-stage refactor. ADR-0014 anticipated the work; the implementing ADR captures the shape decisions.

- A future ADR on forced-movement collision policy — 17b's knockback foundation has to pick a policy (cancel / damage / swap). Recommendation: cancel.
