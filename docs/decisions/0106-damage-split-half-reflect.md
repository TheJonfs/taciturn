## ADR-0106: Damage Split reflects half (not full) damage

**Status:** Accepted
**Date:** 2026-06-12

## Context

Damage Split (Terraformer native Reaction, ADR-0088 / Session 53) fires when the
wearer takes a damaging, non-healing hit and survives. As authored, it emitted:

- a `system_damage` to the attacker for the **full** damage the wearer took, and
- a `system_heal` to the wearer for **half** that damage.

That matched the terraformer blueprint's spec verbatim
(`docs/thirtyNinePlanning/terraformer-blueprint.md`, line 214: *"heals for half
the damage dealt; attacker takes equal damage to original"*). So the
implementation was faithful — this is a **design change**, not a bug fix.

A playtest (the team-builder follow-up session) flagged the feel: a Templar
Jumping a Damage-Split unit for 101 took the **full 101** back while the unit
healed 50. Full reflect makes the reaction a very harsh punish — attacking a
Damage Split unit at all is near-symmetric trade plus a heal, which over-rewards
a single equipped Reaction. The name "Damage Split" also reads more naturally as
*splitting* the hit in two than as a full counter-plus-heal.

## Decision

Damage Split now **splits the surviving hit in two**: `floor(X/2)` reflected at
the attacker and `floor(X/2)` healed on the wearer (where `X` is the damage the
wearer took). Both halves floor independently, so odd `X` rounds each down (51 →
25 / 25).

Mechanism: the `reflect_damage` reaction-effect kind gained
`reflectNumerator` / `reflectDenominator` (parallel to the existing
`selfHealNumerator` / `selfHealDenominator`), so the reflected amount is
`floor(damageDealt × num / denom)`. Damage Split authors `1/2` for both. A `1/1`
author reproduces the original full-reflect, so the substrate still supports it
for any future ability. A reflected amount that floors to 0 emits no
`system_damage` (guarded), matching the existing heal-skip-on-zero behavior.

Everything else is unchanged: still Brave-gated, still survival-gated, still
`system`-tagged (bypasses the pipeline — no variance/Faith/resistance — and can't
cascade into the attacker's own reactions).

## Consequences

- Supersedes the blueprint's full-reflect spec; the blueprint line and the
  `damage-split.ts` header are updated to the half/half model.
- The reflect is gentler — a Damage Split unit punishes attackers but no longer
  hands back the entire hit. Net effect on an attacker dealing `X`: they take
  `floor(X/2)`, the wearer ends down `ceil(X/2)`.
- Player-facing; logged to the guide changelog.
- No replay-determinism impact (the change is a pure magnitude on an already-
  deterministic emission).
