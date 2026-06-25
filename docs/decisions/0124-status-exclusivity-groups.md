## ADR-0124: Status exclusivity groups — mutual exclusion across types

**Status:** Accepted
**Date:** 2026-06-25

## Context

Playtest surfaced that the permanent equipment/auto buff forms and their timed
cast siblings stack and compound. Sera (Assassin) with Boots of Haste (`haste`,
Speed ×1.5) plus an Auramancy Haste cast (`quickening`, Speed ×1.5) reached
~×2.25 Speed (observed SPD 34). The same latent double-stack exists for
Protect (`protect` / `protect_cast`), Shell (`shell` / `shell_cast`), and
Regen (`regen_auto` / `regen`) — all four pairs are live via equipment grants
(Boots of Haste, Defender, Sorcerer's Robe, Tintinibar) plus the corresponding
casts.

Each pair is two **distinct `StatusEffectType`s on purpose**: `durationMode` is
a type-level field, so a permanent form (`permanent_per_unit_ct`) and a timed
form (`per_unit_ct`, dur 6) cannot be one type. They already share their *hook
behavior* via a base file (the regen/regen_auto pattern). But the stacking
system (`applyStackingRule`) only compares instances of the **same** `typeId`,
so it never sees `haste` vs `quickening` as related — they coexist and both
fire their hook, compounding.

Chris's call: treat each pair as one conceptual effect — at most one active at
a time, no compounding.

## Decision

Add an optional `exclusivityGroup?: string` to `StatusEffectType`. At
application time, if the incoming status declares a group and the unit already
holds a **different-typed** status with the same group, the application is
**rejected** (`{ kind: 'rejected', reason: 'exclusivity_group' }`, a new reason
on the application outcome). Same-type re-application is untouched — it falls
through to the per-type `stackingRule` (re-casting still refreshes).

- **Resolution policy — reject the redundant one, first-holder-wins (D1).**
  Equipment/auto grants apply at `createInitialState` (battle start), so the
  permanent form takes the slot and a later timed cast of the sibling is the one
  rejected. **Consequence, accepted:** a stronger Aura-Mastery-amplified cast
  (ADR-0122) cannot upgrade a unit already wearing the weaker equipment form —
  but its AoE still buffs allies who lack the equipment form, so the cast is not
  wasted. The alternative (strongest-wins via effect-gating/suppression) was
  rejected as more machinery than the problem warrants — and removing the
  permanent form to let a timed cast win would destroy it permanently (equipment
  grants re-apply only at battle start), so a clean "replace" wasn't available.

- **Resolved at apply time, not compute time.** The `modifyStatQuery` /
  `onDamageReceived` hooks that carry these effects receive no catalog, so they
  can't determine group dominance when computing. The apply pipeline *does* have
  the catalog (it already looks up the incoming type and partitions existing
  statuses), so the check lives there — a few lines after partitioning, before
  the composer/amplification/candidate steps. No new hook surface; no cached or
  stored "suppressed" flag (consistent with ground rule 5).

- **Scope — all four pairs.** Groups: `'haste'` (haste/quickening), `'protect'`
  (protect/protect_cast), `'shell'` (shell/shell_cast), `'regen'`
  (regen_auto/regen). Regen included for consistency though only Haste/Protect/
  Shell were named — it is the same bug.

## Consequences

- Boots of Haste + a cast Haste now yields ×1.5 Speed, not ×2.25. Likewise for
  Protect/Shell damage multipliers and Regen HoT.
- The mechanism is general: any future "second source/duration of an effect a
  unit already has another form of" gets one `exclusivityGroup` tag on both
  forms and can't compound. Documented as an authoring note in
  `docs/design/status-effects.md`.
- Different groups remain fully independent (haste + protect coexist).
- `StatusApplicationOutcome`'s `rejected` reason widens to
  `'stacking_rule' | 'exclusivity_group'`.

## Alternatives considered

- **Strongest-wins via effect-gating / suppression:** both forms coexist but
  only the dominant contributes; a stronger timed cast overrides the permanent
  form for its duration, then the permanent resumes. More "correct" (handles the
  upgrade case, nothing lost), but needs the effect gated to the dominant
  instance at compute time — which the hooks can't do without catalog access, so
  it would require a cached suppression flag recomputed on every status change.
  Deferred; revisit only if the upgrade case matters in play.
- **Merge each pair into one type:** impossible — one type can't be both
  permanent and timed (`durationMode` is type-level).
- **Per-type `REJECT` rule:** doesn't apply across different `typeId`s.
