# M2 Progression — Class Tiering, Unlocks & JP Costs (implementation brief)

**Status:** review-ready draft. Plaintext review is a hard gate before implementer handoff.
**Companion (authoritative data):** `m2-jp-costing-budget.md` — the per-ability cost table (~110 numbers),
the costing rubric, the pricing principles, and the validation sweep. **This brief specifies the
*mechanism*; the budget doc holds the *data and rationale*.** The brief points at the budget doc for
individual costs rather than duplicating them (single source of truth; no drift).
**Scope:** the **JP** side of M2 progression — the class-tier/unlock tree, JP-gated ability access, and
the two combinatorial-kit reworks. **JP generation rate is a scoped-open design item** Chris brings
completed mid-session (working anchor ~87 JP/battle ≈ ~14/action).
**Out of this brief:** XP/levels (independent currency; see `m2-progression-xp-jobtree-brief.md`), the M3
item/gil economy, the Hybrid Tier-3 capstone class (undesigned), AI awareness.

---

## Context
M2 introduces cross-battle progression. Levels (XP → stat curves) are handled elsewhere. This brief
builds the **JP economy**: units earn JP, spend it to unlock abilities, and that same spend gates the
class tree. It sits on top of the existing ability/loadout substrate (Command Sets, R/S/M buckets with
capacities) and the 14-class roster. Two classes (Alchemist, Calculator) need a small engine rework to
express their combinatorial kits through the unlock system.

## Inputs
- 14-class roster (implemented) with innate R/S/M and Command Sets.
- Ability/loadout system: actives ride Command Sets (1 default + 1 secondary, +1 via Magus Crown);
  R/S/M equip into buckets by capacity (reaction/support/movement, default cap 3 each; bucket cost 1–3).
- Stat curves (`buildBaseStats`) — unaffected; referenced only for the Calculator's self-gating rationale.
- `m2-jp-costing-budget.md` — costs + rubric + principles + sweep.

## Goal
Implement, as composable substrate:
1. A **per-unit JP ledger** (earned / spent) and **ability-unlock state** (which abilities the unit owns).
2. The **tiered class-unlock tree**: JP-spent thresholds open tiers; tier-scaled grants on unlock.
3. **JP-gated ability access**: actives = unlock-to-*use*; R/S/M = free-in-class, JP = unlock-to-*export*.
4. The **two combinatorial-kit reworks** (Alchemist, Calculator): always-on combinator over unlocked
   components.
5. **JP generation** wired to a single tunable rate (value/mechanism injected mid-session).

---

## The design (folded in for self-containment)

### Tier map (3-2-1 per half + hybrids)
```
              PHYSICAL                 MAGICAL                     HYBRID
  Tier 1   Alchemist, Monk, Hunter   Pyromancer, Hydrologist,      —
                                     Geosage
  Tier 2   Knight, Thief             Aethurge, Enchanter        Terraformer, Templar
  Tier 3   Assassin                  Calculator                 [capstone — undesigned, out of scope]
```
Starter: on hire, a unit picks **one Tier-1 class** (six options). It has a usable active < ~100 JP.

### Unlock thresholds (JP values from budget doc; all tunable)
Gating is on **cumulative JP spent within a tier, within a half** (confirm this reading during audit):
- **500 in Tier 1** (a half) → that half's **Tier 2** AND the *other* half's **Tier 1**.
- **1000 in Tier 1 + 500 in Tier 2** (same half) → that half's **Tier 3**.
- **500 in *both* halves' Tier 1** → **Hybrid Tier 2** (Templar, Terraformer).
- **1000 in Hybrid Tier 2** → **Hybrid Tier 3** (capstone; class undesigned — leave the seam, no content).
- **Whole tier opens** at threshold (all classes in it become reclass-able at once).

### Tier-scaled unlock grant
On unlocking a class (generation or tier milestone): **Tier 1 = 100 + random; Tier 2 = 200 + random;
Tier 3 = 300 + random.** Rationale: higher tiers arrive later, so the larger grant is the earned
head-start, and it solves the Calculator's combinatorial dead-until-three-components onboarding (T3's
300 covers its cheapest functional triple, 275). Tier 1 unchanged, so the early economy is untouched.
*Spillover (overflow past a threshold / unused JP from prior class) = TBD, leave a seam.*

### Relief valve — plot-unique pre-unlocks
Certain authored units start with a higher-tier class pre-unlocked (early-Ch1 Assassin + Calculator give
a Tier-3 *taste* without opening T3 for generics). This is a **per-unit class-access override field** on
the campaign-unit model — the first concrete consumer of the unique-character override layer. Treat
pre-unlock as a scarce authored resource (design rule; not a mechanic to enforce, but a budget to honor).

### Ability-cost model (the gating semantics)
- **Actives** — unlock-to-**use**. Buying an active adds it to a Command Set the unit wields wholesale
  (as the class, or as its one secondary set). Price paces how fast the combat kit comes online. Actives
  are *not* individually equippable outside their Command Set.
- **R/S/M** — **free while in the native class**; the JP cost is the **export tax** to equip the passive
  on a *different* class. (A native Geosage pays 0 for Biomastery; a Knight pays Biomastery's JP to run
  it.) Native-only passives (Expert Former, Mathematician) have no export path — priced for native value,
  never exportable.
- **Bucket cost** (loadout capacity, 1–3) is separate from JP and already exists; unchanged here.

### Combinatorial-kit model (Alchemist + Calculator)
Both express power as a **combinator over components**. Rule: **the combinator is always-on-but-empty
from unlock; the components are the JP-unlocks** (prevents the fuel-less-engine dead zone).
- **Alchemist:** Compound + Throw Item are always-on interfaces (0 JP) that read the unit's **unlocked
  item set**. The four items (Potion, Phoenix Down, Remedy, Ether) are the JP-unlocks that populate them.
  No item economy — the limiter is turns + MP.
- **Calculator:** the Math cast is always-on; the components are **Payloads (5) × Parameters (4) × Values
  (4)**, each JP-unlocked independently (Model 1). A cast requires ≥1 unlocked payload, parameter, and
  value. **Engine rework: separate Parameters and Values into distinct unlockable component sets**
  (currently coupled). This is the matched pair with the Alchemist's combinator rework.

### Per-ability costs
**All ~110 costs live in `m2-jp-costing-budget.md`** (per-class tables). Enter them as ability data; do
not restate here. The doc also carries the resolved cross-class ladders (mobility, stat-multiplier,
reaction) and the one capped value (**Biomastery ≤ 450**, never above Conductor).

---

## Implementation work (over-specified so the audit can prune)
1. **JP substrate.** Per-unit `jpLedger` (earned, spent) + `unlockedAbilities` set + per-tier-per-half
   spent-JP accumulators. Compose via existing state patterns; emit post-state absolutes (don't make UI
   reconstruct). JP earning hooks into action resolution (rate injected mid-session).
2. **Tier-unlock engine.** Threshold checks on the accumulators → open tiers (whole-tier). Tier-scaled
   grant on unlock. Reclass-access query: which classes a unit may currently become. Per-unit
   class-access override for plot-uniques.
3. **Ability-access gating.** Enforce: active usable iff unlocked (in an equipped Command Set); R/S/M
   equippable on a non-native class iff unlocked (native = free). Native-only passives never exportable.
4. **Combinator reworks.** Alchemist (always-on Compound/Throw over unlocked items) and Calculator
   (always-on Math cast over unlocked Payload/Parameter/Value sets; **separate Parameters and Values**).
   Reuse `modifyStatQuery`-style composition where a component modifies a computed set.
5. **Cost-data entry.** ~110 JP costs from the budget doc into ability data. Combinator components
   (items; payloads/parameters/values) are cost-bearing unlock entries, not abilities-in-buckets.
6. **JP generation.** Wire a single tunable generation rate into action resolution. **Value + mechanism
   (per-action vs per-battle vs mild level-scale) injected by Chris mid-session** — leave the parameter
   and the hook, default to the ~14/action working anchor so nothing blocks.

## Acceptance criteria
- Spending JP on abilities accumulates per-tier-per-half; thresholds open the correct tiers (whole-tier);
  crossing 500-in-T1 opens same-half T2 + other-half T1; etc.
- Tier-scaled grants apply on unlock (100/200/300 + random by tier); a freshly-unlocked class can afford
  its intended entry (T3 Calculator affords a functional triple on unlock — no dead zone).
- Active gating: an unlocked active is usable via its Command Set; a locked one is not.
- R/S/M export gating: native class runs its passives free; another class needs the JP unlock; native-only
  passives (Expert Former, Mathematician) cannot be exported at all.
- Alchemist: unlocking one item enables Compound+Throw of *that* item, full loop, with no combinator
  usable before any item is owned.
- Calculator: Parameters and Values are independently unlockable; a cast requires one of each axis + a
  payload; unlocking a component lights up all newly-valid triples.
- Biomastery data ≤ 450.
- Regression: existing loadout/bucket/Command-Set behavior unchanged; three-resolver parity (live engine
  / AI projection / UI forecast) preserved for any new gating query.

## Out of scope
XP/levels (separate handoff); M3 item/gil economy; Hybrid Tier-3 capstone *class content* (leave the
unlock seam only); AI awareness of the new systems; spillover mechanic (seam only); the generation-rate
*mechanism decision* (Chris brings it — implement the confirmed result).

## Files (likely touched — audit to confirm)
- New: JP-ledger / unlock-state / tier-accumulator state + reducers; tier-unlock + reclass-access logic.
- `src/content/abilities/*` — cost data entry; Alchemist item-unlocks; Calculator component split.
- Ability-access / loadout gating layer (compose, don't special-case).
- Campaign-unit model — per-unit class-access override field.
- Tests across the above.

## Workflow notes
- **Plaintext review before handoff is a hard gate.**
- The **two combinator reworks are the substrate-audit items** — expect the audit to confirm the engine
  is cleaner than this brief assumes and prune accordingly (audit-overturns-spec pattern).
- The **generation rate is a mid-session design injection** — build the seam and the tunable; Chris
  supplies value + mechanism during the session.
- Compose on existing patterns (three-resolver discipline, post-state-absolutes, `modifyStatQuery`
  composition, system_damage bypass); refuse to special-case unless genuinely new.

## Watch-fors
- **Combinator dead-zone:** never let a combinator be usable with zero components, and never require the
  combinator as a separate unlock — components only. (The whole point of the rework.)
- **Calculator accelerating-power curve:** late component unlocks light up many triples at once — a
  content-*sequencing* risk (don't land a hard story battle as a player closes the lattice), not a
  pricing bug. Flag for the Calculator's arc author.
- **Drip-pacing:** watch each class's *sorted* cost list for a gap where nothing's affordable for several
  battles (bimodal cheap-actives + expensive-exports). Budget doc has the per-class lists.
- **Biomastery cap** (≤ 450) and the resolved ladders — the budget doc is authoritative if any number
  here and there disagree.

## Estimated size
**Large.** A new progression substrate (ledger + unlock-state + tier engine) + two engine reworks + ~110
data entries + gating + tests. **Candidate for a substrate session (JP ledger + tier engine + gating)
followed by a content session (cost entry + combinator reworks)** — the audit should recommend the split.
