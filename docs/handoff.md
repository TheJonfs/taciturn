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

## From session 2026-05-06 (session 16: Earth Mage part 1)

### Suggested next-session scope

Session 17 — Earth Mage (part 2) + Knight expansion. Per `docs/roadmap-sessions-14-20.md`: AoE damage application (per-target dispatch with seed branching from `resolveAbilityEffect`), AoE shape modifier hook, vertical tolerance enforcement on AoE, knockback / forced movement, equipment integration (per ADR-0014), Earth's AoE + Ultimate, Knight Battle Skill expansion, the long-form Poison status (non-expiring, cleared by ability/item).

The session 16 substrate that session 17 inherits:

- **Status application formula is fully wired** in `resolveAbilityEffect`. Per-target dispatch in session 17's AoE work calls `resolveAbilityEffect` per target with index-branched seed; status rolls are already index-aware via `effectIndex` on `rollStatusChance`. Need to thread the per-target index *through* `resolveAbilityEffect` alongside the per-effect index — currently `effectIndex` only varies across effects within one ability call.
- **Reaction compiler is the canonical author surface.** New reactions in 17+ extend `ReactionEffect` and `ReactionTriggerCondition` as needed. Damage / heal / knockback effect kinds will join `use_ability` / `apply_status` when their consumers ship.
- **System action infrastructure is in place** (`system_heal`, `system_apply_status`, `status_remove`, `status_decrement_stack`). Sleep's wake-on-damage (the canonical ADR-0017 use case) ships in 17 and is the first non-Earth consumer of `status_remove`.
- **Earth Mage demo battle is not wired yet.** The class, command set, abilities, and statuses are in the catalog and load successfully (loader test passes), but the demo battle (`src/content/battles/demo.ts`) still uses 2v2 Knights from session 13. An Earth Mage vs Knight demo would exercise the new content end-to-end in the browser preview. Optional for session 17 — could be a small interleaved task or part of the Earth AoE rollout.

### Things noticed during the session

- **Reaction-cap accounting limitation for `system_apply_status`.** The cap check in `commitAction` (`commit.ts:254`) keys on `'actorId' in effectiveProposed`. `system_apply_status` ProposedActions don't carry actorId, so apply_status reactions don't count against the per-unit-per-turn reaction cap. Unhittable in session 16 (Earth Resilience triggers at most once per attacker turn), but session 17's AoE will exercise the case if an AoE hits the same reactor multiple times in one cluster. Fix: extend `QueueEntry` with `reactorId` (or carry it on `generatedReactions` items) so the cap key isn't tied to the action's actorId field.

- **`onTick` is the only emission-bearing hook today.** Other event hooks (`onApply`, `onRemove`, `onDamageReceived`, `onDamageDealt`, `onActionAttempted`, `onActionTargeted`) still use their pre-session-16 return shapes. They extend to `{ result, emittedActions? }` when their first emission consumer ships:
  - **Sleep (session 17):** `onDamageReceived` returns `{ ctx, emittedActions: [status_remove] }` to wake-on-damage.
  - **Burn (session 19):** custom-trigger pattern — likely a new hook variant rather than an existing-hook extension.
  - **Vulnerable (session 20):** `onDamageReceived` returns `{ ctx (with multiplier applied), emittedActions: [status_remove] }`.
  Session 17 should land the `onDamageReceived` shape change cleanly, with Sleep as the worked example. ADR follow-up to ADR-0024.

- **`onTick` handler signature includes `state` and `catalog` in args.** This is the exception in the hook surface — most handlers don't see state/catalog directly. Justified by the inherent need for tick effects to compute against current world state (Regen reads MaxHP and Faith via `runModifyStatQuery`). When session 19's Burn lands, its custom-trigger handler will likely need the same access; the pattern can extend to a `state`/`catalog` slot on other hooks if a similar need arises. For now, only `onTick` carries it.

- **Per-effect seed branching is in place but per-target seed branching is not.** `rollStatusChance` accepts an `effectIndex`. Session 17's AoE per-target dispatch needs a per-target index *in addition* — when an AoE hits 3 targets and applies a status to each, target 0's roll, target 1's roll, target 2's roll should all be independent. The `effectIndex` slot is already there; the AoE caller will compute `target_idx * effects.length + effect_idx` or similar and pass it through. Document the convention when AoE lands.

- **The reaction compiler doesn't propagate the reactor id to system_apply_status.** Today the compiler embeds `sourceUnitId: args.unit.id` in the system_apply_status payload. The cap-accounting issue (above) means the reactor isn't credited against the per-turn cap. Resolution lands alongside the AoE per-target work in session 17.

- **Silence's onActionAttempted handler reads `args.abilityTags`.** The runner now pre-resolves the ability's tag set via the catalog and passes it through. This is a one-hook extension — other hooks could grow similar pre-resolved fields (e.g., `abilityKind`, `damageTags`) when consumers need them. The pattern is "the runner resolves what handlers can't reach without state/catalog." Worth flagging when a new hook's handler design surfaces a similar lookup.

- **Earth Mage demo battle is not yet wired.** The demo battle still pits 2v2 Knights. Test coverage for Earth Mage uses inline fixtures. End-to-end browser verification (cast Earth Strike on a target in the preview, see damage + debuff land, verify the AI handles a Mage class) is deferred. Optional first task in session 17 — would also exercise the AI's response to charged spells on the opposing side.

### Things considered but did not do

- **Removing the ADR-0024 reaction-cap limitation by routing all reactions through a `use_ability` synthetic ability.** Considered: have Earth Resilience emit a `use_ability` with a hidden self-buff ability id; the existing `actorId`-based cap accounting catches it. Rejected: pollutes the ability catalog with content-internal ability ids, and the synthetic ability is reachable from any caller that can enumerate the catalog. The clean fix (queue-entry-carries-reactor-id) is small; deferred to session 17 with a note here.

- **Wrapping every event hook's return type at once (uniform Option A) rather than per-hook (Option B).** Considered: ship `{ result, emittedActions? }` on `onApply`, `onRemove`, `onDamageReceived`, `onDamageDealt`, `onActionAttempted`, `onActionTargeted` in session 16. Rejected per ADR-0024: Option B is more honest (pure-compute hooks don't need emissions); session 17's Sleep ships the `onDamageReceived` extension as a focused, testable change. The migration cost is paid per-hook, when each first consumer arrives.

- **Implementing `system_apply_status` to run the BMG formula.** Considered: the system action could re-run Faith / MA / resistance / modifiers and only apply on a successful roll. Rejected: would double-gate reactions (Brave roll already filtered the trigger, then the formula filters again). The flavor "Earth Resilience triggered, but the buff missed" feels wrong. `system_apply_status` is deterministic by design.

- **A `system_damage` or `system_apply_hp_change` action to unify with `system_heal`.** Considered: a single action variant with a signed delta. Rejected: damage and healing have different validation, capping, and visual semantics. v1 ships `system_heal` only; Burn's CT-100 trigger (session 19) will spawn a `system_damage` action when it ships, with its own reducer and pipeline integration.

- **Adding `resistanceTag` to all 5 new statuses.** Only Movement Debuff carries one (`'earth'`). Blind, Silence, Regen, and Movement Self-Buff don't have a resistance tag in v1. The format spec allows the field to be optional; absent means "can't be resisted via tag." When session 17+ adds Mental / Holy / Time resistance tags or similar, the relevant statuses can declare them.

- **Writing AI heuristics for Earth Mage.** The AI (`decideBasicAi`) was tuned for Knight + Cure in session 13. It doesn't know about charged spells, debuff stat-mod rolls, or status-chance modifiers. Session 17's Knight expansion + Earth's AoE will probably produce some incidentally-poor AI plays; session 20's tier 1.5 AI refresh is the planned fix. Worth re-checking against an Earth Mage demo battle in session 17 to surface the worst behaviors.

### Open questions for later sessions (not blocking)

- **How does AoE damage interact with the `runOnActionTargeted` Brave roll?** Counter on each target rolls independently against the same incoming action's seed. v1 has the seed sub-stream constant 2 for the brave roll; per-target index needs to be folded in. Resolves when AoE per-target dispatch lands in session 17.

- **Should Earth Resilience's instances be inspectable from UI?** STACK_INDEPENDENT means a unit can have 3 separate instances with 3 timers. The HUD's status-strip currently shows one icon per instance type, not per instance. With STACK_INDEPENDENT, the unit might want a "× 3" badge or expanded per-instance hover. UI work, not engine; surface when status-display tooling lands.

- **Faith asymmetry on Regen.** Regen's tick reads the *recipient's* Faith. The application chance reads symmetric (caster × target Faith). This is the only symmetric-vs-asymmetric Faith case so far. When Burn lands (session 19), its damage trigger should read either caster Faith (the original applier) or target Faith — design call. The handoff note is "remember Regen's recipient-Faith convention when designing Burn's tick math."

- **`system_apply_status` rejecting on KO'd targets emits `{ kind: 'rejected', reason: 'stacking_rule' }`.** This is a slight semantic abuse — the status wasn't rejected by stacking rules, it was rejected because the target is KO'd. A future StatusApplicationOutcome variant could distinguish (`{ kind: 'rejected', reason: 'target_ko' }`); for now, the existing variant is reused. Surface if UI/replay gets confused by it.

### Notes for future ADRs

- ADR-0017 (system actions for status side effects, deferred to session 16) is now committed. ADR-0024 captures the implementation. The Sleep / Burn / Vulnerable consumers are still future work; the architecture is in place.

- ADR-0019 (physical hit roll fires at the target stage) is partly superseded by ADR-0024's `modifyHitChance` extension — the hit-chance formula now reads a hook chain product. ADR-0019's stage placement and seed sub-stream are unchanged.

- A future ADR on per-target seed branching for AoE — when session 17 lands, the convention for `seed XOR (target_idx * stride + effect_idx)` should be captured so future content authors don't reinvent it.

- A future ADR on the reaction-cap accounting fix — session 17 will land the `QueueEntry.reactorId` change; brief ADR documenting why "actorId on the action" was insufficient.
