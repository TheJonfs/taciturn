# AI Substrate

*The authoritative reference for how the AI decides. Established by the S89 audit (see
`docs/TABADesign/taba-ai-refresh-findings.md` for that session's matrix and scope call);
maintained forward — when a scorer branch, lever, or constraint changes, update this doc.*

Source lives in `src/ai/`. The AI is a **pure Engine reader**: it imports only from
`@engine/*`, never from the renderer or UI. Adapters that wire it into the orchestrator's
`Controller` interface live in `src/app/controllers/`.

## Shape at a glance

There are **no per-class policies**. One generic utility scorer (`decideBasicAi` in
`src/ai/basic.ts`) plays every class; per-class behavior is *emergent* from the class's
kit, because the scorer dispatches on **ability effect shapes** (`effects.damage`,
`effects.statusEffects`, `effects.aoe`, `effects.worldcraft`, …), not on class ids.
Class-specific code exists only where an effect shape is unique to one kit: Alchemist
item economy, Calculator Math Skill, Thief steals, Terraformer Worldcraft.

Consequence for content authors: **a new ability whose effect shape the scorer already
dispatches on gets played for free; a new discriminant is invisible until a scorer
branch values it.** The coverage table below is the checklist.

## Determinism

`decideBasicAi(state, catalog)` is a pure function with **no RNG at all** — candidates
are ranked by score with stable lexicographic tie-breaks (`compareScored`). Stochastic
outcomes (variance, evasion, crit, land-chance) enter only as *expected values* via the
projection. Same `(state, catalog)` → same decision, so replays hold by construction.

## Decision flow (`decideBasicAi`)

Every action class is scored in one commensurable currency —
**expected-damage-equivalent value × target value** (ADR-0092) — and competes in a
single candidate pool. No pre-empt cascade. The pool (each entry only when applicable):

| Candidate | Builder | Notes |
|---|---|---|
| Heal (single-unit `healing`-tagged) | `bestHealCandidate` | `effectiveHeal × killValue × HEAL_WEIGHT` |
| Self-heal AoE (Chakra) | `bestSelfHealCandidate` | S76; MP-restore/ally splash deliberately unvalued |
| Item throws (Potion/PD/Remedy/Ether) | `bestThrowCandidate` | Alchemist class or Alchemy secondary |
| Math Skill | `bestMathCandidate` | Calculator; 80-option enumeration, killValue-weighted damage |
| Charm (Steal Heart) | `bestCharmCandidate` | action-economy swing × contest chance, damped |
| Steal Buffs | `bestStealBuffCandidate` | per stealable buff × contest chance |
| Break-a-charm | `bestBreakCharmCandidate` | attack own `controlOverride` ally; hard-guarded |
| Grapple-throw (Bear's Heave) | `bestGrappleThrowCandidate` | S89; enemy drops via the shared fall currency; ally throws unvalued |
| Revive (Raise) | `bestReviveCandidate` | S89; valued like Phoenix Down (`maxHp × REVIVE_WEIGHT`) |
| Cleanse (Esuna) | `bestCleanseCandidate` | S89; Remedy currency over the footprint, enemy cleanses deducted |
| Worldcraft fall (Pit/Valley) | `bestWorldcraftFallCandidate` | engine's `buildElevationChanges`, signed fall value |
| Worldcraft perch (Pillar/Hill) | `bestPerchCandidate` | lift-in-place under an allied height-seeker only |
| Worldcraft revert trap | `bestRevertTrapCandidate` | spring a loaded raise via cap eviction; ally = hard veto |
| Barrier denial | `bestBarrierDenialCandidate` | screen most-threatened ally, net of own-offense cost |
| Joint offense + buff plan | `pickJointActOrMove` | see Move planning |

Fallbacks when nothing scores positive: distance-closing Move (`pickBestMove`), then
Alchemist Compound as last resort, then end turn.

**Key value weights** (`basic.ts` constants; all playtest dials — see
`docs/playtest-watch.md`): `HEAL_WEIGHT 0.7`, `REVIVE_WEIGHT 1.5` (Phoenix Down),
`CLEANSE_VALUE_PER_DEBUFF 15`, `STATUS_AOE_PER_TARGET_WEIGHT 15`,
`BUFF_SCORE_DAMPING_FACTOR 0.3`, `SELF_COST_DAMPING_FACTOR 0.25`,
`MP_SPEND_PENALTY_WEIGHT 1.5` (scarcity-scaled, S66), reaction penalty 15%/stack cap
40% (tag-aware), friendly-fire penalty 1.0, `killValue = 1 / max(0.05, hpRatio)`.

## The three-resolver discipline

The AI never re-derives engine math; it runs the engine's own resolvers so content
changes compose automatically:

1. **Damage projection** (`src/ai/projection.ts`): runs the live `runDamagePipeline`
   with a registry that swaps only the three random handlers (`variance_roll`,
   `evasion_check`, `crit_roll`) for closed-form expected-value variants. Everything
   else — PA/MA, weapon WP, Faith², resistance, Vulnerable, equipment/status hooks,
   weapon variance bands (knife speed, bow `height_delta`), accuracy, facing/elevation
   evasion, Del's Stave MP-dump SP — composes unchanged. Absorption (resist > 100)
   projects as 0 so the AI never "damages" an absorbing target.
2. **Coverage map** (`src/ai/threat/coverage-map.ts`, ADR-0094): "which enemies can
   reach-and-hit tile X this turn," mirroring `validate.ts` reach exactly (height-range
   bonus, `straight_line` LoS, `arc`, Vantage). Works on hypothetical states
   (`withBarrier`, `withElevationChanges`) through the same code path. Melee/ranged
   tagged by effective reach, so above-melee-reach safety falls out of geometry.
3. **Engine primitives reused for consequences**: `buildElevationChanges` (Worldcraft
   fall), `applyKnockback` (shove-into-hazard), `computeAbilityChance` /
   `computeThiefContestChance` (land chances), `estimateChargedTiming` (CT races,
   Speed-scaled charges included), `computeMpCost`, `runModifyAoeShape` (Aether Bloom).

## Move planning

- **Joint planner** (`pickJointActOrMove`): enumerates (destination, ability, target)
  triples over the actor's legal moves; commits the Act if best-in-place, else commits
  the Move leg and re-plans next call (one-decision-per-call cadence). Ranking:
  offence first; **residual danger is a tie-break only** (S59/ADR-0095 — a subtractive
  defensive term made the AI cower; the tie-break preserves engagement), then move cost.
  Plans that KO their target discount that enemy's danger.
- **Fallback move** (`pickBestMove`): closes distance to the priority target
  (highest killValue × Vulnerable bonus). Height-seekers (weapon declares
  `height_delta` variance or `rangeFromHeightBonus` — bows) blend a positional term:
  each tile of detour must buy `APPROACH_DISTANCE_FRACTION (0.25)` of the base shot in
  height-boosted damage (S56). Buff-cohesion (S73): when the team fields an AoE-buffer
  and the move is a pure advance, cluster toward the buffer within a 1-tile band.
- **Charged tile-pins** (S74): tile-anchored charged offensives (Charged Attack, Jump)
  are devalued ×0.35 when `estimateChargedTiming` says the target acts before the
  charge resolves (it can step off the tile); full value vs slow/Stopped targets.

## Deployment (`src/ai/deployment.ts`)

Pure geometry planner, separate from the in-battle scorer. Role per unit from equipped
weapon type (`deployRoleFromWeaponType`: bow/wand/staff → ranged, else melee;
ADR-0105). Melee sorted HP-descending claim the frontmost tiles (distance to opposing-
zone centroid); ranged sit behind. Sub-zones (S70) are filled round-robin front-first;
each wing keeps its own front/back line. Facing toward the opposing centroid.
Deployment-time exposure proxy is centroid distance, *not* the coverage map (neither
team is placed yet).

## Effect-discriminant coverage

The scorer's dispatch surface vs the content's effect vocabulary. **This is the table
to check when adding abilities.** (State as of S89.)

| Discriminant | Scored? | How / gap |
|---|---|---|
| `damage` (physical/magical/elemental) | ✓ | projection × killValue × reaction penalty |
| `damage` `healing` tag | ✓ | heal candidates (single-unit + Chakra self-AoE); AoE-heal splash unvalued |
| `damage.knockback` | ✓ | expected knock-into-hazard fall value (S66); flat-ground shove = 0 |
| `damage.chainBonus` | ✓ | per-cluster `targetCount` threading |
| `damage.lanceBonus`, `healingStat`, `noFaithScaling`, variance bands | ✓ | free via pipeline |
| `damage.ctPush` rider | — | rider unvalued (damage still scored) |
| `damage.lifesteal` rider | — | heal-back unvalued (damage still scored) |
| `statusEffects` buff (`aiHints.polarity: 'buff'`) | ✓ | buff potency (MA × #offensives, damped); AoE buffs by coverage (S74) |
| `statusEffects` debuff, damage-less, single-unit | ✓ | S89 floor: content-declared `aiHints.value` × real land chance (`computeStatusChance`) × target hpRatio; Vulnerable keeps its setup→exploit math |
| `statusEffects` debuff on damage-less tile AoE | ~ | coarse flat weight (15/target × hpRatio) |
| `aoe` diamond/square/cross/line/cone | ✓ | footprint via `aoeFootprint` + shape hooks |
| `worldcraft` elevation/barrier | ✓ | Tier A fall / B perch + barrier denial / C revert traps (S57–61) |
| `stealHeart`, `stealBuffs` | ✓ | S69 |
| `mpDrain` (Steal MP) | **✗ invisible** | no damage/status → never proposed |
| `ctEffects` (Tide Surge ally tempo; Exact Rhythm) | ✗ / ✓ | invisible as a regular ability; valued inside Math Skill only |
| `cleanse` (Esuna) | ✓ | S89: `bestCleanseCandidate` (cleansable count mirrors the dispatcher's `remedyImmune` skip) |
| `removeKO` (Raise) | ✓ | S89: `bestReviveCandidate` (still excluded from the *heal* path — revive is its own candidate) |
| `jumpLeap` (Jump) | ✓ | rides the S74 charged tile-pin branch (`tile` targeting + damage); pinned by scenario test (S89); airborne-safety unvalued |
| `grappleThrow` + `grapple_throw` targeting | ✓ | S89: `bestGrappleThrowCandidate` — enemy ledge-throws via the shared fall value |
| `selfMove` (Scramble) | **✗ invisible** | no damage/status → never proposed |
| `setStance` / `clearCasterExclusivityGroup` | — | stance riders unvalued; damaging stance Fists are scored as plain attacks (AI stance-swaps incidentally, never deliberately) |
| `selfCtRefund` rider | — | unvalued (damage still scored) |
| Alchemist `effects: {}` (Compound/Throw) | ✓ | dedicated item-economy candidates |
| item choice (which gear to equip) | ✓ (module) | `src/ai/gear-valuation.ts` — `scoreItemForUnit` / `rankItemsForUnit`, the M4 generator seam (stat gear + common patterns; exotic riders deliberately 0) |
| weapon `attackProcs` | ~ | v1: Silence-proc vs mage-class ×1.5 lean only |
| equipment `magicalReflectPercent` / thorn reflect | ✓ | S89: `reflectCostForAttack` nets the reflected fraction off the score; clean kills exempt (no posthumous reflect) |

## Inherited constraints (non-negotiable, from the S56–66 arcs)

- **Single-move horizon.** No multi-turn planning; every term must be evaluable from
  the current move. Utility candidates (Worldcraft, charm, steals) fire from the
  actor's *current position only* — move-then-cast is a closed non-goal.
- **Offence first-class; everything else subordinate.** Defensive/positional value is a
  tie-break or damped term, never a first-class goal (the cower lesson).
- **Compose, don't special-case.** New dimensions ride the pool, the coverage map, and
  the three resolvers. A new hook or resolver is a deliberate engine change.
- **Floor, not ceiling.** The campaign's asymmetric win condition (player must always
  win; AI needs to win once) means competent-and-legible is the target, not optimal.
  See the AI-refresh brief's legibility rule: a visible lever beats hidden cleverness.

## Test conventions

AI behavior is pinned by **scenario tests** in `src/ai/` (`session-NN-*.test.ts`):
build a state where the sensible play is clear, run `decideBasicAi`, assert the
decision (not the score). Unit tests for scoring internals go through
`_basicAiInternals`. Feel is judged by Chris's browser playtest — analysis never
overrides playtest.

## Standing deferrals (blueprint: `docs/thirtyNinePlanning/ai-capability-expansion-blueprint.md`)

- Predictive positional threat (Layer 2) — expansion-scale.
- Stat-attrition/control *ceiling* valuation (beyond any floor weights) — own session.
- Move-to-heal/move-to-buff reach; AoE-heal splash value; stance strategy;
  exotic-gear-effect optimization (Del's Stave timing etc.) — bonus-boss horizon.
- Tide Surge / generic ally-CT tempo, Steal MP (`mpDrain`), Scramble
  (`selfMove`), ally-rescue grapple throws, charge-delay discounts on
  Raise/Esuna — audited S89, deferred without loss (thin-but-playable kits).
- Calculator personality variants — closed (max-EV suffices).
