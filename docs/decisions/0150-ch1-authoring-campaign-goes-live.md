# ADR-0150: Chapter 1 authoring — the real campaign replaces the M1 test graph

**Status:** Accepted (2026-07-13, Session 93)

**Context:** With the Ch1 substrate shipped whole (ADR-0149), the content
package in `docs/TABADesign/taba-ch1-authoring-brief.md` became unblocked:
author Chapter 1 as the live campaign — the 13-node linear spine out of
Ivalice and back, walkable end-to-end on placeholder battles and marker
scenes, with the structure, pacing, joins, economy, and special-battle logic
real. Chris settled the open design points at session start: the graph laid
out by the implementer from the whiteboard map; the party reset to its true
L1 campaign shape; four rolled generics (Alchemist/Hunter/Monk/Geosage);
fixed join levels (Clio 2, Thessaly 3, Sera 5); Theo Renault (Hunter L4→L10)
as the recurring antagonist; Wiegraf Folles (L2 Alchemist, Potion + Phoenix
Down) as the Oskun guest; maps recycled until the M4/M5 map-authoring pass.

## The graph identifiers are chapter-neutral

**Decision: rename `M1_NODES`/`M1_CAMPAIGN_GRAPH` → `CAMPAIGN_NODES`/
`CAMPAIGN_GRAPH`, in the Atlas codegen emitter and everywhere downstream.**
The S90 handoff carried "M1_NODES cosmetic rename" as deferred; the swap was
the natural moment. A chapter-specific name (CH1_) would be wrong the moment
Ch2 nodes join the file: the campaign graph is chapter-spanning by design
(`chapter` is a per-node field; the map is monotonic). The codegen emitter
changed in the same commit as the regenerated shipped modules, per the
fidelity contract — the byte-identical round-trip pin passes on the new
names and the hand-authored Ch1 `node.ts`.

## NodeBattle gains `joins` and `grants`; the fold carries `deathProtected`

**Decision: post-battle roster joins and unique item drops are authored on
the battle beat, applied by the driver on a story-battle win.** Three small
riders on shipped seams rather than new machinery:

- `NodeBattle.joins?: CampaignUnit[]` — the driver calls `joinPlotUnit` for
  each after apply-back and outcome flags. A story battle never replays
  (per-beat cleared guard), so a join fires exactly once. Skirmishes never
  author joins. Sera's guest→roster transition is the same unit definition
  on both sides of the same beat (`guests: [sera], joins: [sera]`).
- `NodeBattle.grants?: ItemId[]` — unique drops (Pendant of Lumara at Oskun,
  Flametongue at Zelmonia Hills, Freelancer's Charm at Mount Eska) enter the
  party inventory through `grantItems`, keeping receipt the one door. No
  beat-reward machinery existed before this; the Pendant sits on the Oskun
  battle (the brief allowed node 0 or 1; node 0 has no battle beat).
- `campaignPlacement` carries a slot's `deathProtected` flag through the
  enemy fold, exactly like `guest` — an authored boss spec re-skinning a
  protected placement stays protected. Without this the fold silently
  stripped the WI1 flag.

## Campaign start rolls the generics; kits are seeded at build

**Decision: the four starting generics are rolled at the New Campaign click
— app-layer `Math.random`, results persisted in the save; the engine's
per-action seed discipline is untouched.** `ch1StartingRoster(rng, catalog)`
takes the rng as a parameter, so tests stub it deterministically. Names
sample without replacement from the hire pool (`HIRE_NAMES`, now exported);
genders roll 50/50 (both genders have class art); Brave/Faith roll 50–70;
classes are fixed (Alchemist/Hunter/Monk/Geosage — with Lumen and the
joining Clio covering Pyromancer and Hydrologist, the whole Tier-1 line is
represented). Gear is the hire tool's legality-driven starter picker, with
one authored override: the Geosage gets the Wand of the Deepwood (the picker
would hand it the first legal wand, which is the water one).

**Every Ch1 authored unit is kit-seeded at build time (`seedStartingKit`),
not left to `startCampaign`'s auto-seed.** Two forcing reasons: join units
never pass through campaign-start seeding (`joinPlotUnit` does not seed),
and Chris's authored Alchemist JP trickle (`CH1_CHRIS_ALCHEMIST_JP`, 100 —
his reclass dispensation alongside the `[knight, alchemist]` access
override) would make the auto-seed skip him (it treats any earned JP as
"already authored"). One door for the whole cast beats two doors with a
skip heuristic. Consequence to watch: seeded Tier-1 spend counts toward
reclass-tier thresholds — priced for L25 veterans, now applied at L1
(handoff watch-for).

## Placeholder story lineups come from the skirmish stub at fixed levels

**Decision: every Ch1 story battle authors `enemies` — a
`generateSkirmishParty` lineup at an authored fixed level — because the
recycled templates' default enemies are the L25-era fixtures, unplayable
against an L1 party.** The stub is deterministic, Tier-1, kit-seeded, and
gearless: exactly placeholder quality, replaced wholesale by the M4/M5
lineup pass. Authored levels approximate the brief's offset curve against
the expected party average entering each node (2/3/4/6/7/8/9/10/7/13 for
nodes 1–10); the offset field itself keeps driving skirmish scaling. Named
enemies (Theo at 3/8, the Rebel Captain at 10) are authored as `enemies[0]`
folding onto a deterministic lead slot (`withLeadEnemySlot` reorders the
template's enemy team and optionally death-protects the lead).

## Fixed join levels; guest slots outside deploy zones

Clio joins at 2, Thessaly at 3, Sera at 5 (Chris: fixed for now, maybe
computed later — the XP rubber-band closes the gap either way). Join gear is
Ch1-band authored kit (Alvera-wave caster gear for Clio/Thessaly, starter
kit for Sera) — NOT the L25 endgame kits their plot-unit versions carry;
notably the old Chris carried Flametongue (the node-3 reward) and Gauntlet
of Might (a Ch2 item). Guest slots are authored template placements on land
tiles outside the deploy zone — River Ridge (3,1) for Wiegraf, Mountain
Pass (1,3) for Sera — so a deploy can never collide with a guest.

## A stale test-campaign save is discarded, not migrated

**Decision: `resumeCampaign` checks the save's `currentNodeId` against the
live graph; a miss clears the save and stays at title.** The only saves this
affects are M1 sandbox saves pointing at removed nodes (`node-river-ridge`
…). The M1 campaign was explicitly test content; migrating its position onto
the Ch1 spine would be fiction. Schema untouched (still v2) — saves made on
Ch1 nodes load normally.

## Gear waves and stub prices are live content, not placeholders-of-placeholders

The `firstAvailableAt` bundle table in `equipment-pool.ts` is now the REAL
Ch1 assignment from `taba-ch1-gear-bundles.md` (Zarghidas starter 12 /
Alvera wave-1 12 / Zelmonia Heavy 3 / Fort Cator 3 / Alvera refreshes at Old
Ordal + Mount Eska). The shop pool stays global (D2) — the doc's per-hub
tables are unlock *triggers*, not per-hub inventories. `ITEM_PRICE_OVERRIDES`
carries the doc's stub prices; relative ordering is the signal, absolute
values await the tuning pass (D-econ-6). Gauntlet of Might + Mantle of
Protection stay unstamped (held for Ch2). Uniques are `unique`-acquisition
and enter only via `grants`.

## Consequences

- Chapter 1 is the live campaign: 13 nodes, all four substrate features
  exercised, walkable start→finale. Verified live in-browser through the
  Oskun guest battle (menu closed on Wiegraf's turn, guest acts sanely,
  log/banner correct — the S92 first-live-guest-battle eyeball).
- Zarghidas is a scene+hub START with no battle — the Atlas validator's
  `start-no-battle` warning is expected and pinned as such.
- `node-content.ts` instantiates its own `loadDefaultCatalog()` for
  authoring-time derivation (kit seeding for lineups and named units). The
  engine still reads the app-threaded catalog (ADR-0004 unchanged) — the
  content instance is the same static data.
- The M1 test content (nodes, scenes, opener tuning) is deleted; the M1
  battle *templates* stay (recycled as Ch1 battlefields), and `m1Roster` /
  Alice / Miluda / Can'tano stay authored for debug harnesses (Miluda joins
  in Ch2).
- Theo/Wiegraf/Miluda portraits are registered (`plot-theo`, `plot-wiegraf`,
  `plot-miluda`), bust-cropped to the 512×512 plot framing.
