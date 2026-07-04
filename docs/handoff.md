# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## UI design notes — M2 progression (for the planner)

The whole progression *engine* is built and tested; the remaining M2 work is the
**UI** (reclass/spend screens) plus flipping gating live. What the UI designer
needs to know from implementation:

### The two currencies have DIFFERENT shapes — this is the core mental model
- **JP is PER-CLASS.** A unit holds a separate JP pool per class it's earned in
  (`earnedByClass: Record<classId, number>`). Knight JP buys only Knight
  abilities. `available(class) = earned[class] − spent(class)`, where **spent is
  DERIVED** (sum of that class's unlocked-component costs) — not stored. So a
  unit screen shows N per-class balances, and each ability's affordability is
  checked against *its native class's* pool.
- **On top of JP, we track PHYSICAL/MAGICAL/HYBRID × TIER-1/2/3 aggregates** for
  unlock gating (the fact Chris gave the planner). These are ALSO derived
  (`spentByTierSlot` sums per-class spend into `${half}:${tier}` slots) — the
  UI's "progress toward the next tier" bars read these, never a stored field.
- **XP/level is SINGLE per-unit**, NOT per-class: one `xp` value + one `level`.
  (Don't mirror the JP per-class UI for XP.)

### JP / reclass / spend — the pure selectors the UI consumes
All exported from `src/campaign/progression/` (see `index.ts`):
- `earnedInClass` / `spentInClass` / `availableInClass(unit, classId, catalog)` —
  the per-class balances.
- `spentByTierSlot(unit, catalog)` → `Map<'${half}:${tier}', number>` — the tier
  aggregates for threshold progress bars.
- `unlockedTiers(unit, catalog)` → set of open `${half}:${tier}` slots.
- `reclassableClasses(unit, catalog)` → the classes a unit may become right now
  (already unions the plot-unique `classAccessOverride`). THE source of truth for
  the reclass screen.
- `componentMetaOf(token, catalog)` → `{ cost, nativeClass }` for any unlockable;
  `COMPONENT_ENTRIES` / `COMPONENT_CATALOG` are the full ~114-entry price list.
- `CLASS_TIER_MAP` (classId → {half, tier}) for laying out the tree.
- Ops (for when the UI commits a purchase/reclass): `unlockComponent`,
  `grantOnClassUnlock`, `canEquipPassive`.

### Unlockables are a TAGGED UNION, not just command-set abilities
`UnlockToken = ability | item | mathParameter | mathValue`. So the spend UI for
two classes includes non-ability components:
- **Alchemist:** the 4 items (Potion/Phoenix Down/Remedy/Ether) are unlockables;
  Compound/Throw are always-on 0-JP shells.
- **Calculator:** the 4 Parameters (CT/Height/Level/Current-HP) and 4 Values
  (Prime/3/4/5) are unlockables; the Math cast is the always-on shell. Its 5
  payloads are normal command-set actives.
Present these combinator components as buyable alongside abilities.

### Ability-type semantics the UI must convey
- **Actives = unlock-to-USE**: buying one adds it to the class's Command Set you
  wield wholesale. Not individually splashable.
- **R/S/M passives = FREE in the native class; JP is the EXPORT TAX** to unlock
  for equipping on another class. `canEquipPassive` returns the ruling. There is
  **NO hard class-lock** — every passive equips anywhere once unlocked. "Enabler"
  passives (Expert Former, Mathematician) are buyable + equippable off-class but
  are **INERT unless the unit also runs their Command Set as a secondary**
  (Mathematician does nothing without Math Skill equipped; Expert Former nothing
  without Worldcraft). The UI may want to *signal* that inertness (e.g. "needs
  Math Skill"), but must not block the equip.

### Thresholds (for progress bars / "unlocks at" copy)
500 in a half's T1 → that half's T2 + the OTHER half's T1. 1000 in T1 + 500 in
T2 → that half's T3. 500 in BOTH halves' T1 → Hybrid T2. Whole tier opens at
once. (Constants in `progression/thresholds.ts`.)

### Display names ≠ ids
The tree UI shows display names; ids are generic. Notably: Pyromancer=`fire_mage`,
Hydrologist=`water_mage`, Geosage=`earth_mage`, Aethurge=`lightning_mage`. Use
the catalog's class `name`.

### XP / level UI surfaces
- Between-battle: XP progress toward next level (`xp` / 100) per unit; stat growth
  per level follows the ADR-0137 curve.
- **In-battle level-up has NO banner yet** — it only shows as an action-log line
  ("reached Level N!") + the HP/MP bar jump. **A "Level Up!" banner is an open UI
  design opportunity** (needs a new animator primitive to implement).

### Gating is DORMANT until two things ship together
The engine enforces gating (`validateUseAbility` + the combinator validators +
menu greying all read per-unit `usable*` allowlists), but the **campaign fold
does not stamp those masks yet**, so campaign units currently play with
everything usable. "Turning JP gating on" = (a) the reclass/spend UI that writes
unlock state, + (b) flipping `snapshot-fold.ts`'s `campaignPlacement` to stamp
`usableActives` / `usableItems` / `usableMathParameters` / `usableMathValues` from
the projections (`usableActiveIds` etc.). Design the UI assuming it will be the
thing that makes unlock state matter. (XP/leveling, by contrast, is ALREADY live.)

---

## From S81 — TABA M2: JP progression substrate + per-class pools + costs (2026-07-04)

**Shipped** the JP-economy substrate AND most of its content half (ADR-0138,
briefs `m2-progression-jp-implementation-brief.md` + `m2-jp-costing-budget.md`),
across **two commits** (substrate, then per-class + earning + costs). A three-
agent substrate audit + a cost-mapping agent preceded the build. Suite green
(**2330**), `tsc -b` + `vite build` clean.

`src/campaign/progression/`: tokens, tier-map, thresholds, component-catalog
(+data — the real 114-entry cost table + guard test), ledger, unlock,
usable-actives, earning, index. Touched: `campaign/types.ts` (`earnedByClass` +
`unlocks` + `classAccessOverride?`), `serialization.ts` (**v4**),
`roster/battle-result/apply-back`; engine `unit.ts`/`battle-config.ts`
(`usableActives?`), `create-initial-state.ts` (thread), `actions/validate.ts`
(gate), `ui/use-turn-flow.ts` (grey).

### DONE (mechanism + data, tested)
- **Per-class JP** (Chris's call — revises ADR-0138's single pool): `earnedByClass:
  Record<classId, number>` STORED; `spent` fully DERIVED (`spentInClass`). Buying
  checks affordability in the component's native class; grants land in the
  unlocked class's pool. Save **v4**.
- **Earning mechanism** (Chris's rule): actor earns `floor(10 + level/4)` into
  its current class; every other roster unit (in-battle + BENCHED) earns `1/8`
  of that into its class; floored; only player-roster actions; `lost` banks
  nothing. Runs in **apply-back** (needs the roster for bench spillover), not
  the summarizer. `base` + `connecting` injectable — **XP reuses the trigger
  with a different `base`**. Grant random bound = **50**.
- **The ~110 real costs** — `component-catalog-data.ts` (114 entries), guarded
  by `component-catalog-data.test.ts` (ids resolve, native classes valid,
  per-class sums = budget-doc totals).
- **Gating mechanism:** `Unit.usableActives?` opaque allowlist, enforced in
  `validateUseAbility`, greyed via `computeAbilityDisableReason`. `usableActiveIds`
  projects unlocks → mask.

### DONE (S81 cont.) — XP & mid-battle level-up (ADR-0139)
- New action type `system_xp_award` (5-site wired). Emitted from the resolver
  (`buildXpAward` in the use_ability / throw / charged paths) for connecting,
  effect-having actions by leveling units: `10 + (targetLvl − casterLvl)` min 1,
  +10 KO; one grant/action; no-effect guard (caster MP excluded — it's the cost).
- `reduceSystemXpAward` levels mid-battle: swaps `baseStats` to the next
  precomputed entry, bumps HP/MP by the effective-max delta. `XP_PER_LEVEL=100`.
- The boundary fix: the fold precomputes `statsByLevel` (the engine can't run the
  curve). `LEVELUP_PRECOMPUTE_DEPTH=3`, PARAMETERIZED. Opt-in by field presence.
- `CampaignUnit.xp` (save **v5**); apply-back carries final level+xp home.
- **LIVE in campaign play** — the fold stamps every deployed player unit, so
  campaign battles now show leveling. (Gating stays dormant; XP does not.)
- Enemies don't level yet — their `statsByLevel` (+ JP/unlock tracking for a
  future recruit-conversion) gets authored when battles are created. Model is
  team-agnostic; don't assume player-only.
- **Polish TODO:** animator is a no-op for level-up (log line + HP-bar jump only);
  a floating "Level Up!" banner needs a new animator AnimKind. Also: KO purely
  from knockback/fall damage isn't credited the +10 (direct hits are).

### DONE (S81 cont.) — combinator picker filtering
- `Unit`/`UnitPlacement` gained `usableItems` / `usableMathParameters` /
  `usableMathValues` (opaque allowlists, siblings of `usableActives`; threaded in
  `placementToUnit`). Alchemist Compound greys locked items, Throw hides them,
  the Calculator Math picker greys locked params/values; the three engine
  validators (`validateUseCompound`/`validateUseThrowItem`/math-skill target)
  re-check. Projections `usableItemIds`/`usableMathParameterIds`/
  `usableMathValueIds`. Dormant until the fold stamps (below).

### REMAINING M2 (NOT done — next up)
1. **Flip the fold to stamp the `usable*` allowlists** — currently unstamped
   (M0/M1 ungated → play unchanged) for BOTH actives and combinator components.
   Project via `usableActiveIds` / `usableItemIds` / `usableMathParameterIds` /
   `usableMathValueIds` in `snapshot-fold.ts` once authored unlock states + a
   reclass/spend UI exist. The "make gating live" step.
2. **Reclass / spend UI** (M2 UI) — `reclassableClasses` + `unlockComponent` +
   `grantOnClassUnlock` are the model; no UI consumes them yet. (This + #1 are
   what "turn JP gating on" needs.)
3. **Spillover on over-threshold spend** (JP) — brief seam, still TBD.
4. **Enemy progression authoring** — statsByLevel + per-class JP + unlocks on
   authored enemy placements (deferred to battle-creation, per Chris).
5. **"Level Up!" banner** — animator polish (see XP TODO above).

**Watch-for (Field Kit vs item unlocks):** Field Kit (`field_kit`, Alchemist
Support) grants Potion/Phoenix/Remedy into the stockpile at battle SETUP,
regardless of item unlocks — so when gating goes live a unit could have a
stockpiled item it hasn't unlocked. The Throw validator now gates on
`usableItems` so it can't be *thrown*, but the stockpile still contains it
(harmless). If that's undesired, gate the `stockpileGrants` application too.

### XP brief now present
Chris added `docs/TABADesign/m2-progression-xp-jobtree-brief.md` (the XP→level
companion the JP brief referenced). **Not read this session** — it's the other
M2 currency (independent of JP) and links to the S80 stat-curves. Read it before
the XP work.

### Carried from earlier (still open, still by-design/low-priority)
- **Multi-battle-node persistence ("v3" of that lineage)** — only needed when a
  node authors consecutive battle beats; none authored yet. (Note: campaign save
  schema is now literally v3 for an unrelated reason — the JP fields.)
- **Portrait override seam (ADR-0136)** — M5 completion to-do, untouched.
- **Border-shorthand console warnings** (M1 Formation/Deployment) — cosmetic,
  dev-only, uncleaned.
- **"99 cap" is a guide fiction** (S80 finding) — no global 99 clamp in code;
  worth a guide-doc correction someday.
