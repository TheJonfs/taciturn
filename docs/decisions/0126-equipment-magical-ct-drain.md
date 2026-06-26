## ADR-0126: Equipment magical-damage CT drain (Ring of Caliora)

**Status:** Accepted
**Date:** 2026-06-26

## Context

S74 wanted Ring of Caliora: MA +2, and the wearer's damaging **spells** also
reduce the target's CT by ~20% of the damage dealt — a tempo-denial rider on the
CT throughline (Greaves seeds CT, the Ring drains it).

The substrate already existed: the `onFinalDamage` hook (ADR-0065) fires after
the damage pipeline finalizes the integer `damageDealt`, and Rasp Pendant's
`damageMpDrainPercent` rides it to emit a `system_mp_drain`. CT manipulation has
its own action, `system_ct_push` (delta-based, reducer floors CT at 0). The Ring
is the obvious composition of the two.

## Decision

Add `damageCtDrainPercent?: number` to `EquipmentBase`. A new
`finalDamageCtDrainContributor` rides the existing `onFinalDamage` hook and emits
a negative `system_ct_push` of `floor(damageDealt × percent / 100)` against the
target. It is composed with the MP-drain contributor into a single
`finalDamageContributor` (the hook map holds one contributor per hook).

- **Gated to magical, landed hits:** `damageTags.has('magical')` (the Ring
  rewards spellcasting, not weapon swings), `!absorbed`, `damageDealt > 0`,
  `floor(...) > 0`, target not KO'd — mirroring the MP-drain gates plus the
  magical filter.
- **`SystemCtPushSource` gains `{ kind: 'equipment_ct_drain'; itemId;
  attackerId }`** for action-log attribution.
- **No per-hit cap; the 0-floor is the only guardrail (Chris's call).** The
  `system_ct_push` reducer already floors at 0. The session deliberately ships
  the strong version to feel out the field-wide case in playtest rather than
  pre-emptively capping. See Consequences.

Ring of Caliora: `{ statMods: { ma: 2 }, damageCtDrainPercent: 20 }`.

## Consequences

- A single-target nuke drains a modest slice (a 40-damage spell → 8 CT). On a
  **Calculator's field-wide Math Skill** (Precision Fire matching the enemy
  team) the drain fires per matched enemy, so one cast can rob CT off the whole
  enemy team — repeatable toward a tempo soft-lock. This is the flagged
  epicenter case; it is **uncapped on purpose** and is a playtest-watch item. If
  it proves oppressive, the cheapest knobs are a per-hit cap
  (`min(floor(0.2 × dmg), CAP)`) or a CT floor above 0 — both localizable to the
  contributor without touching the channel.
- The channel generalizes: any future "spell damage also pushes CT" rider is one
  field. A *positive* CT push (haste-on-hit) would want a sibling field, not a
  negative percent.

## Alternatives considered

- **A bespoke `system_ct_drain` action.** `system_ct_push` with a negative delta
  already does exactly this and floors at 0; a second action would duplicate it.
- **Drain on all damage, not just magical.** The Ring is a caster accessory and
  the flavor is spell-momentum theft; gating to `magical` keeps weapon users from
  free-riding and matches the MA +2 stat line.
- **Ship with a per-hit cap.** Considered and explicitly declined this session —
  Chris chose to playtest the uncapped version first (consistent with the
  ship-then-prune scope preference).
