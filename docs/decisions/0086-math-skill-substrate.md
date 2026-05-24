## ADR-0086: Math Skill substrate — parameter-predicate targeting, dispatcher, and the two-hook surface for SP / per-target MP modulation

**Status:** Accepted
**Date:** 2026-05-24
**Session:** 49

## Context

Session 49 ships the **9th class — Calculator** — together with its defining mechanic, Math Skill: parameter-based instant-cast targeting across every unit on the battlefield. Per the brief, a Calculator picks one of 5 abilities × one of 4 parameters (CT / Height / Level / Current HP) × one of 4 values (Prime / 3 / 4 / 5) = **80 cast options per turn**, and the engine enumerates every unit whose parameter satisfies the value's predicate, dispatching the ability's effect to each.

Pre-S49 targeting carries 4 kinds (per ADR-0023 / ADR-0025): `'self'` / `'single_unit'` / `'tile'` / `'unit_or_tile'`. Single-target dispatch resolves one unit; AoE dispatch expands an anchor through a footprint. Math Skill is a third axis: the target set comes from a predicate over the field rather than from a range geometry. The S49 audit confirmed every audit target lands additive — no cross-cutting refactor is required.

The audit also surfaced one piece of misdirected guidance. The S48 close-handoff and the calculator-blueprint both flagged a "missing MA factor in the status-application formula" — the Math Skill status appliers' hit chance should multiply by the caster's MA. The audit found `engine/status/chance.ts` already defaults `factors = { faith: true, ma: true }` (per ADR-0028). Earth's Burn, Brine's Slow, every Mage status-applier already runs Faith × MA. **No engine work was needed**; the Math Skill status abilities (Sculpted Enhancement, Engineered Defenses) inherit the canonical formula by leaving `factors` undefined.

## Decision

### 1. New `TargetingSpec` kind: `'math_skill'`

The discriminated union grows from 4 to 5 kinds:

```ts
type TargetingSpec =
  | { kind: 'self' }
  | { kind: 'single_unit'; range; rangeMode }
  | { kind: 'tile'; range; rangeMode }
  | { kind: 'unit_or_tile'; range; rangeMode }
  | { kind: 'math_skill' };
```

No `range` field — Math Skill is battlefield-wide. `computeAbilityRange` returns `Infinity` for the kind so any range-check call site that erroneously dispatches against a Math ability won't block a legitimate target.

`AbilityTarget` (the runtime payload) gains a parallel variant:

```ts
type AbilityTarget =
  | { kind: 'self' }
  | { kind: 'unit'; unitId }
  | { kind: 'tile'; position }
  | { kind: 'math_skill'; parameter: MathSkillParameter; value: MathSkillValue };
```

Where `MathSkillParameter = 'ct' | 'height' | 'level' | 'current_hp'` and `MathSkillValue = 'prime' | 3 | 4 | 5`. The controller picks the parameter and value at cast time; the payload carries them through to the dispatcher.

### 2. Predicate enumeration lives in `engine/targeting/math-skill.ts`

A new directory and module — the first inhabitant of `engine/targeting/`, which exists to hold targeting predicates that turn ability targeting specs into concrete target sets.

```ts
function enumerateMathSkillTargets(state, parameter, value): ReadonlyArray<Unit>
```

Returns the matching set, sorted by `unit.id` for stable per-target dispatch order (mirrors AoE's lex-id sort). Excludes:
- `unit.removed === true` (always — engine convention).
- `unit.vitals.hp <= 0` (KO'd units; their CT freezes and they're not meaningful Math targets — per brief).

Self-targeting applies: a Calculator whose own parameter matches is included in the matched set. Friendly fire applies: matching allies receive the effect just like matching enemies. Both are first-class Math Skill features, not edge cases.

The predicate reads parameters as:
- `'ct'`: `unit.ct`
- `'height'`: elevation of the unit's current tile (or 0 if no tile).
- `'level'`: `unit.level` (Session 49 Level system — see ADR-0087).
- `'current_hp'`: `unit.vitals.hp`.

Value tests:
- `'prime'`: `isPrime(reading)` — trial division with a 6k ± 1 wheel.
- `3 / 4 / 5`: `reading % value === 0`. JavaScript's `0 % N === 0` means a unit at CT 0 / HP 0 / Level 0 *matches every numeric divisor*; KO'd-unit exclusion is the dominant filter in practice (HP 0 units are removed before the modulo check fires).

### 3. New dispatcher: `resolveMathSkillDispatch`

Parallel to `resolveAoeDispatch` in `engine/actions/reducers.ts`. Routes through `resolveAbilityTargets` based on `ability.targeting.kind === 'math_skill'`:

```ts
const result =
  targetingKind === 'math_skill'
    ? resolveMathSkillDispatch(state, catalog, args)
    : aoe === undefined
      ? resolveSingleTargetDispatch(state, catalog, args)
      : resolveAoeDispatch(state, catalog, args, aoe);
```

The dispatcher:
1. Enumerates matching units via `enumerateMathSkillTargets`.
2. Resolves the SP bonus and per-target MP discount through their hooks (see §5).
3. Synthesizes a per-cast ability with bumped `ctEffects.factor` (Math's CT-push abilities scale with the SP bonus).
4. Routes the damage / heal SP bonus through `DamageContext.additionalPowerCoefficient` (the damage pipeline re-looks up the ability by id from the catalog, so a synthesized `effects.damage` would be ignored — see §6).
5. Iterates per matched unit with `perTargetSeed(args.seed, i)` so variance / evasion / status-chance / brave-reaction rolls are independent per target. Same shape as AoE dispatch.

**Mutual exclusion:** Math Skill + AoE is a content-authoring error. The dispatcher throws when an ability declares both — Math already enumerates a target set; layering AoE on top would double-expand.

**Caster-target effects:** Math Skill abilities can't carry `statusEffects` or `ctEffects` with `target: 'caster'`. The caster isn't a separate axis from the matching set — they're one possible match. Surfaced as a thrown error so authoring violations fail loud.

### 4. New per-CtEffect flag: `faithScalesMagnitude`

Pre-S49 CT effects (Tide Surge etc.) compute magnitude as `floor(factor × stat)`; Faith composes only into the chance gate. The Math Skill blueprint's Exact Rhythm formula is `SP × MA × Faith Factor` — Faith multiplies the magnitude.

Added an optional `faithScalesMagnitude?: boolean` field on `CtEffectSpec`. When true, the resolver multiplies magnitude by `computeFaithFactor(caster, target)` before flooring. Default (omitted) preserves Tide Surge / Riptide-proc behavior. Exact Rhythm sets it true; future Math-like CT consumers can opt in.

### 5. Closed-surface hook additions (13 → 15): two narrow Math hooks

Mathematician's Support passive has two parametric effects per the brief — +1 SP on Math Skill abilities, and per-target MP multiplier 3 → 1. Both are Math-Skill-specific and can't compose cleanly through the existing `modifyMpCost` hook (which sees the per-cast scalar, not the per-target multiplier).

Added two narrow hooks:

```ts
modifyMathSkillPerTargetMpCost: {
  args: { unit; ability; baseValue: number };
  return: number;
};
modifyMathSkillSpBonus: {
  args: { unit; ability; baseValue: number };
  return: number;
};
```

Closed-surface count: 13 → 15. Both hooks fire only from `resolveMathSkillDispatch`; non-Math casts don't consult them. Mathematician registers:
- `modifyMathSkillPerTargetMpCost`: returns 1 (replaces the default 3).
- `modifyMathSkillSpBonus`: returns 1 (additive +1).

Two narrow hooks rather than one combined hook keeps each concern's chain independent — a future passive that wanted to modify only one axis (e.g., a hypothetical "Discount Math Spells" item) doesn't have to handle both.

### 6. `DamageContext.additionalPowerCoefficient` — the damage pipeline's id-lookup workaround

The damage handlers (`magical_ma_power`, `physical_pa_wp`, `healing_base`) re-look up the source ability by id from the catalog before reading `power_coefficient`. This is correct for the original use case (the catalog is the source of truth for ability data) but means a dispatcher-synthesized ability with a bumped `power_coefficient` is ignored.

To carry the Math Skill SP bonus through the pipeline, added an optional field to both `RunDamagePipelineArgs` and `DamageContext`:

```ts
readonly additionalPowerCoefficient?: number;
```

`effectivePowerCoefficient` reads it: `base + chainAdditional + additionalPowerCoefficient`. The healing handler reads it directly. The dispatcher passes the resolved SP bonus value through; non-Math callers leave it undefined (no-op).

CT-push effects don't have this problem — they're resolved inline in `resolveAbilityEffect` from `args.ability` directly, so the synthesized ability's bumped `ctEffects[*].factor` takes effect without any pipeline plumbing.

### 7. New `mathSkillMpCost` field on `ActiveAbilityDefinition`

Math Skill abilities declare their per-target MP rider:

```ts
readonly mathSkillMpCost?: { readonly perTarget: number };
```

The full MP cost at cast time is `mpCost + perTarget × matchingTargetCount`, with `perTarget` composed through `modifyMathSkillPerTargetMpCost`. v1 Math abilities all declare `mpCost: 4, mathSkillMpCost: { perTarget: 3 }`. Non-Math abilities omit it (the per-target term doesn't apply outside `resolveMathSkillDispatch`).

The full MP cost is deducted up front by `reduceUseAbility`, not by the dispatcher — keeps `mpSpent` on the outcome aligned with the actual cost. The dispatcher re-enumerates the matched set to confirm cost agreement; the state is identical between the two reads.

## Consequences

**Engine:**
- Closed hook surface grows 13 → 15.
- New TargetingSpec kind + AbilityTarget payload variant — additive discriminated-union extension.
- New `engine/targeting/` directory housing the Math Skill predicate enumerator (and any future predicate-based targeting).
- New optional fields on `CtEffectSpec` (`faithScalesMagnitude`), `ActiveAbilityDefinition` (`mathSkillMpCost`), `DamageContext` (`additionalPowerCoefficient`), `RunDamagePipelineArgs` (`additionalPowerCoefficient`), `ResolveAbilityEffectArgs` (`additionalPowerCoefficient`).
- New dispatcher branch (`resolveMathSkillDispatch`); existing single-target / AoE paths unchanged.

**Content:**
- 5 Math Skill abilities + 1 Math Skill command set + the Calculator class + 3 R/S/M passives + 1 new status type (Engineered Defenses) + 1 status type for Cornered Focus.
- Mathematician is the *anti-parasitism lever*: cross-class Math Skill users (e.g., Mage equipping Math as secondary) can match Calculator's output only by sacrificing Conductor.

**MA factor concern resolved as a no-op:** The brief / blueprint's "missing MA factor in status formula" is incorrect against the post-ADR-0028 engine. Sculpted Enhancement and Engineered Defenses inherit the canonical Faith × MA chance by leaving `factors` undefined. No engine work; the brief stands corrected.

## Alternatives considered

- **Single combined hook** for SP bonus + per-target MP modulation: would couple two orthogonal concerns. Rejected.
- **Math Skill as an `AbilityEffects.mathSkill?: true` flag on otherwise-AoE abilities**: tempting since AoE has the per-target dispatch pattern, but Math Skill's predicate-enumeration semantics differ fundamentally from footprint expansion. The `TargetingSpec` kind is the cleaner home.
- **Engine-side gating of per-target MP cost in `modifyMpCost`**: rejected — the per-target multiplier depends on the resolved cluster size, which `modifyMpCost` doesn't see. Adding a `targetCount` arg to that hook would over-fit a narrow concern.
- **Synthesize the ability's `damage.power_coefficient` directly in the dispatcher**: tried, didn't work — the damage pipeline re-looks up by id from the catalog. The `additionalPowerCoefficient` shim threads through DamageContext instead. Documented in handoff as a small engine-side wart: a future cleanup could make the damage handlers trust `ctx.ability` (or take it via env), eliminating the catalog re-lookup. Not session-49 scope.

## References

- `docs/thirtyNinePlanning/calculator-blueprint.md` — design spec.
- `docs/thirtyNinePlanning/session-49-brief.md` — implementation brief.
- `src/engine/targeting/math-skill.ts` — predicate enumerator.
- `src/engine/actions/reducers.ts` — `resolveMathSkillDispatch`.
- `src/engine/hooks/hooks.ts` — `modifyMathSkillPerTargetMpCost`, `modifyMathSkillSpBonus`.
- `src/content/abilities/{precision-fire, targeted-treatment, exact-rhythm, sculpted-enhancement, engineered-defenses, mathematician, cornered-focus, thoughtful-pacing}.ts`.
- `src/content/classes/calculator.ts`, `src/content/command-sets/math-skill.ts`.
- `src/content/statuses/{engineered-defenses, cornered-focus}.ts`.
- ADR-0028 (status formula factors — the source of `factors: { faith: true, ma: true }` default).
- ADR-0079 (KO + permanent status retention — Cornered Focus inherits).
- ADR-0083 (bow weapon substrate — the per-ability-data precedent the math_skill TargetingSpec follows).
