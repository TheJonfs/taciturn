## ADR-0019: Physical hit roll location in damage pipeline

**Status:** Accepted (implementation lands session 14)
**Date:** 2026-05-06

## Context

The Battle Mechanics Guide formalizes the physical hit roll: `hit_chance = weapon_accuracy × (1 - target_evasion[facing] / 100) × elevation_modifier × hit_modifiers`, clamped to `[0.05, 1.0]`.

Today the seven-stage damage pipeline initializes `hit: true` and lets handlers override. v1 ships no evasion handlers, so every physical attack auto-hits. The reconciliation report (item 2.6) asked: when the hit roll lands (session 14), where in the pipeline does it fire? Two reasonable shapes:

1. **A new pipeline stage `evasion_check` that runs before any base damage stage**, with an early-exit if `hit = false` (skip remaining stages, finalize damage = 0).
2. **A handler at an existing stage** that sets `hit = false` and lets `finalize` zero out the damage.

The pipeline architecture comment in `damage.ts:80–84` already anticipates option 2 ("future handlers override").

## Decision

**A new stage handler `evasion_check` runs at the `target` stage of the damage pipeline. It computes hit chance per the Battle Mechanics Guide's formula, rolls against it, and sets `ctx.hit = false` if the roll fails. The `finalize` stage reads `ctx.hit` and produces `finalDamage = 0` when false.**

The pipeline keeps its seven stages — no eighth stage introduced. The evasion check lives at `target` because the data it reads (target's evasion, target's facing relative to attacker, elevation differential) is target-side.

`evasion_check` short-circuits in two cases:
- The ability is flagged as auto-hit (per ability format spec: omit `hitRoll` field → auto-hit).
- The ability's damage tags include only non-physical tags (e.g., a pure `magical` spell).

Magical damage doesn't roll to hit — per the guide, magical damage always lands. Physical damage rolls. Mixed-tag (`physical` + something else) is treated as physical for hit-roll purposes.

## Rationale

**Why use an existing stage rather than introduce a new one.** The seven-stage pipeline is architectural; reorderable handler lists *within* a stage are the ruleset's lever. Adding an eighth stage means an engine change, not a content change — a higher-cost decision that's only justified if the rule needs to fire at a position no existing stage covers. `target` is the natural fit: target-side data, runs after `attacker` (so attacker-side modifiers — Concentration, etc. — have already contributed any `hit_modifiers`), runs before `environment` (so the eventual environmental hit modifiers, if any, can read the rolled hit value).

**Why a handler rather than special-cased early-exit.** Handlers are uniform across stages — each takes context and returns context. A special "the orchestrator early-exits on hit = false" rule would mean the orchestrator knows about hit semantically, which is a non-uniform handler-vs-orchestrator concern. Letting `finalize` produce damage = 0 from `hit = false` keeps the pipeline rule "stages compose context, finalize reads it, that's it."

**Why critical hits, which fire at variance stage, run after evasion_check.** The variance stage handles per-ability variance roll *and* critical hit roll. The variance/crit handlers run regardless of `hit`. If `hit = false`, they roll but their results don't matter — finalize sees the missed flag and sets damage = 0. This is wasteful in the "missed attack still rolls crit" sense, but the rolls are deterministic by seed so they're effectively free. The alternative (variance/crit handlers gating on `hit`) means each handler ramifies the hit check — more places where hit semantics live, more chance of drift.

**Why auto-hit short-circuits in the handler.** If the ability is auto-hit, the evasion_check handler reads ability metadata and returns `ctx` unmodified (default `hit: true`). The check still runs through the stage; it just decides "no roll needed." This keeps the pipeline rule uniform — every action runs the same stages — and the auto-hit determination lives next to the hit-roll determination.

## Consequences

- **No new pipeline stage.** The seven-stage architecture stays intact.

- **`evasion_check` joins the default ruleset's `target` stage handler list.** It runs alongside `fire_on_damage_received` (the existing `target`-stage handler that fires the `onDamageReceived` hook chain). Order within the stage: `evasion_check` runs first (so `onDamageReceived` handlers see the resolved `hit` value), then `fire_on_damage_received`.

- **The Battle Mechanics Guide gets a sentence in its hit-chance section.** Specifically: "The evasion check fires at the target stage of the damage pipeline; the finalize stage produces damage = 0 when the check fails."

- **Auto-hit semantics live in the handler.** The handler reads the action's ability through the catalog (sourceAbilityId), checks for the `hitRoll` field's presence, and short-circuits when omitted. This matches the ability format spec's "omit `hitRoll` for auto-hit" approach.

- **Magical-only damage skips the roll naturally.** The handler checks the tag set; if no physical tag is present, the roll skips and `hit` stays true.

- **Class evasion data lands in session 14.** Per the plan's "Type extensions" list, ClassDefinition gains `evasion: { front: number; side: number; back: number }`. The evasion_check handler reads this from the target's class, optionally modified by `modifyStatQuery` against a future `'evasion'` stat name (deferred until status content needs it).

- **Reactions still trigger on hit, not on miss.** The Counter check today gates on `damageDealt > 0`. A missed attack produces `damageDealt = 0`, so Counter doesn't fire — that's the correct behavior; you don't counter what didn't connect.

- **Critical hits and variance still roll on a miss.** The rolls are wasted work but deterministic. If profiling ever shows it matters, the variance/crit handlers can early-return when `hit = false`. Today, premature optimization.

## Alternatives considered

**Pre-stage gate that early-exits the pipeline on miss.** Rejected — requires the orchestrator to know about hit semantics, breaks the "stages compose context uniformly" rule.

**Hit roll at the `attacker` stage.** Rejected — attacker-side data (PA, weapon accuracy) is already at `attacker`, but evasion is target-side. Putting hit at attacker means the handler has to look up target data through the context, which is fine but the natural location for "uses target.evasion" is the target stage.

**Hit roll at the `variance` stage** (alongside critical-hit roll). Rejected — variance is conceptually "per-ability damage variability"; mixing hit-determination there would conflate two different rolls into one stage. The variance stage is for damage variability *given hit*; the evasion check determines whether we even get there.

**Per-ability override of hit-stage placement.** Rejected — pipeline structure is engine architecture. Per-ability variability lives in the handler logic (auto-hit short-circuit, damage-tag short-circuit), not in stage placement.

## References

- `src/engine/types/damage.ts` — DamageContext with the `hit` field.
- `src/engine/damage/pipeline.ts` — orchestrator with `hit: true` initialization.
- `src/content/rulesets/default.ts` — current default ruleset's stage handler lists.
- `docs/battle-mechanics-guide.md` — physical hit chance formula.
- Reconciliation report item 2.6.
