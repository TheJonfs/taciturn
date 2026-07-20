# Cartographer — the battle-map authoring guide

The Cartographer (`?cartographer`) is the Atlas companion for **battle maps**: where Atlas authors
the campaign graph the nodes hang on, the Cartographer authors the tile grids the battles are
fought on. It is DEV-gated (the route does not exist in production builds) and follows the same
contract Atlas proved: the shipped map modules are its codegen output, exports are byte-identical
round-trips of what it imports, and the preview is the **real battle renderer** — what you author
is what ships.

Shipped in S98 (ADR-0157). This is the Tier 1 tool: terrain + deployment. Enemy-party placement
is the designed second mode, not yet built.

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

### 5b. Make it a battle template

Create `src/content/battles/<key>-battle.ts` by the restage pattern every shipped map uses
(crib `oskun-fields-battle.ts`): spread `riverRidgeBattle`, swap in your map, give it a
`battleId`, and restage the ten `STARTING_POSITIONS` onto sensible tiles (these are the
authored fallback positions; campaign play replaces the lineups but keeps the staging). Then
register it in `src/content/battles/registry.ts`:

```ts
zelmonia_hills: { label: 'Zelmonia Hills', template: zelmoniaHillsBattle, zonesKey: 'zelmonia_hills' },
```

The registry key must equal the map/zones key — one name per battlefield across both registries.
This alone also makes the map selectable as an Atlas placeholder battle.

(Optional, for quick iteration: add a `MAP_OPTIONS` entry in `src/app/App.tsx` and the map
becomes a one-click quick battle from the setup screen — the fastest way to *fight* on it
without campaign context.)

### 5c. Point the story node at it

Ch1 battle beats live in `src/campaign/node-content.ts`, built by the `battle(template,
zonesKey, extras)` helper. Find the node's entry and swap both arguments:

```ts
'node-zelmonia-hills': [
  marker(/* … */),
  battle(zelmoniaHillsTemplate, 'zelmonia_hills', {   // was river_ridge
    enemies: [theoRenault(4, false), ...lineup(4, 4)],
    grants: [itemId('flametongue')],
    /* … */
  }),
],
```

where `zelmoniaHillsTemplate` is your new template, wrapped with the node's existing
modifiers if it had any (`withGuestSlot`, `withLeadEnemySlot`, custom `victoryConditions`,
`battleId`) — keep the node's `enemies`/`joins`/`grants`/outcome riders exactly as they were;
they're map-independent. Guest-slot and named-enemy positions are authored coordinates —
restage them onto your terrain.

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

## 7. Where the Cartographer is going (planned tiers)

- **Tier 2 — enemy-party placement** (agreed fast-follow, ADR-0157): a second canvas mode
  placing enemy units — class + level + position + facing — with kits auto-filled by the
  `enemy-kit.ts` framework, exported as a battle **lineup** referencing a map key, separate from
  the map template. This replaces the hand-restaged `STARTING_POSITIONS` step in 5b for story
  lineups.
- **Full bridge/stacked-cell authoring** — multi-span chains, ramp guidance, per-deck
  properties.
- Possible later: undo/redo, marquee selection, elevation smoothing brushes.
