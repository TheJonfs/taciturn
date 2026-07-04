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

## Consequences / seams left open (content half + later)

- **The campaign fold does not stamp `usableActives` yet** — M0/M1 units fold
  ungated (`undefined`), so existing campaign play is unchanged. Flipping real
  masks on happens when authored unlock states + a reclass/spend UI exist.
- **`COMPONENT_CATALOG` ships empty** — the ~110 real costs are content-session
  data. All selectors are table-driven, so they pick up the numbers with zero
  code change.
- **Combinator enumeration filters** (Alchemist items; Calculator params/values +
  a trivial id→label registry extraction) + defensive validator re-checks are
  content-session wiring on the mask built here.
- **Tunable assumptions to confirm:** `GRANT_RANDOM_RANGE` (brief says "+ random"
  without a bound); the per-action earning rate + final "connecting" predicate
  (Chris's injection); spillover on over-threshold spend (brief seam, unbuilt).

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
