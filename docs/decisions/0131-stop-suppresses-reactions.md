## ADR-0131: Stop suppresses reactions (frozen-in-time)

**Status:** Accepted
**Date:** 2026-06-27

## Context

Audit question (S75): how does Stop interact with reactions, and should a
Stopped unit be able to Counter? The audit found that **Stop had zero reaction
interaction**. `stop.ts` registered only `queryTurnSkipped`, which
`reduceTurnStart` consumes to skip the unit's own turn (and suppress its
per-unit-CT status ticks during that skip). Nothing touched `onActionTargeted`
(the reaction-firing choke point) or `onActionAttempted`. A grep confirmed **no
reaction-suppression mechanism existed anywhere** in the engine. So every
reaction — Counter, Damage Split, Discharge, Tidal Pull, Smolder, Earth
Resilience — fired normally on a Stopped unit, Brave-gated as usual.

That diverges from FFT, where Stop disables both action *and* reaction (a
Stopped unit is frozen in time). The codebase already drew the related
distinction the other way for **Don't Act**, which *deliberately allows*
reactions ("you can't *plan* to act, but reflexes still happen" — reflex vs.
volition). Stop is a stronger condition than Don't Act: nothing happens at all.

## Decision

A Stopped unit fires **no reactions**. Make it general, not Counter-specific —
a Stopped unit that Counter-attacks but can't Damage-Split-reflect would be
arbitrary. "Frozen units don't react" is the coherent rule, and it sharpens the
existing contrast: **Don't Act → reflexes OK; Stop → frozen, nothing.**

Implementation:

- New data flag `StatusEffectType.suppressesReactions?: boolean` (default
  `false`), in the same style as `removeOnSourceKO` / `controlOverride` /
  `remedyImmune`. Stop sets it; Don't Act and Don't Move do not.
- The gate lives at **`runOnActionTargeted`** — the single choke point every
  reaction kind flows through (use_ability, reflect `system_damage`,
  `apply_status`, `ct_push`). Before collecting handlers, if any of the
  reactor's active statuses has `suppressesReactions`, return no reactions.

## Why this layer, not `onActionAttempted`/validation

`onActionAttempted` (where Don't Act blocks volitional casts) only sees
`use_ability` reactions like Counter. Damage Split's reflect, Tidal Pull's
ct_push, and Earth Resilience's apply_status are **system actions that don't
re-validate** through that path, so gating there would suppress Counter but leak
the others. `runOnActionTargeted` is the one place all reaction kinds are
enumerated, so a single check there is uniform. The check reads only status
state, so it stays pure and replay-safe.

## Why a data flag, not a new hook

Ground rule 8 ("hook surface is closed") makes adding a hook a deliberate cost.
A `queryReactionSuppressed` hook parallel to `queryTurnSkipped` was the "purer"
alternative, but a boolean data flag scanned at the choke point is cheaper,
matches multiple existing precedents (`removeOnSourceKO` is scanned the same
way in the source-KO sweep), and adds no hook surface. If a future status needs
*conditional* reaction suppression (suppress only some reaction kinds, or only
under a predicate), promote to a hook then.

## Consequences

- **Player-facing rules change:** Stop now disables reactions as well as the
  turn. Stopping a Counter / Damage Split / Discharge user neutralizes their
  reactions for Stop's duration — Stop is a stronger lockdown than it was.
  Logged in `guide-changelog.md`.
- Don't Act / Don't Move behaviour is unchanged (reactions still fire — Don't
  Act's reflex exemption is intact; regression-tested).
- **AI follow-on (flagged, not done):** the AI's `reactionPenalty` still assumes
  reactions fire, so it over-fears attacking a Stopped Counter-user. A Stopped
  target should drop the penalty. Minor mis-valuation, non-blocking; verifiable
  via the S75 both-AI sim seam. Noted in `playtest-watch.md`.
- Any future "frozen" status (Petrify, Freeze, Sleep-as-frozen) opts in by
  setting `suppressesReactions: true`.

## References

`src/engine/catalog/definitions/status-effect-type.ts` (flag),
`src/engine/hooks/runners.ts` (`runOnActionTargeted` gate),
`src/content/statuses/stop.ts` (consumer),
`src/engine/hooks/reaction-suppression.test.ts` (tests). Contrast: Don't Act's
reaction exemption (ADR-0027). Reaction firing / Brave gate: ADR-0021. Same-team
reaction filter: ADR-0062.
