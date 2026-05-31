## ADR-0090: Offensive AoEs can catch the caster (opt out of caster exclusion)

**Status:** Accepted
**Date:** 2026-05-31
**Session:** 55

## Context

ADR-0025 (#7) established `excludeCaster: true` as the engine default for AoE
abilities, and every AoE ability in the catalog adopted it, documented in each
file as the "FFT-canonical default." The intent was that a caster is not hit by
their own area spell.

S55 playtest surfaced the cost of that default: a Geosage cast Earth Cataclysm
on an enemy; the enemy moved adjacent to the Geosage before the (charged) spell
resolved; at resolution the AoE footprint — correctly recomputed from current
positions — covered the Geosage's tile, but the Geosage took no damage and no
status. The only reason was caster exclusion. Chris's call: an offensive AoE
should hit *whoever* is standing in the blast, the caster included. Catching
yourself in your own area attack is a real positional consequence, not a bug.

## Decision

The five **target-anchored offensive AoEs** opt out of caster exclusion by
declaring `excludeCaster: false`:

- `earth_cataclysm`, `earth_quake`, `fire_storm`, `tidal_wave`, `chain_lightning`

The two **caster-anchored** offensive AoEs (`maelstrom` cone, `flame_lance`
line) also declare `excludeCaster: false` for consistency, but it is a **no-op**
for them: cone and line footprints start one tile *ahead* of the caster
(`shapeOffsets` begins at forward step 1, never the origin), so the caster's own
tile is never in the affected set regardless of the flag.

The **engine default is unchanged** — `excludeCaster` still defaults to `true`
in `resolveAoeDispatch` / `aoe-preview`. This is deliberate: self-centered AoE
buffs/heals and any future ability that genuinely shouldn't hit its caster keep
the protective default for free. Only offensive AoEs opt out, at the content
layer. ADR-0025 (#7) stands as the engine default; this ADR records the
content-level exception for offensive AoEs.

A content test (`offensive-aoe-caster.test.ts`) pins `excludeCaster === false`
on all seven so the decision can't silently revert.

## Consequences

- A Terraformer/mage can now be caught in the blast radius of their own
  offensive AoE if it resolves on or adjacent to their tile — most relevant for
  charged casts whose target moves next to the caster mid-charge, and for
  point-blank casts.
- Friendly-fire policy is unchanged and orthogonal (ruleset `behaviors.
  friendlyFire`); caster inclusion is a separate axis from ally inclusion.
- The AoE forecast preview already mirrors the live filter
  (`aoe-preview.ts` reads the same `excludeCaster`), so the player's projected
  footprint will now show the caster's tile as affected when it falls in range.
- Balance watch: a powerful self-positioned nuke (point-blank Fire Storm /
  Cataclysm) now self-damages. Flagged in `playtest-watch.md`.

## Alternatives considered

- **Flip the engine default to `false`.** Rejected — would silently expose every
  AoE (including any future self-centered buff) to self-hit; the protective
  default is the right baseline, and offensive abilities are the minority that
  should opt out explicitly.
- **Fix Earth Cataclysm alone.** Rejected — creates an inconsistency where one
  offensive AoE catches the caster and the others don't, for no principled
  reason (Chris's call: apply the rule to all offensive AoEs).
