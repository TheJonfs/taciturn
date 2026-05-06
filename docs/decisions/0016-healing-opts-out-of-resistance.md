## ADR-0016: Healing opts out of resistance modulation

**Status:** Accepted
**Date:** 2026-05-06

## Context

The Battle Mechanics Guide says healing doesn't roll against resistance ("you can't 'resist' healing in v1"). But the multi-tag composition rule (ADR-0015) says when an ability has multiple tags, the signed-maximum resistance applies. These rules conflict for any healing-tagged ability that *also* carries a non-healing tag.

The concrete consumer is the existing Cure ability:

```typescript
{
  id: 'cure',
  effects: { damage: { tags: ['holy', 'healing'], power: 5, … } },
}
```

Cure is tagged both `holy` and `healing`. With ADR-0015's rule applied naively, a target with `holy: +50` resistance would have their healing reduced by 50% — a unit who's resistant to holy magic can't be healed by Cure. Players don't want this; the design space doesn't benefit from this complication.

Reconciliation report items 2.5 and 5.8 flagged this. The cleanest rule: healing is healing; resistance applies to damage, not healing.

## Decision

**Effects with the `'healing'` tag opt out of resistance modulation entirely.** Other tags on the ability (`holy`, future `light`, etc.) classify the ability for purposes of "is this holy magic" (immunity flags, status interactions, narrative tagging) but do not contribute to resistance lookup against the healing amount.

The damage pipeline's resistance stage (when it ships in session 14) reads the effect's tag set and short-circuits if `tags.has('healing')`:

```
if (tags.has('healing')) {
  // Healing is not resisted. Skip the resistance lookup entirely.
  return ctx;
}
const applicableTags = tags;  // For damage, all tags participate.
const resistance = signedMax(applicableTags.map(tag => target.resistances.get(tag) ?? 0));
ctx = applyResistanceModifier(ctx, resistance);
```

## Consequences

- **Cure keeps its `'holy'` tag with no behavior change.** The tag classifies Cure as holy magic — useful for future content like "Holy-warding shields prevent holy spells from targeting" or "Undead take damage from holy healing" (a classic FFT mechanic, deferred). Today the `'holy'` tag is informational; resistance composition ignores it because the effect is healing.

- **The rule is per-effect, not per-ability.** An ability with mixed effects (e.g., a hypothetical "Smite" that damages enemies and heals allies in an AoE) runs each effect through its own resistance check. The damage effect's resistance lookup runs normally; the healing effect's lookup is skipped. The pipeline already runs per-target, so per-effect resistance gating is a natural extension when multi-effect abilities ship.

- **The Battle Mechanics Guide is updated.** Both the resistance section and the healing section explicitly call out the rule. Earlier text that suggested "healing rolls against tag resistance" is replaced.

- **Negative-resistance absorption (resistance ≥ 100 → healing) still applies to damage-tagged effects.** If a unit has `holy: 200` and a `holy`-tagged damage spell hits, the damage is fully absorbed as healing (per the existing scale). This rule is about *healing-tagged* effects opting out — it doesn't affect the absorption pathway, which is a property of damage-tagged effects.

- **Future "undead" tag interactions stay possible without rework.** A future `undead` immunity flag (or `undead` resistance value) could flip Cure's behavior — for an undead-tagged target, the `holy` tag becomes load-bearing and Cure damages instead of heals. That's a content-tier rule on top of the engine, expressible by a hook handler that observes the target's `undead` tag and re-tags the effect (`['holy', 'healing']` → `['holy']`). The base rule "healing tag opts out of resistance" stays intact.

- **Healing handlers in the damage pipeline don't need their own resistance branch.** The `healing_base` base handler computes the heal amount; subsequent stages (variance, cap, finalize) run normally. The resistance stage is the only one that branches on `'healing'` — and it branches by skipping.

## Alternatives considered

**Resistance reduces healing through non-healing tags.** Rejected — creates the pathological "high-holy-resistance unit can't be healed" case. Players don't want it; nothing in the design benefits.

**Drop the `'holy'` tag from Cure.** Rejected — the tag is useful future-proofing for `undead`-style interactions and for status-tag classification ("this is holy magic" matters for some content patterns even if it doesn't matter for resistance). Keeping it as a non-resistance-affecting classification is cleaner than dropping it and losing the categorization.

**Multiple-effect abilities run the entire ability through the most-permissive rule.** Rejected — too coarse. A future Smite-style spell with both damage and healing effects should resist-check the damage and not the healing. Per-effect resolution is the right granularity.

**Introduce a separate "healing-resistance" stat.** Rejected for v1 — the design intent is "healing is universal". A future Undead class can use the existing tag system (resistance to `holy`, with a hook flipping the polarity) without a parallel resistance dimension.

## References

- `docs/battle-mechanics-guide.md` — resistance and healing sections.
- `src/content/abilities/cure.ts` — Cure with both `'holy'` and `'healing'` tags.
- ADR-0015 — multi-tag composition; this ADR is its complement for the healing case.
- Reconciliation report items 2.5 and 5.8.
