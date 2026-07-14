# ADR-0151: Chapter 1 feedback round one — kits, shops, entry flow, map reveal

**Status:** Accepted (2026-07-13, Session 94)

**Context:** Chris played the freshly-live Chapter 1 (ADR-0150) and returned
seven pieces of feedback the same day. Three of them deliberately revise
earlier design decisions; this ADR records the revisions and the new
conventions.

## Class-innate passives arrive EQUIPPED

**Decision: every campaign-created unit auto-equips its class's free
passives** (`withInnatePassives`, campaign layer): the `freeAbilities` set
minus actives, each in its definition's own bucket, deduplicated against
authored passives (plot signatures). Applies to the Ch1 leads, rolled
generics, hires, skirmish lineups, and the named enemies/guests. Free
in-class passives cost 0 against bucket capacity, so this can never break
draft legality. A fresh Knight counters; a fresh Pyromancer smolders.
Player unequips afterwards are ordinary loadout edits.

## The named cast starts with authored, LIMITED kits

**Decision: Lumen starts knowing only Scorch; Chris only Power Attack (plus
the 100-JP Alchemist trickle); Clio only Water Lash; Sera only Hamstring;
Thessaly one castable Math line (Exact Rhythm + Height + Prime).** The
`Ch1UnitSpec.kit` field authors exact unlock tokens with earned JP = their
summed cost (the seedStartingKit invariant — available lands at 0 — kept,
with identical native-class attribution so derived spend zeroes out).

Two deliberate revisions inside this:
- **Sera's Hamstring is now SEEDED, not earned** — S84 authored it as a
  restricted buyable ("earned not seeded"); Chris's call: she joins at L5
  mid-story already knowing her signature. It stays unit-restricted (no
  leak to other assassins).
- **The rolled generics and hires KEEP the full-Tier-1-kit convention**
  (Chris named only the five plot units). Open question flagged in the
  handoff: a full-kit generic out-toolkits single-ability Lumen on day
  one — if that reads wrong in play, limit the generics next.

**Amendment (same day, round two):** Chris took the flagged option — each
rolled generic now starts with exactly its class's single CHEAPEST
active-side component (`cheapestClassActive`: active abilities + item
components, restricted excluded, ties by catalog authoring order): Potion
(Alchemist), Charged Attack (Hunter — ties Scramble at 100, authoring
order wins), Bear's Heave (Monk), Rock Toss (Geosage). With that, EVERY
Ch1-authored unit has an explicit authored kit (`Ch1UnitSpec.kit` is now
required); only hires keep the full-kit convention (recruit.ts,
"functional on arrival" — deliberately, they're a paid convenience).

## Shop stock is PER HUB (revises D2's global pool)

**Decision: an item is buyable only at the hub that sells it.**
`TabaGearEntry` gains `soldAt` (where) alongside `firstAvailableAt` (when);
the Ch1 table became explicit waves `{soldAt, unlocksOn, items}` so the two
Alvera refreshes keep unlocking on Old Ordal / Mount Eska clears while
selling AT Alvera. `shopStock`/`buyItem` take the current node id; selling
stays location-free. S88's D2 ("the pool is global, the access is a place")
is revised: the pool is now per-place too — Alvera sells Alvera's gear, not
Zarghidas's. Per-hub stock stays monotonic.

## Entry resolution is STORY-FIRST (revises the S88 Dorter menu)

**Decision: an armed story engagement always plays directly on node entry;
the location menu (shop/recruit/skirmish) appears only once nothing story
is armed.** At a commercial hub the story battle comes first and commerce
opens after the win — no menu offering both (Chris: "just the story battle
… with the commercial hub replacing it after winning"). One condition
change in the driver (`planEntry` keys on `isStoryCleared` alone — no new
substrate). Side effect Chris wanted anyway: campaign start now opens
straight into the Zarghidas scene. `buildLocationMenuBeat` keeps its
'story' option as a pure function (future re-armed camps may want the
choice back); the driver simply never routes an armed node to the menu.

## Progressive map reveal, with authored always-visible teases

**Decision: the world map hides nodes until visited or on the travel
frontier — except nodes flagged `alwaysVisible`, which show from campaign
start.** Old Ordal + Viura carry the flag: the destination on the horizon
the whole chapter marches toward, before the Mount Eska rug-pull.
`CampaignNode.alwaysVisible` is presentation-only (never affects travel or
reachability); it flows through the Atlas model/import/codegen (round-trip
pin regenerated) with an inspector checkbox. The world-map beat snapshots
`state.visited` (optional field — a beat without it, like the Atlas
authoring preview, shows everything); the view renders visited + choices +
always-visible nodes and only the edges between two visible endpoints.
The viewBox still derives from the FULL layout so the frame doesn't jump
as places appear.

## Dev level-up chip

**Decision: `debugGrantLevel` — +1 level to every active roster member, XP
reset, healed to the new effective full (per-unit probe; an invalid-loadout
unit levels but keeps old vitals).** Repeatable by design, the JP chip's
sibling, DEV-gated on the manage screen. Alternatives considered and
parked: per-unit grants (more control, more UI — the party-wide press
serves the curve-staging use case), and XP-injection through the real
`system_xp_award` path (more faithful, but level-up mid-battle mechanics
are already engine-tested; the debug tool wants directness).

## Also in this round

Lumen and Chris swapped body armor (Jacket to Lumen, Vest to Chris).

## Consequences

- Suite 2869 → 2878; `tsc -b` clean; Atlas round-trip pin green with the
  new node field. Saves untouched (roster shapes are data; `visited`
  already persisted).
- The S93 handoff nits about menu-before-scene and the battle-flavored
  story label at Zarghidas are both mooted by story-first entry.
- ShopScreen's subtitle ("stock grows as the campaign advances") remains
  true per-hub (Alvera's refreshes) but could name the hub — cosmetic.
