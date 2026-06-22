# ADR-0120 — Enchanter class, Auramancy buff resolution, and the RSM kit

**Status:** Accepted
**Session:** 72 (2026-06-22)
**Supersedes / relates:** ADR-0028 (status-application formula + factor selection), ADR-0057 (uncapped resistance), ADR-0056 (modifyActionSpeed), ADR-0026/0052 (fall damage + modifySystemDamage), ADR-0079 (stat-Saves persist through KO).

## Context

The roster lacked a dedicated ally-enhancement caster. Haste / Protect / Shell
existed only as equipment auto-status (permanent, equipment-grant lifecycle),
never as a cast a player could place. The Enchanter (13th class, 6th magical)
fills that gap and feeds the Thief's buff economy: the buffs it casts are
stealable. Auramancy is support-only by design — the Enchanter's offense comes
from a secondary command set, and Auramancy-as-secondary hands any class a buff
suite.

The brief settled four decisions (buff resolution = chance model ~90% net;
Float = no elevation; Resistance Save = magical-trigger + uncapped; Short Charge
= name settled, form an implementer call). Two further choices surfaced during
implementation: the **cast-buff duration model** and the **Esuna cleanse
substrate**.

## Decisions

### D1 — Cast buffs are timed sibling statuses, not the permanent equipment forms

The Enchanter's Haste / Protect / Shell apply **new timed status types**
(`quickening`, `protect_cast`, `shell_cast` — `per_unit_ct`, duration 6,
REFRESH, magnitudes 1.5 / 50 / 50), not the existing permanent
`permanent_per_unit_ct` `haste` / `protect` / `shell` (which stay the
equipment-grant forms). This follows the steer those source files already
carried ("a future cast-X spell ... author it as a sibling type rather than
retroactively re-typing this one"). Rationale: a permanent, reliable, AoE
damage-reduction buff from a spammable r1 caster is balance-heavy and leaves the
Enchanter idle after the opening; timed buffs give the dedicated-buffer
recurring work and keep the equipment lifecycle distinct. All three carry
`aiHints.polarity: 'buff'` + a non-equipment source ⇒ the Thief's Steal Buffs
lifts them with no extra wiring. *(Chris's call at the chunk-1 checkpoint.)*

### D2 — Buff resolution: baseChance 95, default Faith/MA factors, ~88% (≈90%) net

The three buffs use the standard status-application formula
(`base × Faith_factor × MA_factor`, no resistance tag). At the Enchanter's
MA 10 and default Faith 70: `0.95 × (0.7·0.7) × (0.9 + 10/10) = 0.95 × 0.49 ×
1.9 ≈ 0.884`. baseChance 95 is the round-number pick for the brief's "~90%."
The intended texture falls out of the formula: a single MA Up (MA 12) climbs to
~98% (toward always-on), a Faith-50 ally drops to ~63% and a Faith-40 ally to
~51% (low-Faith allies pointedly harder — intended). **Esuna is 100% /
Faith-independent** (removal, not application). *(baseChance set to 95 by Chris
at the chunk-1 checkpoint; was 97.)*

### D3 — Esuna cleanse is a declarative ability effect mirroring Remedy

Status removal previously existed only for consumables (`clearStatuses`). Added
a declarative `cleanse: { polarity: 'debuff' }` field on `AbilityEffects`,
dispatched per-target in `resolveAbilityEffect`, mirroring the Remedy path
exactly: removes every non-buff, non-equipment, **non-`remedyImmune`** status.
So Esuna and Remedy cleanse the **same set** (Poison, Blind, Silence, Stop,
Don't Act/Move, Slow, Burn…) and both leave the committed stat-downs
(PA/MA/Brave/Faith/Speed Down) alone. Making Esuna also strip stat-downs is a
documented one-line lever (drop the `remedyImmune` skip).

### D4 — Short Charge is a multiplier (×1.33), not a flat add

Short Charge is a universal charged-action-speed Support via the
`modifyActionSpeed` chain hook (instants stay instant; works for any class).
Form analysis against the actSpd spread (basics ~30, ultimates ~18): a **flat
add** disproportionately front-loads slow ultimates (a +10 is +56% on an 18
ultimate but +33% on a 30 basic), flattening the deliberate fast-basic /
slow-ultimate tier separation the kits are tuned around — the exact distortion
the brief warns of. A **multiplier** scales evenly (30→39, 18→23) and matches
FFT's proportional charge-time spirit. Chosen: **×1.33, floored** (the magnitude
is a single-constant tuning lever). *(Form recommended at the chunk-2
checkpoint; magnitude set to 1.33 by Chris, up from the ×1.25 recommendation.)*

### D5 — Resistance Save: magical-trigger, uncapped elemental accumulation

Reaction; on taking **magical** damage (`damageTagsAny:['magical']`,
`minDamage:1`, excludes healing), applies +10 to the `resistance_save`
accumulator (STACK_ADDITIVE, permanent, polarity:buff) which adds its magnitude
to all four elemental resistances via `modifyResistance`. **Uncapped** (brief
D3, consistent with the other stat-Saves — Speed Save / Cornered Focus /
Updraft). Note: the trigger is magical, the grant is elemental — a pure
non-elemental magical hit still arms it, then hardens the unit against the four
elements (intended; flagged in the handoff as a possible refinement).

### D6 — Float: water-cost negation + fall immunity, no elevation (revived)

Float (revived from S48 `'hidden'`, 1 → 2 SP) negates water move-cost (water
tiles → `min(cost,1)` via `mapTerrainCostsByTag` — stronger than Tidewalker's
partial shave) and grants fall-damage immunity (`modifySystemDamage`, the
Bedrock Stride pattern; the v1 "ground hazard"). **No elevation / Jump effect**
(brief D2 — Float is not Fly).

## Consequences

- New substrate: `AbilityEffects.cleanse` (one consumer, Esuna). No new hooks —
  Short Charge / Resistance Save / Float all ride existing hook surfaces.
- The Enchanter is added to the mage-gear `classRestrictions` tier (universal +
  magical gear) — 11 item files.
- **Balance watch:** reliable AoE Protect/Shell shifts time-to-kill across the
  whole roster; the buff→steal interaction is now live; the low-Faith-ally
  penalty should read as texture, not a frustrating whiff. All logged for the
  playtest pile.

## Status of the buff economy loop

Closed end-to-end (test): an Enchanter-sourced `quickening` on an ally is lifted
onto a Thief by Steal Buffs.
