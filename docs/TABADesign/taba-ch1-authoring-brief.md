# Brief — Author Chapter 1 (replace the M1 test campaign)

*Status: plaintext review by Chris before it ships to CC. **Substrate SHIPPED (ADR-0149) — gate cleared,
this is unblocked.** All four substrate pieces (outcome conditions, campaign flags, phantom edge, guest
allies) plus the runtime `joinPlotUnit` mechanism are live. This is the content-authoring package that
turns the design into the real Chapter 1, replacing the M1 sandbox graph.*

## Bring these documents

1. **This brief** — the authoritative node spec + topology.
2. **`taba-ch1-gear-bundles.md`** — the availability-and-cost plan (`firstAvailableAt` + stub prices).
3. **The whiteboard map image** (`IMG_8992.jpeg`) — the spatial layout source for node placement.
4. **`taba-ch1-substrate-brief.md`** — reference for the features this consumes (shipped, ADR-0149).
5. Context refs already in-repo: `atlas-guide.md` (node/beat model + authoring), `taba-campaign-overview.md`.

---

## Goal

Build Chapter 1 as the real campaign graph + content stubs + gear availability, replacing the M1 test
campaign. Walkable end-to-end on **placeholder battles + marker scenes** (no real dialogue/maps/enemy
lineups yet) so the chapter's structure, pacing, joins, economy, and special-battle logic can be played and
felt before detailed authoring. Real scenes, enemy lineups, and maps are **later** work (M4/M5).

## Division of labor (recommended)

- **Structure** (nodes, edges, capabilities, offsets, chapter tags, layout, placeholder battles/scenes):
  authorable in **Atlas** from the spec + map image — Chris may lay this out himself (it's what Atlas is
  for) and export `node.ts`, or the implementer builds it. Either way the codegen round-trip pin protects
  it.
- **Content wiring** (implementer): `node-content.ts` — the outcome conditions, guest allies, `onOutcome`
  scene branches (tag → **inline** `StoryScene`, per the S92 write-back — scenes are inline beats, not
  refs), the `joinPlotUnit` join hooks; the gear `firstAvailableAt` assignments; the M1→Ch1 swap and its
  tests.

---

## The graph — nodes

Linear spine. IDs proposed (audit/Chris may rename). **Offsets are starting proposals** (enemy level =
party-avg + offset) — tune from playtest; the party trends ~2 below the enemy curve so the finale sits a
few above, per the intended grind-or-git-gud pressure.

| # | id | Name | Type | Offset | After the battle → |
|---|---|---|---|---|---|
| 0 | `zarghidas` | Zarghidas Trade City | hub, **no battle** (opening scene + commerce) | — | (start; stays hub) |
| 1 | `oskun` | Oskun Fields | battle (+ **guest ally**) | +1 | **farmable** |
| 2 | `alvera` | Alvera Village | battle → **hub** | +1 | **hub** (commerce) |
| — | `zelmonia-castle` | Zelmonia Castle | scene + **hub**, no battle | — | (stays hub) |
| 3 | `zelmonia-hills` | Zelmonia Hills | battle (**antagonist, retreat**) | +2 | **farmable** |
| 4 | `grek-forest` | Grek Forest | battle | +2 | **farmable** |
| 5 | `fort-cator` | Fort Cator | battle → **hub** | +2 | **hub** (commerce) |
| 6 | `ordal-canyon` | Ordal Canyon | battle (**Sera guest**) | +2 | **farmable** |
| 7 | `old-ordal` | Old Ordal | battle | +2 | **dead** (no hub, no farmable) |
| 8 | `mount-eska` | Mount Eska | battle (**antagonist returns, retreat**) | +3 | **farmable** |
| 9 | `ester-road` | Ester Road | battle (**subdue-secret**) | −2 (dip) | **farmable** |
| 10 | `ruk-village` | Ruk Village | battle (**subdue-secret**) | +3 | **dead in Ch1** (hub in Ch2) |

**Edges (win, linear):** 0→1→2→zelmonia-castle→3→4→5→6→7→8→9→10.
**Phantom edge:** `old-ordal` → `viura` (a **phantom node**, shown-never-reachable; substrate WI3). Viura
sits deep in Ordallia; the path shows but never lights.
**Chapter tag:** all nodes `chapter 1`. **Start:** `zarghidas`. **Terminal:** `ruk-village`.

## Spatial layout (from the whiteboard — image is authoritative)

The red line is the Ivalice/Ordallia border; the arc goes **out** (Ivalice→Ordallia for 1–8) and **back**
(Ivalice for 9–10). Approximate placement: Zarghidas upper-left (Ivalice side of border); Oskun→Alvera
right along the top; Zelmonia Castle→Hills center; Grek upper-right; Fort Cator right edge; Ordal
Canyon→Old Ordal lower-right (Viura dashed further lower-right); Mount Eska center-bottom; Ester Road lower-
left (back across border); Ruk upper-left (Ivalice). Blue dots = hub-destiny, red = field.

---

## Per-node authoring notes

- **0 Zarghidas** — opening scene. **Only Lumen + Chris are seeded into the initial roster** (S92 write-back:
  plot units were previously all seeded; the staggered Ch1 joins use the new runtime `joinPlotUnit`, so
  Clio/Thessaly/Sera are *not* present at start). Initial party = Lumen L1 Pyromancer + Chris L1 Knight (w/
  Alchemist reclass dispensation) + 4 rolled generics (names/genders/Brave/Faith rolled at start, classes
  fixed; mage-side generics **start with matching wands**, Lumen with Wand of Lumen — starting loadout, not
  shop). Starter shop = Zarghidas gear bundle. Pendant of Lumara pickup on an early Lumen beat (here or Node 1).
- **1 Oskun** — story battle with a **guest ally** (WI4) to keep it very safe; then farmable "when all else
  fails, grind here." Guest is AI-driven, uncommandable. **⚠ First live guest battle** — the guest
  turn-flow UI has never run in a browser (hook/orchestrator-tested only, S92). **Build and eyeball Oskun
  first:** menu stays closed on the guest's turn, guest acts sanely, banner/log read right.
- **2 Alvera** — story battle; post-battle **`joinPlotUnit(Clio)`** (Hydrologist, ~L1–2, below party avg —
  the XP rubber-band closes it). Becomes the caster hub (gear wave 1).
- **Zelmonia Castle** — scene only, becomes the armory hub (Heavy gear bundle; Chris the customer).
- **3 Zelmonia Hills** — story battle vs the **recurring antagonist**: victory = `unitBelowHp(boss, ~0.15)
  OR allDefeated`, boss **death-protected** → retreats, survives (WI1). Pre/post dialogue. **Flametongue**
  reward → Chris. Then farmable.
- **4 Grek Forest** — story battle; post-battle **`joinPlotUnit(Thessaly)`** (~L3, below avg). Then farmable.
- **5 Fort Cator** — story battle → the "Sword Town" hub (Cutlass bundle). Then hub.
- **6 Ordal Canyon** — story battle with **Sera as guest** (WI4); post-battle **`joinPlotUnit(Sera)`**
  (~L5–6) — the guest→roster transition. Then farmable. *(Map may recycle Mountain Pass.)*
- **7 Old Ordal** — story battle (standard defeat-all); then **dead node**. The **phantom edge → Viura**
  shows the road to the capital that the party won't take (narrative: they're recalled home). **Must retain
  its real win-edge → Mount Eska:** phantom edges are excluded from `isTerminal` (S92), so if the real →8
  edge were dropped, Old Ordal would (correctly) become terminal and break the spine.
  **Triggers Alvera refresh wave** (Staff of Abundance, Tome of Power).
- **8 Mount Eska** — story battle, **antagonist returns** (retreat-at-threshold again, WI1); defensive
  parallel to Node 3. Then farmable. **Triggers Alvera refresh** (Arcane Robe) + **Freelancer's Charm**
  drops (found).
- **9 Ester Road** — back in Ivalice; rebels/deserters (the difficulty **dip**, −2). **Subdue-secret**
  (WI1+WI2): `noDeaths AND all-enemies < 25%` → good outcome + flag; else standard. Different post-battle
  scene per outcome (`onOutcome`).
- **10 Ruk Village** — finale. **Subdue-secret** on the **leader**: `noDeaths AND leader < 25%` → good +
  flag; else standard defeat-all. Two downstream outcomes (dialogue + a flag paying off in a later chapter).

## Gear availability (per `taba-ch1-gear-bundles.md`)

Assign `firstAvailableAt` per that doc's summary: Zarghidas starter (start); Alvera wave 1 (Node 2); Zelmonia
Heavy (castle); Fort Cator (Node 5); Alvera refresh (Node 7: Staff+Tome; Node 8: Arcane Robe). Uniques via
`grantItems`/receipt at their beats (Pendant early; Flametongue Node 3; Freelancer's Charm after Node 8).
Gauntlet of Might + Mantle of Protection are **Ch2**, not stocked here. Stub prices from the doc into
`ITEM_PRICE_OVERRIDES` (placeholder; tuning pass later).

## Content-stub approach

- **Battles:** placeholder templates (River Ridge default; **Ordal Canyon may point at Mountain Pass**).
  Real maps + enemy lineups are later. The special-battle logic (outcome conditions, guests) IS authored now
  — it's structural to how those fights resolve.
- **Scenes:** inline placeholder-scene beats with one marker line each ("Clio joins after the battle here",
  "Antagonist retreats", "Good/standard outcome branch"), so the chapter walks with its narrative rhythm
  before real dialogue exists. `onOutcome` maps an outcome tag → an inline `StoryScene` (S92: scenes are
  inline, not refs). Threshold/death semantics are pinned (S92): strict `<` for below-fraction; "died" =
  ever hit 0 HP this battle (revival doesn't clear it); a downed unit counts as below any threshold.

---

## Acceptance criteria

- Chapter 1 is the live campaign (M1 test graph replaced); walkable start→finale on placeholders.
- Topology matches the spine + phantom edge; Viura shows, never reachable; chapter tags all 1; round-trip
  byte-identical.
- Joins fire via `joinPlotUnit` (Clio@2, Thessaly@4, Sera@6 — Sera guest→roster); guests act AI-driven at
  1/6. **Oskun's guest fight eyeballed live in-browser** (first-ever live guest battle): menu closed on the
  guest's turn, guest acts sanely, banner/log correct.
- Special battles resolve correctly (3/8 antagonist retreats & survives; 9/10 subdue-secret branches on
  outcome + sets flags; different post-battle scene per outcome).
- Gear `firstAvailableAt` + refresh waves + unique drops match the gear doc; stub prices in place.
- Hubs sell (Zarghidas/Alvera/Zelmonia/Fort Cator); farmable nodes skirmish; dead nodes (Old Ordal, Ruk-in-
  Ch1) offer neither; return-travel works across the arc.
- Suite green, `tsc -b` clean, saves back-compatible.

## Out of scope

- Real scene dialogue, real battle maps, real enemy lineups/procedural generation (M4/M5).
- Ch2+ content (Ruk's Ch2 hub conversion; Gauntlet/Mantle placement; cross-chapter flag *reads*).
- Cost tuning (stubs now).
- Any substrate itself (must already be shipped — this brief consumes it).

## Workflow notes

- **Substrate shipped (ADR-0149) — gate cleared.** This authors *against* live features.
- Structure can be Atlas-authored (Chris or implementer) or codegen; content wiring is implementer.
- `evaluateBattleOutcome` now takes the catalog (S92) — any new caller outside `commit.ts` must thread it.
- File paths in the substrate brief were flagged as inferences — same caution here for any code touchpoints.
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **The M1→Ch1 swap** — the existing test campaign's importers (`M1_NODES`/`M1_CAMPAIGN_GRAPH`, ~16 of them)
  and the shipped-content pins; swapping the graph must keep them (or rename deliberately per the S90 note).
- **Join levels vs recruitment cap** — plot units join *below* party average by design (rubber-band closes
  it); confirm the join path isn't accidentally subject to the hire-at-average cap (different mechanism).
- **Offsets are guesses** — the whole curve is a starting hypothesis; the one series to measure in playtest
  is party-average-level entering each node, which pins everything.
- **Placeholder scenes vs outcome branches** — Nodes 9/10 need *two* inline placeholder post-battle scenes
  each (good/standard) so the branch is walkable.
- **Same-boundary outcome (9/10, minor)** — S92 pinned that an action draining on the *same* checkpoint that
  enqueued the good-outcome battle_end (e.g. a poison tick killing an enemy right as the subdue-win fires)
  does *not* retro-downgrade the recorded outcome. Fine by design; flag only if a playtest of 9/10 ever
  reads wrong.

## Estimated size

A meaty content session — 11 story nodes + 2 pure hubs + phantom, all four substrate features exercised,
gear availability, and the M1 swap. The structure is fast (Atlas/codegen); the weight is the content wiring
(outcome conditions ×4, guests ×2, joins ×3, gear assignments, the swap + tests). Could split
structure-first / content-follow if large, but it's mostly assembly on shipped substrate.
