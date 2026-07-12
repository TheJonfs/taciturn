# TABA AI Refresh — WI1 Audit Findings (S89)

*Deliverable 1 of `taba-ai-refresh-brief.md`. The architecture summary was promoted to a
durable reference: `docs/design/ai-substrate.md` (read that first). This file holds the
session-specific findings: the per-class competency matrix, lever inventory, gear state,
and the scope call.*

**Headline:** the substrate is far stronger than the brief assumed — the S56–76 arcs
already taught it height, terrain, knockback-falls, deployment, and charged races. The
real gaps are **five effect discriminants the scorer never learned** (grapple-throw,
cleanse, revive, mpDrain, ally-CT) and **one systematically misvalued shape**
(damage-less single-target debuffs, scored through a proxy built for Magnetic Mark).
Per-class incompetence maps 1:1 onto those shapes. This is comfortably **not an arc**;
it's one heavy session or two comfortable ones.

## Per-class competency matrix

Bar = "a competent human wouldn't wince." *Competent* = plays its kit sensibly today.
*Thin* = plays, but ignores or misuses part of its identity. *Broken* = fails its
identity outright.

| Class | Verdict | Failure mode (one line) |
|---|---|---|
| Knight | **Competent** | Bull Rush knockback-fall valued (S66); Silence-stab rider unvalued but the attack is scored — fine at floor. |
| Assassin | **Broken** | Entire signature kit (Stop/Poison/Brave-down/Faith-down/Hamstring) is damage-less debuffs → misvalued by the Mark proxy, land-chance ignored; mostly basic-attacks instead. |
| Calculator | **Competent** | Explicit Math scorer (S49, killValue-rebased S69). Verified held. |
| Geosage (earth) | **Competent** | Quake/Cataclysm AoEs + Regen buff scored; Earth Curse (debuff-only) misvalued — minor, kit has real spells. |
| Hydrologist (water) | **Thin** | Tide Surge (ally CT-pull, half its identity) invisible; Brine misvalued; knockback waves valued correctly. |
| Pyromancer (fire) | **Competent** | Spark misvalued (minor); lance/storm/embrace all scored; Aether Bloom shape hook composes. |
| Aethurge (lightning) | **Competent** | The reference class (Mage War pass); Storm Caller self-cost damped; Mark's setup→exploit is the one *correct* use of the debuff proxy. |
| Alchemist | **Competent** | Explicit item economy (S39b, pool-integrated S57, MP-bottleneck-gated S73). |
| Hunter | **Competent** | High-ground seeking + height-range bonus + Vantage + charged tile-pin all live; Scramble (selfMove) unused, Pin Down misvalued — both tolerable at floor. |
| Templar | **Thin** | Jump rides the S74 charged branch (needs a pinning test); Cure scored (splash unvalued); **Raise never cast** (deliberate exclusion, predates Templar) — a healer that won't pick up a downed ally. |
| Terraformer | **Competent** | Deepest bespoke support: falls, perches, revert traps, barrier denial (S57–61). |
| Thief | **Competent** | Charm/Steal-Buffs/lifesteal scored (S69); Steal MP invisible — minor, identity intact. |
| Enchanter | **Competent (verify held: yes)** | S73/74 buff coverage + cohesion green; **Esuna invisible** — never cleanses (the one real hole). |
| Monk | **Thin** | Damaging stance Fists + Chakra scored; **Bear's Heave (grapple-throw) invisible** — the class's positional lever never fires; stance side-effects (±50 resists) unconsidered. |

## Lever inventory (WI3's list, audited)

| Lever | State |
|---|---|
| Hunter high-ground seeking | **DONE** (S56 approach term + S52 height-range + S68 Vantage; scenario tests exist). |
| Worldcraft floor (Terraformer) | **DONE, beyond floor** (Tier A/B/C + barrier denial; ally-drop hard vetoes). |
| Valley-style group fall damage | **CONFIRMED baseline** (Tier A scorer sums signed fall over the footprint). |
| Knock-into-hazard (Bull Rush, Tidal Wave, Maelstrom) | **DONE** (S66; chance-weighted, ally-shove penalized). |
| Fall-damage throw (Bear's Heave) | **MISSING** — `grapple_throw` targeting has no scorer branch. The one real WI3 gap. |
| Deployment role-aware sorting | **DONE** (S66 weapon-type roles + S70 sub-zones). Brief's bar met; coverage-map-aware deployment was audited out in S66 (no placed enemies pre-battle). |

## Gear-valuation state (WI4)

The standing deferral is **"AI ignores gear when choosing, sees most of it when playing"**:

- **Worn gear largely composes already** — the projection runs the live damage pipeline
  and hook surface, so WP, stat mods, evasion mods, resist bodies, variance bands,
  Aether-Bloom-style shape mods, Vantage, MP-cost mods, and Del's Stave's SP dump all
  affect scoring on both sides (the coverage map fears geared enemies through the same
  resolver). A geared enemy does NOT play as if naked today, with two exceptions:
  - **Reflect gear** (Mirror Shield `magicalReflectPercent`, Spiked/Masterwork thorns):
    the AI doesn't discount attacking a reflector (loadout reaction *passives* are
    penalized; item-field reflect isn't).
  - **Own effect riders** (lifesteal heal-back, CT-refund weapons): the damage is
    valued, the rider isn't — mild undervaluation, not misplay.
- **Nothing chooses gear.** No item-valuation function exists anywhere; the skirmish
  stub is gear-less *because* of this (D-ai-3's dependency is real). The M4 generator
  seam needs `scoreItemForUnit`-shaped valuation: stat gear + common patterns, explicitly
  not exotic effects (D-ai-1).

## Input gaps (flag-to-planner per the brief)

**None found.** Every lever the fixes need already has an engine query: grapple-throw
legality via `canCommitAction` + the targeting spec; fall values via
`buildElevationChanges` / `applyKnockback`; land chances via `computeAbilityChance`;
charge races via `estimateChargedTiming`. No engine changes required.

## Scope call: IN-BETWEEN — proceed on a bounded fix list, one design decision to settle

Not an arc. The audit prunes D-ai-2's "all classes" to **one broken (Assassin), three
thin (Monk, Templar, Hydrologist)**, and WI3 to **one missing lever (grapple-throw)**.
Proposed order, sized for this session with a natural cut line:

1. **Grapple-throw branch** (Monk floor + WI3's last lever). Enumerate grab targets ×
   throw tiles from current position; value enemy drops via the existing
   `fallValueForOccupant`; ally-rescue throws deferred (ceiling). Medium.
2. **Debuff-valuation floor** (fixes Assassin outright; upgrades Brine/Spark/Pin
   Down/Earth Curse). Replace the Mark-only proxy for damage-less debuff appliers with
   per-status floor values × the engine's real land chance. **Design decision for
   Chris:** where do per-status AI values live — `aiHints.value` on status content
   (content-declared, like `polarity`) or an AI-side weight table? Recommend `aiHints`
   (content already owns polarity; new statuses stay self-describing). Medium.
3. **Revive floor** (Templar): lift the Raise exclusion; value like Phoenix Down
   (`maxHp × REVIVE_WEIGHT`), discounted for the charge delay. Small.
4. **Cleanse floor** (Enchanter Esuna): mirror Remedy's `count × CLEANSE_VALUE_PER_DEBUFF`
   over the AoE footprint. Small.
5. **Jump scenario test** (Templar): pin that the S74 branch actually plays it. Small.
6. **WI4a — reflect-awareness**: penalize attacks into reflect gear (mirrors
   `reactionPenalty`). Small.
7. **WI4b — `scoreItemForUnit` valuation function** for the M4 generator seam + a
   worn-gear scenario test. Medium.

**Defer without loss** (recorded in ai-substrate.md deferrals): Tide Surge/ally-CT tempo
(blueprint already defers tempo valuation; Hydrologist stays thin-but-playable), Steal
MP, Scramble, stance-strategy, AoE-heal splash, lifesteal/CT-refund rider valuation.

If the session runs long, the cut line is after item 5: 1–5 deliver the competency
floor + the last lever; 6–7 (gear) are separable and self-contained for a follow-up.

---

## Outcome (same session)

**All seven items shipped** (ADR-0146); nothing was cut. Chris's rulings:
`aiHints.value` on content (not an AI-side table); both halves of WI4. Scenario
tests: `session-89-grapple-throw`, `session-89-debuff-floor`,
`session-89-support-floor` (Raise + Esuna + the Jump pin),
`session-89-reflect-awareness`, `gear-valuation.test.ts` — 28 new tests, suite
2733 green, `tsc -b` clean. The matrix now has no broken entries: Assassin plays
its Shadow Arts (Stop opener, no re-stitch, kill-over-debuff), Monk ledge-throws,
Templar raises and answers perch-campers with Jump, Enchanter cleanses.
`docs/design/ai-substrate.md`'s coverage table reflects the post-fix state.
Remaining judge: Chris's playtest eyeball (gold-plating watch — if skirmishes
feel oppressive, lower the new floors, not the offsets).
