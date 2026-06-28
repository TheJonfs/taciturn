## ADR-0132: The Monk's net-new substrate (WP=PA, grapple-throw, stance management, PA-heal/MP-restore, self-CT-refund)

**Status:** Accepted
**Date:** 2026-06-28

## Context

Session 76 introduced the Monk (14th class, 6th physical) — a barehanded,
PA-scaling, stance-dancing martial artist. The class-intro audit (S76 brief)
found most of the kit rides existing substrate (the `exclusivityGroup` status
field for the four stances, the `tagged_resistance_shift` model for per-element
resistance, tagged-physical damage + absorption, the `modifyEvasion` hook for
Vigilance, the PA+Brave status-application path for Foxfire's Burn, the
`system_ct_push`/fall-damage primitives), but five genuinely net-new pieces
needed building. This ADR records those decisions.

## Decisions

### 1. `modifyWeaponPower` hook → Barehanded WP=PA (the PA² punch / no Fist explosion)

Added `modifyWeaponPower` to the closed hook surface (a deliberate engine
change per ground rule 8). It's a chain over the effective Weapon Power, fired
inside `physicalPaWp` **only when the damage carries the `'weapon'` tag**, and
passed the attacker's already-modified PA. **Barehanded** registers it: while
both hands are empty, WP = PA.

The tag gate is the whole balance lever. The basic `attack` is `'weapon'`-tagged
→ WP=PA → the punch is `PA × PA × 1.0 = PA²`. The four Fists deal element-tagged
physical damage **without** the `'weapon'` tag → the chain never fires → they
keep the unarmed WP=1 → `PA × coefficient`. So a Fist can't PA²-explode; the
only access to the quadratic is the stance-less, rider-less punch. The
quadratic is uncapped on purpose (melee-committal + magic-exposed-while-punching
is self-balancing).

*Alternative considered:* extend `modifyStatQuery` with a `'wp'` pseudo-stat.
Rejected — WP isn't a unit stat, and the dedicated hook reads cleaner and
composes like `modifyEvasion`.

### 2. `grapple_throw` targeting + `effects.grappleThrow` → free-target placement (Bear's Heave)

Existing forced-movement (`applyKnockback`) is strictly directional. Bear's
Heave needs free-target *placement*: pick a unit AND a destination tile. Added a
new `AbilityTarget`/`TargetingSpec` variant `grapple_throw` (carrying
`{ unitId, destination }`, `throwRadius`, `throwVerticalTolerance`) — modelled
on the precedent of `tile_set` (Barrier) and `math_skill` as bespoke compound
targets. Validation enforces grab reach, a Manhattan-diamond throw radius around
the throwee's current tile, an existing + unoccupied + barrier-free destination,
and an upward-elevation ceiling (downward unbounded — ledge throws are the
point). Resolution (`resolveGrappleThrow`, a dedicated path parallel to
`resolveSelfMove`) relocates the throwee for 0 direct damage and reuses the
shared fall-damage path for ledge drops. **Decision (S76 D5):** both enemies
(displace onto hazards / ledges) and allies (reposition) are legal throwees.

### 3. Pre-resolve stance management (`setStance` + `clearCasterExclusivityGroup`)

The existing `exclusivityGroup` field *rejects* a newcomer when a sibling is
present (so Haste/Quickening don't double up). Stances need the opposite:
the new Fist must **replace** the incumbent. Rather than add a replace-policy to
the exclusivity machinery, the reducer manages stance **pre-resolve** in
`reduceUseAbility`: `clearCasterExclusivityGroup` removes every same-group status
on the caster, then `setStance` applies this Fist's stance deterministically
(no incumbent → no rejection). Running it pre-resolve and uniformly means it
works across damage Fists, Chakra (clears, sets nothing → neutral), and Bear's
Heave (which short-circuits to `resolveGrappleThrow`). The stance statuses still
declare `exclusivityGroup: 'stance'` as a safety net + the group tag the clear
reads.

### 4. `damage.healingStat` + `effects.mpRestore` (Chakra)

Healing was hard-wired to MA. Added `damage.healingStat?: 'pa' | 'ma'` (default
`'ma'`) so Chakra scales its heal off the PA monostat, and `effects.mpRestore`
(a per-affected-target `system_mp_restore` of `caster_stat × coefficient`,
deterministic — no Faith) so Chakra restores MP alongside HP. Both compose with
the existing AoE dispatch (friendly-fire footprint, the Cure-style spatial
downside). A new `'ability'` `SystemMpRestoreSource` variant carries the
provenance.

### 5. `effects.selfCtRefund` (Serpent's Coil)

A deterministic self-CT refund after a landed hit: emits a `system_ct_push` on
the caster of `factor × caster_stat` (default `'spd'`), once per cast. Distinct
from `ctEffects` (chance-gated, target-facing) — the refund must be reliable
tempo, not a coin flip the Monk's low Faith/MA would fail.

## Consequences

- One hook added to the closed surface (`modifyWeaponPower`, now 14-ish). One
  new `AbilityTarget`/`TargetingSpec` kind (`grapple_throw`) with the
  attendant exhaustiveness cases. Several additive `AbilityEffects` fields.
- The Monk is engine-complete and tested (`session-76-monk-integration.test.ts`,
  13 tests). AI uses the Fists + self-heal Chakra; stance-management and
  ledge-throw valuation are out of AI scope (hand-judged per the brief).
- The `grapple_throw` two-stage targeting UI (pick unit → pick destination) ships
  as a new turn-flow route mirroring `tile_set`/Barrier
  (`grapple-throw-targeting.test.ts`, 6 tests) — so the full Martial Arts kit is
  human-castable. Pending **live verification** on the Pixi canvas (the
  setup→builder→deployment→in-battle target-select path isn't reliably
  automatable in the implementer environment); the app loads error-free and the
  helper/FSM logic is unit-tested.
- All coefficients (Fist power, Chakra magnitude, Burn rate, CT-refund factor,
  Vigilance evasion-per-PA) are starting values to tune via `sim:both-ai` +
  hand-play.
