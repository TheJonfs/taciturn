## ADR-0108: Bull Rush + PA_factor; Assassin darts gate on line of sight

**Status:** Accepted
**Date:** 2026-06-13

## Context

Session 65 bundled Knight content, an equipment expansion, an MP rebaseline, and
a Barrier audit. Three of those produced architectural decisions worth recording;
the rest are content/tuning captured in commit messages.

### The Barrier audit (the gated piece)

A Barrier blocks `straight_line` attacks (it interrupts `hasLineOfSight`) and
melee approach paths (impassable), but **not** `arc` attacks — `arcTargetable`
only checks the source and target tiles, never the line between, so a lob clears
an intervening barrier (`src/engine/map/line-of-sight.ts`, `src/engine/map/arc.ts`).

The S60 cut (ADR-0097) flipped the elemental bolts to `straight_line` precisely
so a Terraformer's Barrier could matter to ranged combat. But it left the
Assassin's ranged-status darts — **Blowdart**, **Shadow Stitch**, **Undermine**,
**Sow Doubt** — on `arc`. The audit surfaced the full `arc` list to Chris:

- **Deliberately arc** (unchanged): bows (Charged Attack, Pin Down; the basic bow
  shot is `melee`), lobbed/area magic (Rock Toss, Earthquake, Cataclysm, Tidal
  Wave, Maelstrom, Fireball-family), support (Cure, Raise, buffs), Worldcraft
  placement, Discharge Strike.
- **The mis-fit:** the four Assassin darts. They are flat, fast projectiles, so
  a wall should stop them — and one (Shadow Stitch's ~2/3 Stop) is the core of
  the S65 "control sub-game," which only works if a Barrier can wall off the
  ranged disable.

### PA_factor

The status/ability application-chance model (ADR-0028) selects stat factors per
effect (`faith`, `brave`, `ma`, `speed`, `pa`). `PA_factor` was deferred — both
`computeStatusChance` and `rollAbilityChance` threw `NotYetImplementedError` on
the `pa` branch, awaiting a first consumer.

Bull Rush — a Knight weapon attack with a knockback rider — is that consumer.
A Knight's MA is 4 (the default mage-vs-martial split), so the default Faith×MA
knockback gate would be weak and would scale with the *target's* Faith (a devout
enemy resisting a physical shove — thematically wrong). Chris's call: gate the
Knight's Battle Skill riders on **Brave × PA** instead, and unify Lightning Stab
onto the same shape rather than splitting the kit on MA vs PA.

## Decision

1. **Barrier remedy A (widened):** flip all four Assassin darts from `arc` to
   `straight_line`. Bows and lobbed/area attacks stay arc. Remedies B (Barrier
   blocks arc too) and C (height-aware arc) are not taken — A is sufficient and
   surgical; the categorical changes are parked.

2. **Ship `PA_factor = 0.9 + PA / 10`** (mirrors `MA_factor`) at both chance-compute
   sites in `src/engine/status/chance.ts`. Bull Rush's knockback gates on
   `{ brave: true, pa: true }`; baseChance 85 nets ≈ 0.79 on a baseline Knight
   (PA 10) vs a Brave-70 target, with the symmetric Brave gate letting a
   high-Brave target resist (as Shadow Stitch's Stop does).

3. **Lightning Stab moves to `{ brave, pa }`** (was `{ brave, ma }`), baseChance
   recalibrated 50 → 34 to **hold** the prior landed Silence rate (PA 10 → factor
   1.9 vs MA 4 → 1.3; 50 × 1.3/1.9 ≈ 34). Formula consistency, not a buff.

## Consequences

- A Barrier (and ordinary terrain/unit cover) now stops the Assassin's ranged
  status pressure. The disable statuses are the offensive half of the control
  sub-game; the Barbut (Stop/Don't Move/Don't Act resist) is the defensive half.
  Watch in playtest whether the darts feel meaningfully more positional and
  whether the AI correctly declines a dart through cover (it inherits the
  `straight_line` LoS gate via the shared resolver path, same as the S60 bolts).
- `PA_factor` is now live for any future PA-scaled status applier, not just
  knockback. The deferred-formula `NotYetImplementedError` branch is gone; the
  class is retained (exported) for any future deferral.
- The Knight's two rider abilities now scale on the same stat (PA), so a high-PA
  build (Strength Ring, Martial Expertise) lifts both the Silence and the
  knockback rates together — a coherent identity lever.

## Alternatives considered

- **Blow Dart only → straight_line** (the brief's narrow lean): rejected as
  trajectory-inconsistent (the sibling darts are mechanically identical lobs) and
  because it would leave Shadow Stitch's Stop un-wallable, defeating the
  control-sub-game pairing.
- **Deterministic or flat-chance knockback** for Bull Rush: viable, but Chris
  preferred the Brave × PA gate so the shove reads as a contest of force/will and
  rewards the Knight's stat identity.
- **Barrier remedies B / C:** larger, systemic LoS changes; parked unless a
  future need arises.
