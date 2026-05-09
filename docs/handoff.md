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

## From session 2026-05-09 (session 19: Fire Mage)

### Suggested next-session scope

**Session 20 — Lightning Mage + AI refresh** (per `docs/roadmap-sessions-14-20.md`).

Engine work:
- **Critical hit infrastructure** — `crit_chance` and `crit_multiplier` as stat-queryable values via hook, applied in the variance stage of the damage pipeline.
- **Self-damage as ability cost** — caster as the target of their own ability's damage component (Lightning Ultimate's ×4 damage with self-damage). Needs the damage pipeline to handle "ability deals damage to caster" cleanly (probably an additional StatusEffectSpec / DamageSpec target option, or a new `selfDamage?: { fraction }` field).
- **Vulnerable status** — second consumer of the custom-trigger pattern (`customTrigger.kind: 'on_damage_received'` extends the union). On the next damage taken, multiply by 1.5×, then emit `status_remove` against itself. Different firing site from Burn (event hook is `onDamageReceived`, not status_tick); confirms the pattern generalizes per ADR-0030's framing.
- **Magical reactions** — Lightning Reaction triggers on any incoming hit (including magical), with small MA-based retaliation. Resolve any deferred per-Reaction `tag` filter if needed (the existing reaction-compiler `damageTagsAny` / `damageTagsNone` filters already handle this; verify the runner doesn't pre-filter on `'physical'`).

Content work (plaintext-first per standing practice):
- Full 7-ability Lightning Mage kit: Base spell (damage with ×1.5 rider), Buff (Crit_modifier on ally via Faith chance), AoE (damage + chain bonus per unit hit), Debuff (Vulnerable), Ultimate (×4 single target with self-damage), Reaction (MA-based retaliation), Support (MA × 1.25 modifier).
- New statuses: **Vulnerable** (custom-trigger on_damage_received), **Crit_modifier** (additive boost to crit chance, duration-counted per session 19's permanent stat-mod precedent or limited-duration — designer call), maybe **MA Multiplier** (multiplicative MA buff, distinct from the additive MA Up that Fire Mage uses).

AI tier 1.5 (deferred to a 20a sub-session if scope grows):
- Status-aware target selection (don't magic-attack Reflect-buffed targets).
- Reaction-aware planning (don't walk into Counter chains).
- AoE handling (evaluate AoE by total expected damage across hit cluster, including friendly fire penalty).
- Stat-aware damage projection (use real damage formula, not stripped-down approximation).
- Two-action turn planning (Move + Act combinations, not independent evaluation).

ADR-0032 (anticipated): Vulnerable / `'on_damage_received'` custom-trigger kind formalization + magical-reaction confirmation + crit-modifier infrastructure.

The 19 substrate that 20 inherits:
- **Custom-trigger pattern** (`durationMode: 'custom'` + `customTrigger.kind`) is fully shipped — Vulnerable adds one enum value to `customTrigger.kind` and registers an `onDamageReceived` handler. No new firing infrastructure needed.
- **`composeApplyState`** is in place if Vulnerable wants per-instance state (none anticipated; the multiplier could be a constant on the type or a magnitude field).
- **`customStateOnDecrement`** exists if a stack-decrement pattern surfaces (Vulnerable consumes via `status_remove`, not decrement; not load-bearing).
- **`'magical'` tag on the damage path** is exercised by Ignition / Aether Bloom / Flow State — Lightning Support's MA × 1.25 modifier should follow the same shape (a passive that fires `modifyStatQuery` against `'ma'` would compose with PA/MA Up/Down naturally).
- **`status_decrement_stack` reducer** handles `customStateOnDecrement` if a future Lightning status wants stack-count + state.

### Things noticed during the session

- **Fire Strike's linked-roll mechanic** uses a shared `effectIndex` between the two effects so the seed-derived roll matches. This works because both PA Down and MA Down have identical chance computation (same baseChance, same factors, same resistance tag). If a future linked-roll content consumer wants two effects with *different* chance computations (different baseChance or different status types with different resistance tags), the rolls would still share but the resulting `applied` outcomes could diverge. The current design is "shared roll, independent chance per effect" — flag if a content consumer wants strict "shared outcome" semantics.

- **Ignition fires on `onDamageDealt`**, which runs at the attacker stage *before* the target stage's evasion / resistance / hit roll. For magical damage this is fine (no hit roll, magical always lands per BMG). If a future content consumer wants a parallel "Burn-on-physical-damage-that-lands" passive, the current Ignition shape would over-apply (it'd queue Burn even on missed physical attacks). The right answer there is `onActionResolved` against the actor with target enumeration — surface when needed.

- **Aether Bloom is universal (filters on `'magical'` tag), free for Fire Mage.** No Fire-specific shape ships. If a future class wants element-specific AoE expansion, a parallel passive ships then; the existing `enlargeAoeShape` helper composes naturally with chained `modifyAoeShape` handlers.

- **Burn FIFO drop is a content-design choice**, not a generic STACK_COUNT_ADDITIVE rule. The customStateOnDecrement on Burn does `slice(1)`. A future stack-counting status that wants LIFO ages-newest-first could `slice(0, -1)` instead. The generic decrement reducer is agnostic.

- **No screenshot from the renderer this session.** The dev server captures kept timing out (Pixi/WebGL quirk in the headless preview tool); accessibility snapshot + action log queries via `__taciturnDebug` confirmed the demo runs end-to-end. Visual verification is gated behind future renderer work for Burn / Fire AoEs / line shape (currently they pull through with no specific visual).

- **Pre-existing TS strict-mode errors in test files** (carried from 17c handoff and 18 handoff). Still not addressed; `npm run typecheck` passes via Vitest's loose mode but `tsc -b --noEmit` may surface them. Worth a session of cleanup at some point — defer until a natural lull.

### Things considered but did not do

- **A new `onCustomTrigger` hook.** Considered as part of the custom-trigger pattern; rejected per ADR-0030 — the existing `onTick` / `onDamageReceived` / `onActionResolved` hooks already cover the triggering surface for v1/v2 custom-trigger kinds. Each customTrigger.kind maps to a natural existing hook; no indirection layer added.

- **Burn-specific decrement system action.** Considered (`status_burn_decrement` that handles its own customState transform). Rejected in favor of the generic `customStateOnDecrement` type method on StatusEffectType — avoids per-status-action proliferation when Vulnerable / future custom-trigger statuses ship.

- **Live MA read on Burn ticks.** Considered as the simpler implementation (no per-stack snapshot). Rejected per Chris's design intent — the proficiency of who lit the burn should outlast the applier's later MA shifts. Snapshot at apply preserves the multi-applier story; live read collapses it.

- **One combined "Fire Wither" status (PA + MA in one instance).** Rejected — the four-status split (PA/MA Up/Down) gives net-zero composition (a +1 buff and -1 debuff cancel cleanly via `modifyStatQuery`). A combined status would lose this property.

- **Fire-specific "Kindling" passive (Fire-only AoE expansion).** Considered alongside the universal Aether Bloom. Rejected — universal is more general at the same cost (Fire Mage gets it free either way). Future cross-classed mages would benefit from a universal expander too.

- **Strict "shared outcome" linked rolls (two effects, both apply or both miss regardless of chance computation).** The current `linkRoll` shares the seed-derived roll; agreement happens because Fire's two stat-mods have identical chance computation. Strict-shared-outcome would override the per-effect chance, which is a different mechanic; flag if content needs it.

- **`onActionResolved` for Ignition's Burn application.** Considered to gate on actually-landed damage (instead of onDamageDealt's pre-hit-roll timing). Rejected for v1 because magical damage always lands; the existing onDamageDealt timing works for Fire's content. Revisit when a physical-damage variant ships.

### Open questions for later sessions (not blocking)

- **Kinematic stop on knockback paths.** v1 has no line-shape knockback; the kinematic-stop semantic only lives in `aoeFootprint` for line shapes. If a future Lightning content wants "knockback along a line, stop at a wall," extend `applyKnockback` similarly.

- **Cone expansion via `enlargeAoeShape`.** Currently passes through unchanged. If a future cone-extender passive ships, decide whether to extend rows (`[1,3,3]` → `[1,3,3,3]`), widen each row (`[1,3,3]` → `[1,5,5]`), or both. Author-defined per content.

- **Burn stack cap.** No cap in v1. If degenerate stacking surfaces (Spark + Ignition + Smolder + Flame Lance can theoretically stack many burns on a single target), `composeApplyState` is the natural place to enforce a cap (return early when `existingStacks.length >= CAP`), or add `maxStacks?: number` on StatusEffectType for engine enforcement.

- **`'custom'` durationMode without `customTrigger`.** `applyStatus` throws on this case as a content-authoring error. If a future custom-trigger status wants a different firing pattern (e.g., conditional duration that's also event-driven), revisit the discrimination shape.

- **Faith composition on Burn per-stack damage.** Today `floor(MA × 0.6)` is unmodulated. If a future content consumer wants Faith to modulate the per-stack value (parallel to magical-damage Faith composition), the composer takes the change.

- **AI awareness of Burn / linked rolls.** Tier 1.5 in session 20 might want to evaluate Burn stacks in target selection (a target with high Burn already shouldn't get more Burn from low-MA appliers; the diminishing returns curve matters). Not v1-load-bearing.

### Notes for future ADRs

- **ADR for Vulnerable / `'on_damage_received'` custom-trigger kind** (anticipated session 20) — extends the customTrigger.kind union, registers an onDamageReceived handler that emits the multiplier into ctx and a `status_remove` against itself.

- **ADR for crit infrastructure** (anticipated session 20) — `crit_chance` / `crit_multiplier` as stat-queryable values via `modifyStatQuery`, applied in the variance stage of the damage pipeline. The `Crit_modifier` status raises crit chance via the same hook.

- **ADR for self-damage** (anticipated session 20) — Lightning Ultimate's "×4 damage to target + N% MaxHP self-damage" needs the damage pipeline to handle "caster as target" cleanly. Either an extension of `StatusEffectSpec` / `DamageSpec` with a `target: 'caster' | 'primary_target'` field on the damage component, or a separate `selfDamage?: { fraction }` field on the ability.

- **ADR for magical reactions** (anticipated session 20) — confirms that reactions trigger on magical incoming as well as physical. The runner doesn't pre-filter today (`runOnActionTargeted` doesn't check tag); Lightning Reaction's tag filter (if needed) lives in the reaction compiler's `damageTagsAny` / `damageTagsNone`. Mostly a confirmation ADR; may be a one-paragraph "no engine change needed" record.
