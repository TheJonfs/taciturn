## ADR-0020: Magical damage formula and the Faith pipeline

**Status:** Accepted
**Date:** 2026-05-06

## Context

Session 14's mandate is the magical damage foundation. Per the Battle Mechanics Guide, magical damage scales as:

```
base_damage = MA_user × power_coefficient × Faith_factor
final_damage = base_damage × variance × resistance_modifier × magical_modifiers
```

with `Faith_factor = (Faith_user / 100) × (Faith_target / 100)` symmetric across damage and healing, and `MA_user` modifiable through the `modifyStatQuery` hook chain. The session also wires the resistance system (per ADR-0015 / 0016), the evasion check (per ADR-0019), and the Faith pipeline as a shared piece of plumbing across magical damage, healing, and the future status-application formula (session 16).

Two implementation questions had to settle:

1. **Where does `Faith_factor` live?** A standalone helper (called by every consumer), an inline calculation (each consumer redoes the math), or a stage handler (composed into the pipeline as a multiplier)?
2. **Where does the magical handler dispatch?** The pipeline already has handlers gated on tag (`physicalPaWp` gates on `'physical'`, `healingBase` gates on `'healing'`); magical damage gates on `'magical'`. Same pattern, new handler.

## Decision

**Magical damage ships as a new base-stage handler `magical_ma_power`, gated on the `'magical'` tag, computing `MA × power × Faith_factor`. Faith_factor is extracted to a shared helper `computeFaithFactor(state, catalog, attacker, target)` that reads each unit's faith through `modifyStatQuery` and returns the symmetric `(Faith_user / 100) × (Faith_target / 100)`. The helper is reused by `healingBase` (so healing also Faith-factors) and is the future home for the status-application formula's Faith term in session 16.**

Pipeline stage placements:
- **Base stage**: `physical_pa_wp`, `magical_ma_power`, `healing_base`. Three independent tag-gated handlers; only the matching one(s) contribute to baseDamage. (Mixed `physical` + `magical` tag sets — hybrid abilities like a "thunderbolt-strike" sword — would compose by adding both base contributions, which is the natural behavior of the pipeline. v1 has no such ability; the design space stays open.)
- **Target stage**: `evasion_check` first (ADR-0019), then `resistance_check` (this ADR's complement to ADR-0015 and ADR-0016 plumbing), then `fire_on_damage_received`.

## Rationale

**Why a helper rather than a stage handler.** Faith_factor has three consumers (magical damage, healing, status application) and the math is identical across them. A stage handler would only fire when the pipeline runs; status application doesn't run the damage pipeline (it runs its own application formula in session 16). A pure helper that consumers call directly factors the duplication out without coupling status-application to the damage-pipeline machinery.

**Why `modifyStatQuery` for faith reads.** Future status content will modify Faith — Brave/Faith manipulation is documented in the Battle Mechanics Guide and is a Mediator-style mechanic for later classes. Reading through `modifyStatQuery` means Faith reads are uniform with PA / MA / Speed reads; new buffs that modify Faith plug in at the same hook surface. v1 has no such buff, so the chain is identity today and the helper returns `baseStats.faith` directly.

**Why the magical handler's shape mirrors `physicalPaWp` / `healingBase`.** The base stage's contract is "look at the in-flight ctx, decide whether your tag applies, contribute to baseDamage, return ctx." Three handlers with the same shape and different tag gates make the dispatch pattern obvious. New tag-gated base handlers (a future "necrotic" handler, etc.) follow the same template.

**Why not bake Faith into the variance stage as a multiplier.** Faith is a *base* factor in BMG's formula, not a multiplier on top of variance. Multipliers compose multiplicatively at the finalize stage; baking Faith there would conflate "scales with caster's power" (a base-stage concern) with "fluctuates around the base" (the variance stage's purpose).

## Consequences

- **`computeFaithFactor` exported from `engine/damage/`.** Re-exported through the engine barrel for status application (session 16) and any future formula consumer. The helper is pure given (state, catalog, attacker, target).

- **`magical_ma_power` ships in the registry.** `defaultDamageHandlers` includes the new ref; the default ruleset's base-stage list lists it alongside `physical_pa_wp` and `healing_base`. Tag-gating keeps each handler's contribution to baseDamage zero-impact when the tag isn't present.

- **Healing now Faith-factors.** The previous `healingBase` skipped Faith — Cure healed for `MA × power` flat. Faith on the demo defaults to 80, so healing drops by `0.8 × 0.8 = 0.64` (Cure's MA 4 × power 5 × 0.64 = 12, was 20). This matches the BMG's "symmetric Faith on healing" rule and is the design intent — high-Faith targets are easier to heal, low-Faith targets reduce effectiveness on both casters' and targets' sides. The existing damage-integration test was updated to expect 12 healing.

- **Default Faith bumped 70 → 80.** Session 13.7's handoff flagged 70 as "may be too low" — symmetric Faith 70 produces a 0.49× factor, halving every magical interaction. 80 produces 0.64×, which keeps demo numbers visible without overwhelming damage. The 80 default is a v1 placeholder; realistic Faith spreads land with content/tuning passes in sessions 16+. Documented in `engine/types/stats.ts` and in the demo battle config.

- **The magical formula doesn't include `magical_modifiers`.** BMG's formula reserves a slot for them (Magic Boost, elemental amplification). v1 has no consumer; the slot is filled by the existing `onDamageDealt` / `onDamageReceived` hooks composing multipliers at the attacker / target stages. New magical-modifier hooks add as content surfaces them; no new stage required.

- **`'voice'` and other ability-format tags don't yet drive damage handlers.** AbilityDefinition's `tags?` is for category interactions (Silence-blocks-voice, Fire-Support-adds-Burn-to-magical). Damage-tag dispatch lives on `effects.damage.tags` (the `DamageTag` union). Ability-tags vs damage-tags are intentionally separate namespaces.

## Alternatives considered

**Bake `magical` into a single base handler that switches on tag.** Rejected — keeps the per-tag short-circuit pattern, but folds three independent contributions into one function with internal branching. New base contributions (a future tag) would mean editing the existing handler. Independent handlers with tag-gates compose better.

**Land Faith as a stage handler at the variance stage.** Rejected per the rationale above. Faith is a base-stage scaling factor, not a finalize-stage multiplier.

**Skip Faith on healing for v1 (asymmetric — only damage uses Faith).** Rejected — BMG explicitly calls out symmetric Faith for healing as an FFT-faithful party-composition lever ("High-Faith units are easier to heal but easier to magic-damage"). Skipping it on healing would erase that design tension.

**Inline the Faith math in each consumer (no shared helper).** Rejected — three duplicates of the same `(faithUser / 100) × (faithTarget / 100)` calculation invite subtle drift. The shared helper makes "faith reads through modifyStatQuery" a single change site if hook composition needs to evolve.

## References

- `docs/battle-mechanics-guide.md` — magical damage and healing sections.
- `src/engine/damage/handlers.ts` — `magicalMaPower`, `healingBase`, `computeFaithFactor`.
- `src/engine/types/stats.ts` — Faith default 80 placeholder; comment notes the placeholder discipline.
- `src/content/battles/demo.ts` — demo Knight base stats.
- ADR-0014 — equipment integration deferred to session 17 (so the magical handler doesn't need WP).
- ADR-0015 — multi-tag composition via `signedMax` (consumed by `resistanceCheck` at the target stage).
- ADR-0016 — healing opts out of resistance modulation (consumed by `resistanceCheck`).
- ADR-0019 — physical hit roll at the target stage (paired pipeline change in session 14).
- ADR-0022 — resistance absorption deferred until first content consumer.
