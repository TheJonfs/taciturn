## ADR-0022: Resistance absorption (resistance > 100 → healing) deferred until first content consumer

**Status:** Accepted
**Date:** 2026-05-06

## Context

The Battle Mechanics Guide's resistance scale runs from -100 to 200:

| Resistance value | Effect |
|---|---|
| -100 | Doubled damage (200%) |
| 0 | Normal damage (100%) |
| 100 | No damage (0% / immune) |
| 150 | Half-healing (the unit recovers HP equal to 50% of base damage) |
| 200 | Full absorption (the unit recovers HP equal to 100% of base damage) |

Per the formula `resistance_modifier = (100 - resistance) / 100`, a resistance value greater than 100 produces a *negative* modifier. The BMG specifies that when the modifier is negative, the engine applies the result as healing rather than damage — incoming damage *flips polarity*.

Session 14 wires the resistance system. The implementation question: how does the pipeline carry the polarity flip from the resistance stage through cap, finalize, and apply? Two reasonable shapes:

1. **Tag-flip approach.** When `resistance > 100`, the resistance handler adds the `'healing'` tag to `ctx.damageTags` and applies the absolute multiplier `(resistance - 100) / 100`. The cap stage (`clampMinMax`), finalize, and `applyDamageToTarget` already branch on the `'healing'` tag — absorption flows through the existing healing path "for free."
2. **Explicit absorption flag.** Add `absorbed: boolean` (or `direction: 'damage' | 'healing'`) to `DamageContext`. The resistance handler sets it; cap and apply branch explicitly on the new flag in addition to the tag check.

Both have surface area: tag-flip changes the tag set seen by *downstream* handlers (`fire_on_damage_received`, `cap`, `finalize`), which has unintended cascade potential — a hook that gates on `'healing'` would suddenly trigger on absorbed damage. The explicit-flag approach avoids cascade but plumbs a new field through three sites.

Crucially, **no v1 content produces resistance > 100.** Session 14's verification fixture for absorption ("a healing variant verifies negative-resistance absorption case") is verifying a code path no content actually exercises. Implementing it now is "infrastructure ahead of consumer."

## Decision

**Resistance absorption is deferred. The session 14 `resistance_check` handler caps the effective resistance value at 100 (immune); resistance values above 100 read as 100 with a `// TODO(absorption)` comment. The full polarity-flip path lands when the first content with resistance > 100 ships, alongside a real consumer that exercises the chosen shape (tag-flip vs. explicit flag).**

Concretely:
```typescript
const resistance = composeResistance(ctx.damageTags, ctx.target);
if (resistance === 0) return ctx;
const capped = Math.min(100, resistance);
const factor = (100 - capped) / 100;
return { ...ctx, multipliers: [...ctx.multipliers, { source: 'resistance', factor }] };
```

A target with resistance 150 reads as immune (modifier 0), not as half-healing. A target with resistance 200 also reads as immune. The Battle Mechanics Guide's full scale stays as-is (it documents the v1+ design intent), with a note pointing at this ADR.

## Rationale

**Why defer at all.** "Don't ship infrastructure ahead of consumer" is a project-level discipline (CLAUDE.md anti-pattern: "Don't add features, refactor, or introduce abstractions beyond what the task requires"). The absorption path has two viable shapes with different downstream implications; picking one without a consumer that exercises the choice risks picking the wrong one.

**Why cap at 100 specifically.** It's the "immune" level — a meaningful threshold the BMG already documents. Capping there means: (a) damage is fully blocked rather than producing weird negative-multiplier behavior; (b) any v1 fixture or content that accidentally sets resistance > 100 reads sensibly as immune; (c) the upgrade path is local — when absorption ships, removing the cap and adding the polarity-flip is a single-handler change.

**Why not throw on resistance > 100.** A throw would catch programmer errors (someone setting resistance 150 by mistake), but it would also break legitimate balance experimentation that uses values in the 100–200 range as a "stronger immunity" gradient pre-absorption. Reading values > 100 as 100 is the conservative behavior that keeps experiments running.

**Why the BMG keeps the full scale documented.** The scale is the design intent. Documentation lying about it (saying the v1 cap is 100) would confuse future authors when absorption arrives. The honest story: "the scale runs to 200; the v1 implementation caps at 100 pending the first consumer."

## Consequences

- **`resistanceCheck` clamps to 100 with a `TODO(absorption)` comment.** The Battle Mechanics Guide is updated with a one-paragraph note pointing at this ADR.

- **No v1 content sets resistance > 100.** Today: empty resistance maps on every Knight + future Earth Mage. The 100-cap is an internal convention, not a constraint anyone is hitting.

- **The session 14 verification fixture for absorption is dropped.** The plan's "Test fixture: a healing variant verifies negative-resistance absorption case (`resistance > 100` produces healing)" was verifying an unimplemented path. The replacement test confirms the cap behavior: resistance 150 reads as immune (modifier 0).

- **When absorption ships, this ADR is superseded.** The session that lands resistance > 100 content (likely a defensive class with a major class-level absorption mechanic, or an "Absorb Damage" status) makes the polarity-flip choice in context and writes a follow-up ADR. The follow-up's Status is "Supersedes ADR-0022."

- **The shape choice (tag-flip vs explicit flag) is deferred.** Both shapes are documented above for the future ADR's "Alternatives considered" section. The choice depends on what the first consumer needs to gate on — if the consumer is a status that should fire on "absorbed damage," explicit flag is cleaner; if the consumer is just "this unit absorbs fire," tag-flip is cleaner.

- **`signedMax` composition handles values > 100 today.** The composition function returns whatever the largest signed resistance is, including 200; the cap is downstream of composition. So `signedMax(50, 200)` returns 200, then `Math.min(100, 200)` reads as 100. When absorption ships, only the cap is removed; signedMax stays correct.

## Alternatives considered

**Implement absorption now via tag-flip.** Rejected per "no consumer to validate the shape." Tag-flip's cascade through downstream handlers (each handler now needs to know whether the tag is "real healing" or "absorbed damage that became healing") is a real concern that wants validation against actual content.

**Implement absorption now via explicit `absorbed: boolean` flag.** Rejected for the same reason — plumbing a new field through `clampMinMax`, `finalize`, and `applyDamageToTarget` ahead of any consumer that benefits from it. The flag's design (boolean? `direction` enum? something richer for partial-absorption?) wants a real test case to inform.

**Throw on resistance > 100 to surface the unimplemented path.** Rejected per the rationale above — too aggressive; breaks balance experimentation in the [100, 200] range.

**Document the full scale but cap at 100 without a TODO.** Rejected — the inconsistency between BMG and engine should be visible in the code, not just in the BMG's prose. The TODO comment links the engine deferral to the design doc.

## References

- `docs/battle-mechanics-guide.md` — resistance scale (full scale documented; cap-at-100 noted).
- `src/engine/damage/handlers.ts` — `resistanceCheck` with the cap.
- ADR-0015 — multi-tag composition via `signedMax`. Composition stays correct above 100; only the application caps.
- ADR-0016 — healing opts out of resistance modulation. (Healing-tagged effects skip resistance entirely; this ADR's cap doesn't affect them.)
- ADR-0020 — magical damage formula (the session 14 sibling).
