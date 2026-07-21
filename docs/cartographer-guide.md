# Cartographer — the battle-map authoring guide

The Cartographer (`?cartographer`) is the Atlas companion for **battle maps**: where Atlas authors
the campaign graph the nodes hang on, the Cartographer authors the tile grids the battles are
fought on. It is DEV-gated (the route does not exist in production builds) and follows the same
contract Atlas proved: the shipped map modules are its codegen output, exports are byte-identical
round-trips of what it imports, and the preview is the **real battle renderer** — what you author
is what ships.

Shipped in S98: Tier 1 (terrain + deployment, ADR-0157) and Tier 2 (the **unit mode** — battle
lineups: player staging, guest markers, and enemy slots with class + level, ADR-0158).

---

## 1. Loading the Cartographer

Run the dev server (`npm run dev`) and open the app with `?cartographer` in the query string,
e.g. `http://localhost:5173/?cartographer`.

- The map picker in the toolbar loads any of the six shipped maps, or **+ New map…** starts a
  blank 16×16.
- Your work autosaves to a browser **draft** (localStorage) on every edit — closing the tab loses
  nothing. The draft is a scratchpad, not authored truth: nothing reaches the game until you
  **Export** and paste the generated files into the repo.
- **Reset to shipped** discards the draft and re-imports the committed modules.

## 2. The mental model

A map is authored as a `MapSpec` (see `src/content/maps/map-format.ts`), and understanding its
five parts explains every brush in the tool:

1. **The elevation grid** — one integer per tile. This is the primary authoring act; everything
   else derives from or decorates it.
2. **Terrain bands** — ordered elevation→terrain rules ("elevation 0 → deep water", "≥ 7 →
   rock"). First matching band wins; no match falls back to `ground`. Painting elevation
   *automatically* repaints terrain through these rules, so a valley you carve becomes a river
   the moment it hits the water table.
3. **Terrain overrides** — position-keyed exceptions that beat the bands (Stonebridge's nine
   rampart tiles are these). An override is marked with a gold corner triangle ◤ on the canvas.
4. **Property tags** — per-tile `TileProperty` flags. Exactly two exist in the game today:
   `bridge_ramp` (renderer-only: the bridge kit's rise piece on a bank tile) and `blocks_los`
   (engine: blocks line of sight).
5. **Decks** — layer-1 stacked cells (bridge spans). Sparse; drawn as inset chips with their own
   elevation digit.

Deployment zones are the sixth thing the tool authors, but they live in a **separate file**
(`src/content/deployment/registry.ts`, keyed by map key) because a map is a reusable template
while zones are a layout on it. The tool edits the current map's `default` zone config and
carries every other map's configs through untouched — its registry export re-emits the whole
file.

## 3. The editor

### Canvas

- **Wheel** zooms about the cursor; **middle-drag** pans anywhere.
- With the **Inspect / pan** brush: left-drag pans, and a plain click selects a tile — the
  inspector's bottom section shows its elevation, terrain (and whether it came from bands or an
  override), properties, zone membership, and deck data.
- With any other brush: click or **drag to paint**. Toggle-style brushes (property, deck, ±1
  elevation) apply once per tile per stroke.
- Tile chrome: elevation digit center; zone tiles tinted blue (player) / red (enemy); ◤ = terrain
  override; letters bottom-right = properties (R = bridge_ramp, L = blocks_los); inset chip =
  layer-1 deck. Tiles lighten slightly with elevation so relief reads at a glance.
- **Esc** returns to Inspect.

### Inspector sections

- **Map** — label, key, dimensions, and **deploys/side** (the unit count the zone validation
  checks against; default 5, the current roster max). The key must be `snake_case` — it derives
  the file name, export identifiers, and both registry keys. Resizing preserves the overlapping
  region; new tiles arrive at elevation 2, and anything out of bounds (overrides, tags, decks,
  zone tiles) is dropped.
- **Brush** — the elevation brushes: set-to-value, +1, −1.
- **Terrain override** — the seven authored terrains (`ground`, `water_shallow`, `water_deep`,
  `rampart`, `rock`, `grass_rock`, `bridge`). Painting the terrain the bands already derive
  *removes* the override instead of storing a redundant one, so band-following tiles stay
  band-following. `clear override` erases explicitly. **New terrain *types* are engine work**
  (every class's `canEnter` + the ruleset tags + `AUTHORED_TERRAINS`), not a tool affordance.
- **Properties** — toggles for `bridge_ramp` and `blocks_los`.
- **Deployment zones** — per team: paint brushes per sub-zone, per-sub-zone caps, add/remove
  sub-zones, and an erase brush. Painting a tile into a zone removes it from any other zone
  (overlap is an engine validation error). Most maps want one uncapped sub-zone per side;
  Mountain Pass's split ambush (two capped enemy sub-zones) is the precedent for more.
- **Units — battle lineup** — the Tier 2 mode. Three placement brushes plus erase:
  - **Place player** — the five staging slots every battle template needs. Deployment overrides
    these positions in play; they're the authored fallback, so put them in or near the player
    zone.
  - **Place guest** — WI4 guest-ally markers (Wiegraf-style). They export as guest-flagged
    slots the node's `guests:` list re-skins in order — this replaces the hand `withGuestSlot`
    step for tool-authored battles.
  - **Place enemy** — with the class picker + level beside the brush. Each enemy slot carries
    its authored class + level; **kits are NOT authored** — they auto-fill at fold time from the
    enemy-kit framework (level-budgeted curriculum prefix, deterministic Brave/Faith, basic
    gear), exactly like skirmish generics.
  - Chips on the canvas show a facing wedge, the enemy's level, and a **gold ring on the lead
    slot**. **Enemy order is meaningful**: the campaign fold re-skins slots by index (lead =
    slot 0 — where a named unit like Theo lands; death-protection keys off it). Reorder with
    the ↑↓ arrows in the enemy list.
  - Select a unit's tile in Inspect mode to edit facing (N/E/S/W) or remove it. Facing is real
    data — for AI units the authored facing is authoritative in battle, never defaulted.
  - Placing on a deck tile stands the unit ON the deck (bridge defenders).
  - The **battle id** input names the exported `BattleConfig` (snake_case).
  - **✎ opens the per-enemy override editor** (Tier 3; ✱ marks overridden rows). Everything in
    it is optional — an untouched field keeps the framework default, and `reset all` returns
    the enemy to plain class+level:
    - **Name / Brave / Faith / gender** — named-miniboss riders (Brave/Faith placeholders show
      the deterministic band roll they'd otherwise get).
    - **Kit** — three modes. *Auto (level)*: the standard level × dial budget. *JP budget*: the
      same curriculum prefix at a budget you set, decoupled from level. *Explicit picks*:
      per-component checkboxes with JP costs — full control of what's learned. The implied JP
      total is always shown (enemies have no JP wallet; the kit **is** the earned JP). Choosing
      a secondary command set adds that class's components to the picker — unlock its actives
      or the secondary casts nothing.
    - **Loadout** — the secondary command set and R/S/M equipped passives. Class innates
      auto-equip on top, deduplicated, like every campaign unit.
    - **Equipment** — *default (basic gear)* or *custom*: per-slot selects filtered by the real
      class/slot legality rules (a monk's hands offer nothing — that's the class definition,
      not a bug). **†** marks pool-managed gear (TABA uniques/exotics — legal, but generation
      never hands it out and the AI undervalues exotic effects).
    - The **legality echo** at the bottom runs the engine's draft resolver on exactly the
      composition the campaign fold ships — capacity (equipment-aware), two-handed grips,
      dual-wield, item-pair legality. Errors also land in the validation strip and gate Export.
- **Bridge decks** — a toggle brush. Placing a deck defaults it to ground elevation + 2 (the
  validator's minimum clearance) with `bridge` terrain; select the tile in Inspect mode to edit
  deck elevation. This is deliberately minimal — full bridge authoring (span/ramp art guidance)
  is a deferred tier; see `docs/maps/alvera-village.md` + ADR-0155/0156 for the conventions.
- **Terrain bands** — the elevation→terrain rule editor: `=` or `≥` rows, evaluated top-down.
  The water-table convention (`= 0 → water_deep`, `= 1 → water_shallow`) is the standing default
  every shipped map starts from; Alvera adds `= 8 → rampart` (building walls), Mountain Pass
  adds `≥ 7 → rock`, `≥ 5 → grass_rock`. Bands are per-map content — your call per battlefield.

### Validation strip (bottom)

Runs live on every edit, using the **real engine validators**:

- Terrain geometry (`validateMap`): bounds, duplicates, negative elevation, unknown terrain, and
  the multi-layer rules — a deck needs a ground tile beneath it and ≥ 2 clearance above it.
- Zones (`validateDeploymentZones`): tiles in bounds and on the map, no overlap, and **each
  side's zone ≥ deploys/side** — an undersized zone is a battle that can't start.
- **Connectivity (advisory, ⚠ not ✕)**: a breadth-first walk from the player zone assuming ≤ 2
  elevation steps; warns if enemy-zone tiles are unreachable. It warns rather than blocks
  because authored-unreachable terrain is legitimate (Alvera's elevation-8 walls) — treat it as
  a "did you mean to?" prompt.

Errors (✕) disable Preview and Export; warnings don't.

### Preview

Mounts the authored map in the **real `BattleRenderer`** — terrain art, cliff shading, elevation
digits, bridge deck-lift, and deployment-zone tint all come from the same code path the battle
uses. Wheel zooms. If the map looks right here, it looks right in the game; there is no
tool-specific renderer to drift.

### Export

Produces two files, with copy and download buttons:

- `src/content/maps/<key-with-dashes>.ts` — the generated map module.
- `src/content/deployment/registry.ts` — the **whole** zone registry, regenerated.

The browser can't write into the repo: paste each over its target path (or drop the downloads
in). Then `npx tsc -b` and `npx vitest run src/app/cartographer` vouch — the round-trip test
re-imports what you pasted and re-emits it byte-identically.

## 4. Workflow: modifying an existing map

1. Open `?cartographer`, pick the map from the toolbar picker.
2. Edit — elevation, overrides, zones, whatever the change is. Watch the validation strip.
3. Preview until it reads right.
4. Export → paste both files over `src/content/maps/<map>.ts` and
   `src/content/deployment/registry.ts`.
5. `npx tsc -b && npx vitest run` — the map's own test file pins its landmark data (Alvera's
   river channel, Stonebridge's nine ramparts…), so a change that breaks a pinned landmark is
   *supposed* to fail until you update that test deliberately.
6. Commit. Nothing else to wire — the battle templates import the map object by name, and the
   export preserves all export names.

Two cautions:

- **Hand edits to the generated files don't survive.** They're legal TypeScript, but the next
  export of that map overwrites the module wholesale (and any export overwrites the registry).
  Make map changes in the tool; keep prose in `docs/maps/<map>.md`.
- The registry export includes **every** map's zones as imported at tool-load time. If someone
  else changed the registry since you loaded, reload the tool (or Reset) before exporting so you
  don't roll their change back.

## 5. Workflow: authoring a new map and attaching it to a Ch1 story node

Several Ch1 nodes still fight on stand-in maps (e.g. Zelmonia Hills and others borrow River
Ridge). Replacing a stand-in takes the tool export plus three small hand-wirings.

### 5a. Author it

1. **+ New map…** → set the **key** (snake_case — e.g. `zelmonia_hills`) and label first; the
   key names everything downstream.
2. Paint elevation. Sketch big shapes first (the ridge, the river bed, the road), then refine;
   the bands turn the low ground into water as you carve. Add bands if the map wants them
   (rock heights, wall-band ramparts) and overrides for one-off tiles.
3. Tag properties if needed (`blocks_los` for sight-breaking features that aren't elevation;
   `bridge_ramp` only as part of a bridge chain).
4. Paint both deployment zones with at least *deploys/side* tiles each (default 5; use 8–12 for
   placement freedom — the shipped maps use 8–12). Set caps/sub-zones only if the engagement
   wants a split.
5. Get the strip to ✓ (or knowingly-⚠), Preview, Export, paste both files.

### 5b. Author the lineup (the unit mode does the battle template for you)

Still in the tool: place the **five player staging slots**, any **guest markers** the node's
story wants (one per authored guest, in `guests:` order), and the **enemy slots** — class +
level each, ordered so slot 0 (★) is where the node's named lead (Theo, a captain) will land.
Set the battle id. Export now emits a third file, the generated
`src/content/battles/<key>-battle.ts` — the `LINEUP_SPEC` plus the `BattleConfig` restaged
from it (this file replaces the hand `STARTING_POSITIONS` template entirely). Paste it in,
then register the battle in `src/content/battles/registry.ts`:

```ts
zelmonia_hills: { label: 'Zelmonia Hills', template: zelmoniaHillsBattle, zonesKey: 'zelmonia_hills' },
```

The registry key must equal the map/zones key — one name per battlefield across both
registries. This alone also makes the map selectable as an Atlas placeholder battle. Also add
the lineup to `SHIPPED_LINEUPS` in `src/app/cartographer/import.ts` (one import line, like
`SHIPPED_MAP_SPECS` for the map) so the tool can reload it later.

(Optional, for quick iteration: add a `MAP_OPTIONS` entry in `src/app/App.tsx` and the map
becomes a one-click quick battle from the setup screen — note quick battles rebuild both teams
in the team builder, so they exercise the map, not the authored enemy classes.)

### 5c. Point the story node at it

Ch1 battle beats live in `src/campaign/node-content.ts`, built by the `battle(template,
zonesKey, extras)` helper. Find the node's entry, swap in the generated template + zones key,
and feed the authored classes/levels through `enemiesFromLineup`:

```ts
'node-zelmonia-hills': [
  marker(/* … */),
  battle(zelmoniaHillsBattle, 'zelmonia_hills', {     // was river_ridge
    enemies: [theoRenault(4, false), ...enemiesFromLineup(ZELMONIA_HILLS_LINEUP, catalog).slice(1)],
    grants: [itemId('flametongue')],
    /* … */
  }),
],
```

`enemiesFromLineup(spec, catalog)` builds one enemy per slot, index-aligned — the tool's slot
order is exactly where each stands. Named/restricted units stay hand-authored: put Theo first
in the `enemies:` list and he re-skins the ★ lead slot (the `.slice(1)` drops the generic the
tool authored there). A node with no named units just uses the whole
`enemiesFromLineup(...)` list. Keep the node's `joins`/`grants`/outcome riders as they were —
they're map-independent. Guests: the node's `guests: [wiegrafGuest()]` re-skins your guest
markers in placement order, no `withGuestSlot` needed.

### 5d. Verify

`npx tsc -b && npx vitest run`, then play the node: New Campaign (or a save at that node) →
walk to the node → the battle should deploy on your zones and fight on your terrain. The
quick-battle route from 5b is the fast sanity loop before the campaign walk.

## 6. Gotchas and conventions

- **The water table is a convention, not a law** — bands are per-map. But every shipped map
  keeps `0 → deep, 1 → shallow`, and the AI/movement costs assume water is where low ground is;
  diverge deliberately.
- **Rampart walls**: Alvera's pattern for solid architecture is elevation-8 tiles banded to
  `rampart` — enterable in principle, unreachable by jump in practice. Stonebridge's pattern is
  position overrides at mixed elevations. Both are fine; pick per map.
- **Decks validate against clearance**: deck elevation must be ≥ ground + 2. The renderer
  derives all bridge art (span orientation, lift, ramp) purely from the geometry + the
  `bridge_ramp` tag, so a well-formed spec renders correctly with no art config.
- **Deployment zones are layer-0 only** by convention (stacked cells are excluded — ADR-0155).
  The tool only paints layer 0.
- **`deploys/side` is validation-only** — it doesn't change the game; the battle's real
  requirement comes from its roster/deploy cap. Keep it at the largest party the map should
  host.
- The tool's confirm dialogs (`Load`, `Reset`) protect the draft; there is no undo yet beyond
  them — export early, export often (pasting into the repo is your save point, and git is your
  history).

## 7. Lineup fine print

- **The six shipped Mage War battle files stay hand-written** (Chris's call) — the tool
  generates battle files for new maps. `river_ridge` is a hard validation error as a lineup
  key (it's the base config every lineup spreads); to author a story lineup on River Ridge
  itself, save the map under a new key first.
- **Per-enemy overrides (Tier 3, ADR-0159)** cover kit, loadout, gear, and identity riders —
  but **unit-restricted signature components** (Sera's Hamstring) are deliberately excluded
  from the picker and rejected by validation: unit identity stays hand-authored. The
  `AuthoredEnemySpec` path in node-content also remains for what the format doesn't model
  (portraits, death protection — node-content riders).
- The `LineupSpec` format carries `key` and `mapKey` separately — the tool emits them equal,
  but the format supports several lineups standing on one map (hand-organized).

## 8. Where the Cartographer is going (planned tiers)

- **Full bridge/stacked-cell authoring** — multi-span chains, ramp guidance, per-deck
  properties.
- Possible later: undo/redo, marquee selection, elevation smoothing brushes.
