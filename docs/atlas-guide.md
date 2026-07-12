# Atlas — the campaign authoring guide

*The enduring reference for the Atlas graph editor and the campaign data
model it authors. Both halves matter: the front half is the tool guide
(grows as tiers are added), the appendix is the authoritative plain-language
model of how nodes and beats actually work — the reference for authoring the
campaign whether or not the tool is open. Update this document whenever an
Atlas tier ships or the node/beat model changes.*

*Current tool scope: the **structural tier** (ADR-0147, S90). Atlas authors
the campaign skeleton — topology, chapters, capabilities, layout,
placeholder battles. Scenes, real battle content, and enemies are
hand-authored (see §4); beat/scene/enemy editing and economy-bundle
assignment are planned later tiers (§6).*

---

## 1. Loading Atlas

Run the dev server (`npm run dev`) and append `?atlas` to the app URL —
e.g. `http://localhost:5173/?atlas`. Atlas is DEV-gated and lazy-loaded:
production builds contain no trace of it.

On first load Atlas imports the **shipped campaign graph**
(`M1_CAMPAIGN_GRAPH` + `NODE_LAYOUT`), so you are always editing the real
thing. Your working copy then lives in localStorage
(`taciturn-atlas-draft-v1`), auto-saved on every change, surviving reloads.
**Reset to shipped** (toolbar) discards the draft and re-imports the
checked-in graph (it asks first). Drafts are disposable scratch by design —
a model-shape change in a future session bumps the storage key and orphans
old drafts rather than migrating them.

## 2. The editor

### Canvas

- **Wheel** — zoom about the cursor.
- **Drag background** — pan.
- **Drag a node** — place it. Positions round to integers and become the
  layout module on export.
- **Click a node** — select (opens the inspector). Click background to
  deselect.

Nodes render in the world-map idiom plus editor chrome: the circle's tint
and inline number show the **chapter**, `START` marks the entry node, and
badges under the name show capabilities (`trade`, `skirmish`) and beats
status (`placeholder`, `no beats`).

### Toolbar

- **+ Add node** — new node near your selection: placeholder battle on the
  default template (River Ridge), chapter inherited from the selected node,
  auto-slugged id (`node-<name>`).
- **Preview** / **Export** — disabled while validation errors exist.
- **Reset to shipped** — see §1.

### Inspector (select a node)

- **Name** — display name. Commits per keystroke.
- **Id** — identity (enters saves!). Commits on blur/Enter; renaming
  remaps every edge and the start pointer automatically. See §4 for the
  content caveat.
- **Chapter** — integer ≥ 1, the chapter of first appearance. Organizational
  metadata (canvas regions, economy tiering, display) — *never* a
  reachability gate; validation keeps it consistent with the DAG instead
  (appendix A.2).
- **Offset** — the node's enemy-level offset (blank = 0). The one scaling
  lever: skirmish level = party average + offset.
- **Hub (trade)** / **Farmable** — orthogonal capability flags (appendix
  A.3). Any combination is legal; validation enforces the one hard rule
  (farmable needs a battle beat).
- **Beats source** — where this node's beats come from (appendix A.4):
  - *Hand-authored content* — `node-content.ts` has an entry under this
    node's id. Disabled when it doesn't.
  - *Placeholder battle* — a stand-in fight on a registered template
    (dropdown). Walkable immediately; replaced with real content later.
  - *None* — no beats at all: a pure market town or waypoint
    (visit-completes semantics, appendix A.6).
- **Win-edges (choice order)** — this node's outgoing win-edges, in the
  order the world map offers them. Reorder with ↑/↓, delete with ✕, click
  a target name to jump to it. Loss-edges (if any exist — none are
  authored today) list separately and can be deleted.
- **Draw edge from here…** — arms edge-drawing; click the target node on
  the canvas (Esc cancels). Duplicate edges are silently ignored.
- **Set as start** / **Delete node** — deleting the start deliberately
  leaves the start pointer dangling; validation reports it until you pick
  a new start (no silent re-pointing).

### Validation strip (bottom)

Runs live on every change. **Red ✕ = errors** — invariant violations the
runtime or codegen would fail loudly on; they disable Preview and Export.
**Gold △ = warnings** — authoring smells the runtime tolerates. Clicking a
finding selects the offending node. The full rule set is appendix B.

### Preview

Renders your draft through the **real** `WorldMapBeatView` — what you
preview is what ships. Pick a **Stand at** node: the map shows the exact
situation the driver would show after clearing the road to that node
(ancestors visited + cleared, real `travelChoices`, real badges). Clicking
a destination marches the banner and moves your stand-point, so the whole
draft is walkable, march animation included.

### Export

Shows the two generated modules with **Copy** and **Download**:

| Generated file | Contents |
|---|---|
| `src/campaign/node.ts` | ids table, nodes, edges, the graph |
| `src/app/interstitial/node-layout.ts` | node positions |

The browser can't write into the repo — paste (or drop the downloads) over
the two files, then run:

```
npx tsc -b && npx vitest run src/app/atlas
```

The type check plus the Atlas round-trip test are what vouch for the paste.
The round-trip test pins the checked-in files byte-for-byte against
import→export, so after a clean paste it passes by construction; a failure
means a partial paste or hand edits to a generated file.

## 3. The authoring loop

1. Sketch nodes and edges; set chapters, capabilities, placeholder
   templates.
2. Watch the validation strip go green.
3. Preview-walk the draft from a few stand-points.
4. Export → paste → `tsc` + tests.
5. Hand-author content for the nodes that need it (§4), switching each
   node's beats source from *placeholder* to *hand-authored content*.

## 4. The ownership boundary — what Atlas must never touch

The campaign splits into a **tool-owned** half and a **hand-authored** half
(ADR-0147). This split is what makes Atlas exports structurally lossless:
the exporter emits *references* to content and can't flatten or clobber
what it can't see.

| File | Owner | Contents |
|---|---|---|
| `src/campaign/node.ts` | **Atlas** (generated) | structure: ids, names, chapters, capabilities, beats *sources*, edges |
| `src/app/interstitial/node-layout.ts` | **Atlas** (generated) | node positions |
| `src/campaign/node-content.ts` | **hand** | scenes, battle beats, enemy derivation, `CAMPAIGN_RULESET_ID` |

Rules of the road:

- **Never hand-edit the generated files** beyond pasting a fresh export.
  The next export overwrites them wholesale; the headers say so.
- **All story/battle/enemy content goes in `node-content.ts`**, in its
  `NODE_CONTENT` table keyed by raw node-id string. A structural node with
  beats source *content* resolves through `contentBeats(id)`, which throws
  at module init if the entry is missing (fail loud).
- **Renaming a node id orphans its content entry.** Atlas remaps edges and
  the start pointer but cannot touch `node-content.ts`; validation reports
  `content-missing` before export, and the fix is renaming the
  `NODE_CONTENT` key to match.
- Adding content for a new node: write the beats in `node-content.ts`
  under the node's id, then flip the node's beats source to *hand-authored
  content* in Atlas and re-export (or hand-flip the one line — but then
  keep it canonical: `beats: contentBeats(M1_NODES.<key>)`).

## 5. What placeholder battles give you

A placeholder is a registered template's map + its default enemy garrison +
its deployment zones + deploy cap 5. The registry
(`src/content/battles/registry.ts`) lists only battlefields with deployment
zones, so **every placeholder is playable the moment it's exported**: the
start fight works, farmable valves open after clearing, skirmishes borrow
the battlefield, vitals probes resolve. The detail tier later swaps
placeholders for real battlefields and authored enemies in the same beat
slot. Default template: River Ridge.

## 6. Where Atlas is going (planned tiers)

Per the substrate notes' scoping sketch and ADR-0147's deferrals:

- **Beat/scene editor** (tier 2) — per-node ordered beat list; scene editor
  (title + lines with speaker/portrait picker); battle-beat editor
  (template, zones, deployCap, an authored-enemies grid seeded from
  template slots — the `riverRidgeEnemies` pattern as a form). *Prerequisite
  decision:* this tier writes into what is today the hand-authored half, so
  the §4 ownership boundary must be redrawn deliberately (likely per-block,
  not per-file) before building it.
- **Engagement queues + per-beat edge gating** (runtime-first) — the
  "return to camp for a new story that opens a new path" pattern. The save
  already supports it (appendix A.5); the runtime model doesn't yet.
- **Progressive reveal** — nodes appearing on the map as milestones clear.
  Mostly derivable from existing save data; see the handoff/planner notes.
- **Economy layer** (tier 4) — per-node shop-bundle assignment
  (`firstAvailableAt`) once balance data exists.
- **Out of scope permanently (recommended):** battle-*template* authoring
  (maps, terrain, victory conditions) — a separate, bigger tool.

---

# Appendix A — the campaign data model

*The plain-language model behind the tool. Code: `src/campaign/graph.ts`
(graph + node types, routing), `src/campaign/sequence.ts` (beats),
`src/campaign/travel.ts` (travel semantics), `src/campaign/node-content.ts`
(content), `src/campaign/placeholder-beat.ts` (placeholders). Design
lineage: ADR-0134 (graph), ADR-0135 (battle-as-beat), ADR-0145 (economy
capabilities + travel), ADR-0147 (chapter, split, Atlas).*

## A.1 The graph

A campaign is **one `CampaignGraph`**: a single `startId`, a list of nodes,
and a list of directed, outcome-aware edges. It is **static authored
content** — plain TypeScript, never serialized. Saves store only *ids into
it* (`currentNodeId`, `visited`, `clearedStoryBeats`), which is why
reshaping the graph can't corrupt a save beyond dangling ids (and the
deserializer fails loudly on those).

- The win-edge graph is a **forward DAG**: no cycles, everything reachable
  from the start, at least one terminal reachable.
- A **terminal** node has zero win-edges; clearing it completes the
  campaign.
- **Edges double as roads.** Return travel and the world-map march treat
  win-edges as undirected roads. There is no separate road layer: if two
  places should be walkable-between, they need an edge.
- **Edge order is authored data**: a node's win-edges appear on the map in
  authored order.

## A.2 The node

```ts
interface CampaignNode {
  id: string;            // stable slug ('node-river-ridge') — enters saves
  name: string;          // display name
  chapter: number;       // chapter of first appearance (≥ 1)
  beats: NodeBeat[];     // the CURRENT story engagement (A.4)
  storyBeatId?: string;  // engagement id for the cleared guard (A.5)
  offset?: number;       // enemy-level offset (A.3)
  isHub?: boolean;       // commerce here once visited (A.3)
  farmable?: boolean;    // repeatable skirmish once cleared (A.3)
}
```

- **`id` is identity** (CLAUDE.md rule 4). It appears in saves; changing a
  shipped node's id breaks resume for saves standing on it. Rename freely
  before shipping, deliberately after.
- **`chapter`** is organizational/tiering metadata: Atlas canvas regions,
  the equipment lineup's Ch1/2/3 economy tiers, display grouping. It is
  **not** a reachability gate — reachability is purely DAG-driven. The
  consistency contract is validation's monotonicity rule: a win-edge may
  not lead to an earlier chapter (equal is fine; loss-edges are exempt).
  The map is **monotonic**: once a node's chapter is reached the node
  persists — there is no disappearance mechanism, by decision.

## A.3 Capabilities (orthogonal flags, not a type enum)

A location is not "a shop node" or "a battle node" — capabilities are
independent flags that coexist and change meaning over campaign progress
(the Dorter pattern: one town can host a story battle, farm, *and* trade).

- **`isHub`** — shop + recruitment available once the node has been
  *visited*. No clear-gate of its own.
- **`farmable`** — once the node's story engagement is *cleared*, it offers
  a repeatable on-demand skirmish that borrows the node's battlefield
  (hence the hard rule: farmable requires a battle beat). Skirmish enemies
  come from the `generateSkirmishParty` seam (M4 replaces the stub).
- **`offset`** — the one scaling lever: skirmish level =
  `resolveEnemyLevel(partyAverage, offset)`. Prices challenge and all three
  rewards (XP/JP/gil) together.

## A.4 Beats — what happens when you enter a node

A node owns an **ordered beat sequence**; the driver walks it on entry.
Two beat kinds:

- **`story-scene`** — presentational: a titled scene of dialogue lines
  (`speaker`, `text`, optional `portrait` — a class portrait, a fixed plot
  key, or none for a narrator plate).
- **`battle`** — structural: launches the engine with a `NodeBattle`:

```ts
interface NodeBattle {
  template: BattleConfig;      // map + terrain + enemy team + player slots
  playerTeam: TeamId;          // 'team_a' in all shipped content
  zones: DeploymentZoneConfig; // deployment zones (content registry)
  deployCap: number;           // K of N roster units deployable (5 shipped)
  enemies?: CampaignUnit[];    // authored enemy progression (optional)
}
```

Authored shapes all exist in shipped content: `[story, battle]`,
`[battle, story]`, `[story]` (standalone story node), `[battle]`, and
`[]` (a pure market town — see A.6). Multi-battle nodes are
model-supported but not driver/save-exercised.

- **Battle templates are not campaign content** — they live in
  `src/content/battles/` and beats *reference* them.
- **Authored enemies** (`enemies?`) re-skin the template's enemy slots:
  curve stats at an authored level, mid-battle leveling, kits gated to
  authored unlocks. The shipped pattern derives them *from* the template's
  own slots (`riverRidgeEnemies()`), overriding only level + kit breadth.
  Absent → the template's enemies pass through as-authored.
- **Placeholder beats** (§5) are ordinary single-battle beats built from
  the template registry; the runtime can't tell them apart from "real"
  ones.

## A.5 The per-beat cleared guard (and why re-arms are already half-built)

When an engagement fully plays, the save records `storyBeatIdOf(node)` —
the explicit `storyBeatId` if authored, else the node id — in
`clearedStoryBeats`. The guard is **per-beat, not per-node**: an
already-cleared beat never replays, but a location that later re-arms with
a *new* engagement under a *new* beat id is a legitimate new fight, no save
migration needed. Today every node has exactly one engagement, so nobody
authors `storyBeatId` explicitly; the field exists so the **engagement
queue** (the "return to camp later" pattern) can land as a runtime/model
feature without touching the save shape. What that feature still needs:
the queue on the node, arming triggers, and per-beat edge gating (§6).

## A.6 Travel semantics — how the map decides where you can go

All pure selectors in `travel.ts`, driven by the graph + the save:

- **Story-cleared:** a node with beats is cleared when its current beat id
  is in `clearedStoryBeats`. A node with **no beats** completes on **first
  visit** (visit-completes) — that's what lets a pure market town sit on
  the road without blocking progression through it.
- **Frontier (forward progress):** the win-edge targets of cleared nodes
  whose own story is still ahead. These render as *advance* choices.
- **Returnable:** any *visited* node that still offers something (armed
  story, open skirmish valve, commerce). Return travel is free — no travel
  friction by design. These render as *revisit* choices with badges.
- **Re-entry** resolves what's *currently* available: an armed story plays;
  a cleared location opens the location menu (skirmish / shop / recruit /
  leave).

## A.7 Layout

Node positions are authored data in `node-layout.ts` (viewBox units,
integers). The world map derives its frame from layout bounds with the
original 640×350 as the floor, so small graphs render exactly as always
and larger ones expand instead of clipping. Nodes closer than ~40 units
collide labels (validation warns).

---

# Appendix B — validation rules

Errors gate Preview/Export; warnings don't. Rule ids are stable (tests key
on them).

| Rule | Level | Meaning |
|---|---|---|
| `id-empty` / `id-duplicate` | error | Node ids must be non-empty and unique (they enter saves). |
| `id-no-key` / `id-key-collision` | error | Every id must yield a unique codegen identifier (`node-river-ridge` → `riverRidge`). |
| `story-beat-id-collision` | error | Effective beat ids (explicit or defaulted to node id) must be unique — the cleared guard keys on them. |
| `start-missing` | error | `startId` must be a node. |
| `edge-dangling` / `edge-self` | error | Edges must resolve to nodes; no self-loops. |
| `unreachable` | error | Every node reachable from the start via win-edges. |
| `no-terminal` | error | At least one terminal reachable, or the campaign can't complete. |
| `cycle` | error | Win-edges must form a forward DAG. |
| `chapter-regression` | error | A win-edge may not lead to an earlier chapter (loss-edges exempt). |
| `name-empty` / `chapter-invalid` | error | Names non-empty; chapters integers ≥ 1. |
| `content-missing` | error | Beats source *content* but `node-content.ts` has no entry for the id. |
| `template-unknown` | error | Placeholder template key not in the registry. |
| `farmable-no-battle` | error | Farmable requires a battle beat to borrow a battlefield from. |
| `deploy-cap-overflow` / `enemies-overflow` | error | `deployCap` ≤ template player slots; authored enemies ≤ template enemy slots. |
| `start-no-battle` | warning | A battle-less start is legal (S88 probe fallback) but unusual. |
| `layout-overlap` | warning | Two nodes closer than 40 viewBox units — labels collide. |

---

# Appendix C — glossary

- **Atlas** — the in-app campaign graph editor (`?atlas`).
- **Node** — one location on the campaign map; owns a beat sequence.
- **Beat** — one step of a node's entry sequence: a story scene or a battle.
- **Engagement** — a node's current story beat sequence, identified by its
  `storyBeatId` for the cleared guard.
- **Win-edge** — a directed edge that opens as forward progress when its
  source node's story clears; also an undirected *road* for return travel
  and the march.
- **Choice order** — the authored order of a node's win-edges; the order
  the world map lists destinations.
- **Terminal** — a node with no win-edges; clearing it wins the campaign.
- **Frontier** — the not-yet-cleared win-edge targets of cleared nodes; the
  *advance* choices.
- **Returnable** — a visited node still offering something; the *revisit*
  choices.
- **Visit-completes** — a beat-less node's "story" clears on first visit,
  so towns never block a road.
- **Chapter** — a node's chapter of first appearance; organizational
  tiering, never a reachability gate; non-decreasing along win-edges.
- **Hub** — commerce (shop + recruit) once visited.
- **Farmable** — repeatable skirmish once cleared; borrows the node's
  battlefield.
- **Offset** — per-node enemy-level delta off the party average; the one
  scaling lever.
- **Placeholder battle** — a stand-in battle beat on a registered template;
  keeps every exported skeleton immediately walkable.
- **Beats source** — where a structural node's beats come from: content /
  placeholder / none.
- **Round-trip** — import shipped graph → export → byte-identical files;
  the tool's core correctness contract, pinned by `codegen.test.ts`.
- **Structural tier** — the shipped Atlas scope: topology + capabilities +
  layout, not content.
- **Monotonic map** — nodes never disappear once their chapter is reached.
