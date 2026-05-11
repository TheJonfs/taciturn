## ADR-0057: Resistance absorption activation via tag-flip at the cap stage

**Status:** Accepted
**Date:** 2026-05-11
**Supersedes:** ADR-0022 (Resistance absorption deferred until first content consumer)

## Context

ADR-0022 deferred the BMG's resistance-absorption path (resistance > 100 → damage flips to healing) because no v1 content with resistance > 100 existed and the implementation shape (tag-flip vs. explicit absorption flag) wanted a real consumer to inform the choice. The deferral landed as a `Math.min(100, resistance)` cap inside `resistanceCheck` and a parallel cap inside `computeStatusChance`'s `lookupStatusResistance` consumer.

Session 27 prepares the engine substrate for Phase C equipment authoring. Per the equipment doc (`docs/twentyOnePlanning/mage-war-equipment.md`), Earth Mage with Capacitor Ring (+50 Lightning) + Wand of Depths (+50 Lightning) reaches `+50 (native) + 50 + 50 = +150` Lightning resistance — well into absorption territory. The choice is now informed: ship the absorption activation alongside the `modifyResistance` hook (ADR-0056), so the path lights up as Session 29 ships the items that produce > 100 resistance.

ADR-0022 surfaced two implementation shapes:

1. **Tag-flip approach.** When resistance > 100, the cap stage adds the `'healing'` tag to `ctx.damageTags` and converts the magnitude to a heal. Downstream consumers (apply, recording, rider gates) all branch on the `'healing'` tag and route through the existing healing path.

2. **Explicit absorption flag.** Add `absorbed: boolean` (or `direction: 'damage' | 'healing'`) to `DamageContext`. Cap and apply branch explicitly on the new flag in addition to the tag check.

ADR-0022's concern with tag-flip: "a hook that gates on `'healing'` would suddenly trigger on absorbed damage — unintended cascade through downstream handlers."

## Decision

**The cap-at-100 is lifted in both `resistanceCheck` (damage pipeline) and `computeStatusChance` (status apply formula). Absorption activates via tag-flip in `clampMinMax` (cap stage): when raw damage is negative and the source isn't natively healing, add `'healing'` to `ctx.damageTags`, set `finalDamage` to `min(|raw|, baseDamage, max-HP-room)`, and let the existing healing path route the result.**

The action log gains an `absorbed?: boolean` flag on `AbilityTargetResult` so the formatter can distinguish "absorbed Lightning Strike for 12 HP" from "Cure healed for 12 HP." Set in the reducer when the damage pipeline's final tag set includes `'healing'` but the source ability didn't natively declare it.

**Resistance regimes:**

| Resistance | Behavior |
|---|---|
| < 0 | Damage scales up: `damage × (1 + |resistance| / 100)`. Vulnerability. |
| 0 | Normal: damage applied unchanged. |
| 0 < r < 100 | Reduced: `damage × (1 - r / 100)`. |
| 100 | Immune: zero damage, no heal. |
| 100 < r < 200 | Absorption: `heal = base × (r - 100) / 100`. Tag-flips to healing. |
| ≥ 200 | Full absorption: `heal = base × 1.0` (clamped). No further compounding above 200. |

The `clampMinMax` handler implements this: it computes `raw = base + additives × multipliers`, detects `raw < 0` for non-healing sources (the absorption case), converts to a heal capped at the pre-multiplier `baseDamage`, applies the existing max-HP room cap, and adds `'healing'` to the tag set. The existing healing branch then handles `applyDamageToTarget`'s HP delta direction, the perTargetResult's `healingDealt` recording, the CT-push rider's `!has('healing')` gate, and the action log formatter's heal/damage distinction.

For status application chance, `lookupStatusResistance` returns the uncapped value (threaded through the new `modifyResistance` chain per ADR-0056); `(100 - resistance) / 100` computes the resistanceFactor without the previous `Math.min(100, …)`. The existing `Math.max(0, Math.min(1, postModifier))` clamp at the function exit handles the absorption regime cleanly: `resistance > 100 → resistanceFactor < 0 → preModifier < 0 → final clamps to 0` (the status never lands). Symmetric for negative resistance: `resistance < 0 → resistanceFactor > 1 → preModifier > 1 → final clamps to 1` (the status always lands). No "absorption semantics" for status — statuses don't heal; they apply or don't.

## Rationale

**Why activate now, not in Session 29 alongside the items.** The brief frames Session 27 as "engine prep for Phase C" — the substrate ships first so Session 29 can author items that exercise it without engine changes. Lifting the cap in this session means the integration tests for Capacitor Ring + Wand of Depths in Session 29 are content-only; no engine work threads through. The architectural shape (tag-flip vs. flag) is decided once, ahead of the content rather than alongside.

**Why tag-flip over explicit flag.** ADR-0022's tag-flip concern (cascade into hooks gating on `'healing'`) was overstated for v1's actual hook surface. The hooks that gate on `'healing'`:
- `clampMinMax` itself (the tag-flip site — adds the tag during the same call).
- `resistanceCheck` (skips healing entirely — the absorption case ran resistance *before* the tag-flip, so no double-resistance).
- `applyDamageToTarget` (branches isHealing for HP delta direction — exactly the desired behavior).
- The CT push rider (`!damageContext.damageTags.has('healing')` — exactly the desired behavior; absorbed damage shouldn't push CT).
- The reducer's `damageDealt` vs `healingDealt` recording — exactly the desired behavior.

In every case, the tag-flip semantics matches what we want for absorption. The "cascade concern" turns out to be the feature, not the bug.

**The explicit-flag approach** would require plumbing `absorbed: boolean` (or `direction: 'damage' | 'healing'`) through `clampMinMax`, `finalize`, `applyDamageToTarget`, `runOnDamageReceived`, and the reducer's outcome construction. Five sites instead of one. And every downstream consumer that branches on `'healing'` would need a parallel branch on `direction === 'healing'` to handle absorbed damage equivalently — duplicating the routing the tag check already does.

The tag-flip approach reuses the existing heal path for free. The cost is one Boolean field (`AbilityTargetResult.absorbed`) and a one-line formatter branch, both of which exist solely so the action log can distinguish absorbed-damage from native-heal events for the player. The damage pipeline itself is tag-flip-only.

**Cap absorbed amount at base, not at multiplier-magnitude.** Per Chris's call. BMG defines resistance 200 as "full absorption" (heal = 100% of base damage). At resistance 250, the multiplier-magnitude formula would heal for 150% of base (1.5 × base) — which compounds beyond BMG's intent. The cap at base damage keeps the BMG's documented top — resistance > 200 doesn't compound; it's the same as resistance = 200. Authoring discipline is preserved: an item granting +200 resistance and an item granting +250 resistance behave identically against the same attack.

**Cap heal at max-HP room.** Identical pattern to the existing healing path in `clampMinMax`. Absorbed heal can't over-fill HP; if the target is at 95/100 and the absorbed amount would be 20, the actual heal is 5. Matches the existing healing semantics; no new behavior.

**Resistance > 100 in the status formula clamps to "never lands," not "always lands."** Status is a binary apply / don't-apply; there's no analogue to "absorption heals." A unit with +150 Silence resistance is *more* immune to Silence (final probability clamps to 0), not "Silence applies as a buff." This is the natural reading of the formula `(100 - r) / 100`: when `r > 100`, the factor is negative, the preModifier is negative, and the existing clamp at `[0, 1]` zeros it. No new clamp logic needed in `computeStatusChance` — the existing exit clamp handles all regimes.

**Action log readability matters.** "Lightning Strike absorbed for 12 HP" reads honestly. "Lightning Strike +12 HP" would be confusing — the player would wonder if the spell mis-cast or if a healing variant fired. The `absorbed?: boolean` flag on `AbilityTargetResult` carries the distinction without bloating the result shape.

**AI passive avoidance only.** Per Chris's session-start call. `projectExpectedDamage` returns 0 when the projection's tag-flip kicks in for a non-healing ability, so the AI's offensive scoring discards absorption targets (high-resistance enemies aren't worth attacking with the absorbed tag). Active exploitation — heal an ally by hitting them with their absorbed tag — is a deliberate non-goal for v1; it's a tactics-layer change with its own design surface and tests, deferred until a content / class context calls for it.

**Forecast UI distinguishes regimes.** `DamageRange` gains a `regime: 'damage' | 'heal' | 'absorbed'` field so the forecast panel can render "absorb 12" instead of "dmg 12" when the player hovers over an absorption target. The damage-range projection inspects the projection-mode pipeline's tag set to detect absorption.

## Consequences

- **`composeResistance` is no longer capped at 100.** Returns the signedMax of all included tags' values, which can exceed 100. Threaded through the `modifyResistance` chain per ADR-0056.

- **`resistanceCheck` produces negative multipliers when resistance > 100.** The pipeline's variance and finalize stages handle them transparently; `clampMinMax` (cap stage) detects the negative-raw case and tag-flips.

- **`lookupStatusResistance` returns the uncapped value** (threaded through the chain). The status-formula resistanceFactor can go negative (resistance > 100) or exceed 1 (resistance < 0); the exit clamp at `[0, 1]` handles both.

- **`AbilityTargetResult.absorbed?: boolean`** added to the engine type. Set by the reducer when the damage pipeline's final tag set includes `'healing'` but the ability's native damage tags don't. Action-log formatter renders "absorbed X HP"; `+X HP` continues to render native heals.

- **`DamageRange.regime: 'damage' | 'heal' | 'absorbed'`** added to the forecast type. Forecast panel labels: 'dmg' for damage, 'heal' for native healing, 'absorb' for absorption.

- **`projectExpectedDamage` returns 0 for absorption regime on non-healing abilities.** Passive AI avoidance: the AI's offensive scoring multiplies expected-damage × kill-value × (1 - reaction-penalty); a 0 expected-damage means the score collapses, and the AI picks a different target. Doesn't actively seek absorption targets (a deliberate non-goal for v1).

- **One existing pipeline test updated.** The pre-Session-27 test that asserted "resistance 200 reads as immune (cap at 100, finalDamage = 0)" is rewritten to assert "resistance 200 absorbs full base damage as healing (finalDamage = 20, healing tag added)."

- **System actions unaffected.** `system_damage` (falling damage, status ticks, etc.) bypasses the seven-stage damage pipeline per ADR-0052 and goes through `modifySystemDamage`'s additive chain instead. Absorption only applies to ability-driven damage that runs the full pipeline. Future content can add absorption support to `system_damage` (e.g., an Earth Mage who heals from incoming earthquake damage) by routing the system-damage path through `composeResistance`; out of scope for Session 27.

- **Healing-tagged effects (Cure, etc.) unchanged.** ADR-0016 already exempts them from `resistanceCheck`; absorption is a non-event for them. The tag-flip in `clampMinMax` only fires on non-healing sources.

- **The "cascade through downstream `'healing'`-gating handlers" concern from ADR-0022 is now part of the design, not a risk.** Every site that gates on `'healing'` produces the desired absorption behavior. If a future hook wants to distinguish "real healing from a healing-tagged ability" from "absorbed-damage healing," it reads `AbilityTargetResult.absorbed` (or, in pipeline-internal handlers, checks the original ability tags via the in-flight ctx). No retrofitting needed for v1.

## Alternatives considered

**Explicit `absorbed: boolean` flag on `DamageContext` instead of tag-flip.** Rejected per the rationale above — five plumbing sites instead of one, with every downstream `'healing'` consumer needing a parallel `direction === 'healing'` check. Tag-flip reuses the existing heal path for free.

**Defer absorption activation until Session 29 (alongside the items).** Rejected — the brief explicitly frames Session 27 as engine prep, with content authoring in Session 29. Lifting the cap now means Session 29 is content-only.

**Cap absorbed amount at multiplier magnitude (no clamp at base).** Rejected — would compound absorption above resistance 200, contradicting BMG's "200 = full absorption" cap.

**Emit `system_heal` action(s) at the use_ability outcome level instead of tag-flip.** Rejected — the use_ability path doesn't emit `system_damage` actions today; it calls `applyDamageToTarget` directly and records perTargetResult. Routing through a new `system_heal` emission would require a new code path AND a paired `system_damage` zero-emission to keep the action log honest about which targets were hit. Tag-flip is simpler.

**Active AI exploitation of absorption (heal allies via absorbed-tag hits).** Deferred — needs its own design pass. The tactics surface (ally-targeting, friendly-fire toggles, exploit thresholds, projection-cost balancing) is wider than this session's scope. v1 ships passive avoidance only.

**Suppress absorption activation entirely until the first content consumer ships.** Rejected — repeats ADR-0022's deferral with the same uncertainty about implementation shape. The brief's call to "land the engine substrate so Phase C content authoring is mechanical" applies. Better to choose now and let Session 29 verify against real content.

## References

- `docs/battle-mechanics-guide.md` — resistance scale (full scale documented; cap-at-100 noted alongside this ADR's supersession of ADR-0022).
- `docs/twentyOnePlanning/mage-war-equipment.md` — Capacitor Ring, Wand of Depths, the Earth Mage build that reaches +150 Lightning resist.
- `src/engine/damage/handlers.ts` — `composeResistance` (per-tag chain), `resistanceCheck` (cap lifted), `clampMinMax` (absorption tag-flip).
- `src/engine/status/chance.ts` — `lookupStatusResistance` (chain), `computeStatusChance` (uncapped resistance factor).
- `src/engine/types/action.ts` — `AbilityTargetResult.absorbed`.
- `src/engine/forecast/damage-range.ts` — `DamageRange.regime`.
- `src/ai/projection.ts` — `projectExpectedDamage` (passive absorption avoidance).
- `src/ui/action-log-format.ts` — "absorbed X HP" formatter branch.
- `src/engine/actions/session-27-integration.test.ts` — absorption threshold tests + AI / status / damage integration.
- ADR-0015 — multi-tag composition via signedMax (preserved through the chain).
- ADR-0016 — healing opts out of resistance modulation (preserved).
- ADR-0022 — resistance absorption deferred (this ADR supersedes it).
- ADR-0052 — `system_damage` bypasses the seven-stage pipeline (preserves Session 27's "absorption is ability-pipeline only" scope).
- ADR-0056 — `modifyResistance` hook + equipment contributor registration (the coupled-but-distinct decision).
