## ADR-0138: M2 JP progression substrate (ledger, unlock tokens, tier tree, gating seam)

**Status:** Accepted
**Date:** 2026-07-04
**Milestone:** TABA M2 (progression) — the JP-economy substrate (first half)
**Brief:** `docs/TABADesign/m2-progression-jp-implementation-brief.md`
**Budget/data doc:** `docs/TABADesign/m2-jp-costing-budget.md`

## Context

M2 introduces cross-battle progression. This ADR covers the **JP-economy
substrate** — the durable per-unit ledger + unlock state, the tiered
class-unlock tree, the ability-use gating mechanism, and the per-action JP
earning seam. It deliberately does **not** enter the ~110 real ability costs
or rework the Alchemist/Calculator combinators; those are the **content half**
(the brief recommended a substrate→content split, and this session took it).

A three-agent substrate audit preceded implementation. It confirmed the brief's
own prediction that the engine is **cleaner than the brief assumed**, and
overturned the brief's biggest scope item (see Decision 3).

## Decisions

### 1. Gating is a fold-stamped, engine-opaque allowlist (brief's "Option B")

Active abilities are "unlock-to-use", but they ride whole Command Sets. Rather
than teach the engine about JP/progression, the unit carries the full Command
Set and gating is a per-unit **`usableActives` allowlist**:

- `UnitPlacement.usableActives?: ReadonlyArray<AbilityId>` → `Unit.usableActives?:
  ReadonlySet<AbilityId>`, threaded in `placementToUnit`.
- **`undefined` ⇒ every active usable.** Mage War / demo / hand-authored folds
  never set it, so they are byte-unchanged — the engine stays progression-
  ignorant, consuming an opaque allowlist it knows nothing about.
- Consumed at exactly two points: `computeAbilityDisableReason`
  (`use-turn-flow.ts`) greys a locked-but-visible member, and `validateUseAbility`
  (`validate.ts`) is the real enforcement (so AI / non-UI paths are gated too).
  Rider casts (weapon procs) and reactions bypass the gate — the same carve-out
  as the existing MP/budget bypasses.

The durable side stores `unlocks` (below); the fold **projects** the ability
subset — `usableActiveIds(unit, catalog)` = class free abilities ∪ unlocked
ability tokens — into the opaque battle allowlist. Actives are NOT free-in-class
(only the class's `freeAbilities`, e.g. Attack, are always usable); the combat
kit comes online as JP is spent.

### 2. One tagged-union unlock token; accumulators derived, not stored

> **Superseded in part by the Revision below:** the ledger is now **per-class**
> (`earnedByClass`), and `spent` turned out fully derivable so it is not stored.
> The `unlocks` tagged union and derived-accumulators decisions stand.

`CampaignUnit` gains three **stored** fields:
- `jpLedger: { earned, spent }` — both irreducible (a grant raises `earned`
  without a purchase, so `spent` isn't derivable). `available = earned − spent`
  is the only derived ledger value.
- `unlocks: ReadonlyArray<UnlockToken>` — the purchase record. `UnlockToken` is
  one tagged union over `{ability | item | mathParameter | mathValue}`, so the
  three progression surfaces the brief treats separately share one record and
  one mechanism (extending an Alchemist/Calculator later is "add a token").
  Array (not Set) per the plain-serializable save invariant (D-C).
- `classAccessOverride?: ReadonlyArray<ClassId>` — plot-unique pre-unlock relief
  valve (first consumer of the unique-character override layer).

Everything else is **derived** (rule 5), never persisted: `availableJp`,
`spentByTierSlot`, `unlockedTiers`, `reclassableClasses`. The per-tier-per-half
spend accumulators are a pure `sum` over `unlocks` against a static
component-cost catalog — caching them would be the exact "computed value in
state" anti-pattern. Serialization bumped **v2 → v3** (old saves hard-fail,
loud, not migrated).

### 3. The combinator "engine rework" is unnecessary — it's the same mask

The brief's item 4 assumes Alchemist and Calculator need an engine rework
(esp. "separate Calculator Parameters and Values, currently coupled"). The audit
found the opposite: Parameters and Values are **already** orthogonal in the
engine (distinct closed types, independent targeting args); the only "coupling"
is two hardcoded arrays in one UI picker. Neither combinator gates on any
per-unit set today — both enumerate purely at the UI layer. So both reworks
reduce to the **same** operation as active-gating: intersect an enumeration
against the unlocked token set at the UI enumeration site, with the combinators
staying 0-JP always-on shells (naturally empty-but-present with zero components).
This collapses the reworks from "engine surgery" to content-session enumeration
wiring. Confirmed with Chris.

### 4. Earning is a post-hoc action-log read, not a new hook

> **Revised below:** the *mechanism* is now concrete (Chris's rule) and the
> read moved to apply-back (it needs the full roster for bench spillover). The
> "post-hoc log read, no new hook" architecture stands.

JP is earned per connecting action (Chris: successful connects, not misses, not
reactions; exact rule is a later mid-session injection). Rather than add to the
closed hook surface (rule 8) or store JP mid-battle in the engine (rule 1), a
pure `computeEarnedJp(actionLog)` walks the terminal log — every discriminator
(`actorId`, `isReaction`, per-target `hit`) is already stored on committed
actions. It lives entirely in the campaign shell; the engine emits its normal
log and stays JP-ignorant; the read is deterministic (the log is a replay
artifact). The rate (`DEFAULT_JP_PER_CONNECTING_ACTION = 14`, the budget-doc
anchor) and the "connecting" predicate are **injectable** so Chris's final rule
is a one-line swap. `UnitBattleSummary.earnedJp` was added **with** its producer
(honoring the S80 "don't pre-build empty fields" rule); `applyBattleResult`
banks it into `earned` for survived/downed units, never for `lost`.

### 5. Tier tree is new campaign-side static data

The engine's `ClassDefinition` gains **no** tier/half concept. `CLASS_TIER_MAP`
(`ClassId → {half, tier}`), the threshold constants, and the component-cost
catalog are new campaign-side tables referencing classes by id (rule 4).
`unlockedTiers` seeds from the unit's current class (its slot, and for a
non-hybrid every tier climbed through) and layers the threshold rules on top.
The tier-scaled unlock grant (Tier N = N×100 + bounded random) is **deterministic
with a passed seed** (Chris's call — no ambient RNG), reusing the engine's
splitmix32 mixer.

## Revision (S81 cont.) — per-class pools, the earning mechanism, and the real costs

Landed immediately after the substrate, in the same session:

**Per-class JP pools (revises Decision 2).** Chris's earning rule credits JP to
named classes ("Knight JP", "Pyromancer JP"), which only has mechanical meaning
as per-class pools (FFT model). So the single `jpLedger {earned, spent}` becomes
`earnedByClass: Record<classId, number>` (stored) — and `spent` is now **fully
derived** (`spentInClass` = Σ a class's unlocked-component costs), so it isn't
stored at all. `available(class) = earned[class] − spent(class)`; buying a
component checks affordability in its **native** class; grants land in the
newly-unlocked class's pool. Tier-gating (`spentByTierSlot`) is unchanged — spend
was always attributed by native class. Save schema **v3 → v4**.

**The earning mechanism (revises Decision 4).** Per connecting action by a
player-roster unit: the actor earns `base(level) = floor(10 + level/4)` into its
current class; every OTHER roster unit (in battle **and benched**) earns `1/8`
of that into ITS current class (spillover accumulated exactly, floored once).
Only player-roster actions earn; a `lost` unit banks nothing (its actions still
feed others' spillover). Because spillover reaches benched units absent from the
battle, earning **moved from `summarizeBattleResult` to `applyBattleResult`**
(which has the roster + the log); `UnitBattleSummary.earnedJp` was removed. The
`base` equation and `connecting` predicate stay injectable — **XP reuses the
same trigger with a different `base`** (Chris). Grant random bound = **50**.

**The real ~110 costs (content half, item 1).** `component-catalog-data.ts`
holds the verified cost table from `m2-jp-costing-budget.md` (114 entries),
guarded by `component-catalog-data.test.ts`: every ability/item id resolves in
the catalog, native classes are valid, the two native-only passives are the only
non-exportable rows, and per-class sums equal the budget-doc near-master totals
(Geosage 1800 with the settled Biomastery 450; Hunter 1350 authoritative).

## Consequences / seams left open (content half remainder + later)

- **The campaign fold does not stamp any of the `usable*` allowlists yet** —
  M0/M1 units fold ungated (`undefined ⇒ all usable`), so existing play is
  unchanged for BOTH actives and combinator components. Flipping real masks on
  (projecting via `usableActiveIds` / `usableItemIds` / `usableMathParameterIds`
  / `usableMathValueIds` in `snapshot-fold.ts`) happens when authored unlock
  states + a reclass/spend UI exist.
- **Combinator picker filtering is DONE** (S81 cont.): the Alchemist Compound /
  Throw pickers and the Calculator Math picker grey/hide locked
  items/parameters/values, and `validateUseCompound` / `validateUseThrowItem` /
  the math-skill target validation re-check the same per-unit allowlists
  (`usableItems` / `usableMathParameters` / `usableMathValues` on `Unit`). As the
  audit found, this was UI-enumeration + validator wiring, NOT an engine rework.
  Dormant until the fold stamps (above).
- **Spillover on over-threshold spend** (brief seam, unbuilt) — still TBD.
- **XP→level** (`m2-progression-xp-jobtree-brief.md`) reuses the earning trigger
  with a different `base` equation; unbuilt.

## Files

- New: `src/campaign/progression/` — `tokens.ts`, `tier-map.ts`, `thresholds.ts`,
  `component-catalog.ts`, `ledger.ts`, `unlock.ts`, `usable-actives.ts`,
  `earning.ts`, `index.ts` (+ tests).
- `src/campaign/types.ts` — `JpLedger` + three `CampaignUnit` fields.
- `src/campaign/serialization.ts` — v3 + new-field validation.
- `src/campaign/{roster,battle-result,apply-back}.ts` — populate/earn/bank.
- Engine: `types/unit.ts`, `types/battle-config.ts` (`usableActives`),
  `setup/create-initial-state.ts` (thread), `actions/validate.ts` (gate),
  `ui/use-turn-flow.ts` (grey).
