## ADR-0140: M2 Formation UI (roster + dossier) & JP-gating live

**Status:** Accepted
**Date:** 2026-07-04
**Milestone:** TABA M2 (progression) — the between-battles UI + the gating flip
**Brief:** `docs/TABADesign/m2-formation-ui-brief.md` (+ the S81 handoff notes)
**Builds on:** ADR-0138 (JP economy substrate), ADR-0139 (XP/level)

## Context

M2's progression *engine* shipped and was tested (ADR-0138/0139): per-class JP
pools, derived spend, tier gating, reclass access, the ~114-component catalog,
XP/leveling. No UI consumed the reclass/spend selectors, and the campaign fold
did **not** stamp the `usable*` allowlists — so gating was dormant (campaign
units played with everything usable). This ADR records the UI that turns
progression into something the player drives, and the flip that makes JP-gating
bite in battle.

The visual source of truth was two standalone HTML mockups
(`formation-roster.html`, `formation-celestial-2.html`) — a celestial star-chart
aesthetic. The build ports them faithfully into React over the settled selectors.

## What shipped (5 commits, all over `src/app/formation/`)

1. **Roster view** — a portrait-first cadet gallery: domain-framed cards, an
   investment aura (veterancy), a twinkling JP-glint iff idle purse anywhere, a
   per-class constellation trace, plot-unique crest; All/Has-JP/domain filters +
   four sorts + summary. Pure `roster-view-model` off the ledger selectors.
2. **Dossier + Constellation** — the three-JP-quantities header (purse =
   `availableInClass`, spent = `spentInClass` (derived), earned = `earnedInClass`;
   XP-to-next as a single per-unit value) and the reclass star-chart, laid out
   from `CLASS_TIER_MAP` (not the mockup's coords — so no phantom Onion Knight;
   hybrid-T3 is a labeled empty capstone). Star states read straight off
   `reclassableClasses` (the single openness source — never re-derived) +
   `spentInClass`; locked slots show a `lockReason` once, centred (openness is
   per tier-slot). Aggregate cards read `spentByTierSlot`.
3. **Training** — the current class's components as typed, grouped, priced rows
   (Items · Math Skill · Command Set · Passives). Buying spends via a new
   `purchaseComponent` op (unlock + per-newly-opened-class `grantOnClassUnlock`),
   with an ignite animation + toast on a threshold cross.
4. **Loadout (Customize)** — curate the equipped kit: a secondary command from
   classes the unit has unlocked ≥1 active in, and R/S/M passives.
5. **Gating live** — seed authored kits + stamp the fold (below).

## Decisions

- **`reclassUnit` is a real op, not `{...unit, classId}`.** A class's command
  set lives in the loadout's `first_action` bucket, and the fold passes loadout +
  classId verbatim. Reclass rebinds `first_action` to the new class's command set
  so the fold can't field a unit wielding the wrong commands. Secondary/passive
  curation is the Loadout tab's job. (`src/campaign/reclass.ts`.)

- **Threshold-cross grants land per newly-reclassable class.** The brief's
  "whole tier opens at threshold" + "a freshly-unlocked class can afford its
  onboarding" reads as: a purchase that opens new slots grants EACH newly-opened
  class its tier-scaled head-start. (`purchaseComponent`, pure + deterministic.)

- **Secondary-command availability = classes with ≥1 unlocked active** (Chris).
  Access to wield another class's command as secondary is earned through JP
  investment, not merely reclass-openness.

- **Loadout capacity is the engine's COST budget, not a count** — a passive
  costs its `baseCost`, or 0 if the class grants it free (`freeAbilities`), so a
  class stacks its own passives cheaply (this is how an Assassin fits 4 passives
  in a cap-3 reaction bucket). Bucket capacity is equipment-aware, computed
  purely (baseline + item `bucketCapacityMods`; equipment is v1's only
  `modifyBucketCapacity` contributor, and status doesn't apply between battles),
  so no battle `GameState` probe is needed. Currently-equipped passives always
  surface (even un-unlocked ones carried from an authored loadout) so none is a
  stuck invisible slot.

- **Gating-live migration = seed unlocks from loadout** (Chris's call over the
  alternatives). Stamping the fold's `usable*` masks from unlocks would strand
  authored units (empty unlocks ⇒ empty allowlist ⇒ can't act). So at campaign
  start (`seedRosterStartingKits`, catalog in hand) each fresh authored unit is
  pre-unlocked from its loadout: the active/item/math components of its wielded
  command sets + its equipped non-native passives; `earned` is set == seeded
  spend per class so `available` is 0. Plot-uniques with authored progression are
  left untouched. **Consequence (flagged):** seeded spend counts toward tier
  thresholds, so a veteran may start with an adjacent reclass tier open —
  intended for L25 authored units; the seed scope is easy to dial back.

- **The fold stamps `usable*` on every player placement** (`snapshot-fold.ts`
  `campaignPlacement`, now catalog-threaded), projecting `usableActiveIds` /
  `usableItemIds` / `usableMathParameterIds` / `usableMathValueIds`. Mage War
  never folds through here, so it stays ungated (rule: emit superset, consume
  subset).

## Consequences / still open

- **Tier-opening from seeded kits** (above) — watch in playtest; dial seed scope
  if too generous.
- **Multi-secondary command** (Magus Crown lifts secondary capacity >1) — the
  Loadout tab keeps secondary single-select for now; a later refinement.
- Deferred M2 tails unchanged: **JP spillover** on over-threshold spend,
  **enemy-progression authoring**, the **"Level Up!" banner** (animator polish).
- A **dev harness** (`FormationDevHarness`, `?formation` in `main.tsx`) seeds a
  rich roster for building/verifying the celestial UI — fresh campaign units are
  empty. Dev-only, gated behind a URL flag; kept for future formation work.
