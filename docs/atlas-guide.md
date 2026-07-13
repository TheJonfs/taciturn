# Atlas — the campaign authoring guide

*The enduring reference for the Atlas graph editor and the campaign data
model it authors. Both halves matter: the front half is the tool guide
(grows as tiers are added), the appendix is the authoritative plain-language
model of how nodes and beats actually work — the reference for authoring the
campaign whether or not the tool is open. Update this document whenever an
Atlas tier ships or the node/beat model changes.*

*Current tool scope: the **structural tier** (ADR-0147, S90) plus
**engagement queues, per-beat edge gating, and placeholder scenes**
(ADR-0148, S91). Atlas authors the campaign skeleton — topology, chapters,
capabilities, layout, engagement queues with arming rules, per-beat edge
gates, placeholder battles and stub scenes. Real scenes, battle content,
and enemies are hand-authored (see §4); beat/scene/enemy editing and
economy-bundle assignment are planned later tiers (§6).*

---

## 1. Loading Atlas

Run the dev server (`npm run dev`) and append `?atlas` to the app URL —
e.g. `http://localhost:5173/?atlas`. Atlas is DEV-gated and lazy-loaded:
production builds contain no trace of it.

On first load Atlas imports the **shipped campaign graph**
(`M1_CAMPAIGN_GRAPH` + `NODE_LAYOUT`), so you are always editing the real
thing. Your working copy then lives in localStorage
(`taciturn-atlas-draft-v2`), auto-saved on every change, surviving reloads.
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
status (`placeholder` when any engagement is a stand-in, `no beats`, and
`×N` for a node with an N-engagement queue).

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
- **Engagements (queue order)** — the node's ordered engagement queue
  (appendix A.4/A.5). Each card carries:
  - *Beat id* — the engagement's cleared-guard id. Blank on the FIRST
    engagement means "the node id" (the shorthand every single-engagement
    node uses); every later engagement must author one explicitly
    (validation gates it). Adding an engagement auto-fills a fresh
    `<node-id>-N` id.
  - *Beats source* — where this engagement's beats come from:
    *hand-authored content* (a `node-content.ts` entry under the effective
    beat id; disabled when none exists), *placeholder battle* (a stand-in
    fight on a registered template), or *placeholder scene* (a one-line
    stub carrying your marker text — "Scene between X and Y here" — so
    structure walks before dialogue exists).
  - *Arms after* (second engagement onward) — the beat whose clearing arms
    this engagement. Default is the previous engagement in the queue; pick
    a beat at ANOTHER node for the "camp re-arms after you clear a mission
    elsewhere" shape.
  - ↑/↓ reorder within the queue; ✕ removes. **Removing every engagement**
    makes the node a pure town/waypoint (visit-completes, appendix A.6).
- **Win-edges (choice order)** — this node's outgoing win-edges, in the
  order the world map offers them. Reorder with ↑/↓, delete with ✕, click
  a target name to jump to it. Each edge has an **opens on** picker: the
  beat whose clearing opens this road as forward progress (default = the
  source's first engagement — exactly the old "clearing the node opens its
  edges"). Gate different edges on different engagements to make each camp
  visit open a different path. Loss-edges (if any exist — none are
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
preview is what ships. The preview is a **stateful walk** (ADR-0148): it
starts at your start node with its first engagement won, and every
destination you click travels there and wins whatever engagement is armed
at arrival (one per entry, exactly as the driver plays them). The toolbar
shows the running cleared-beat count and the last beat cleared; **Restart
walk** rewinds to the start. Because the walk accumulates a real
play-through, multi-visit shapes — a camp whose second story arms after a
mission elsewhere and opens a different road — are walkable exactly as
they will ship, march animation included.

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
   engagement's beats source from *placeholder* to *hand-authored
   content*.

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
  `NODE_CONTENT` table keyed by raw **effective beat id** (ADR-0148): a
  single-engagement node's default beat id IS its node id, so the classic
  keys are unchanged; a later engagement in a queue keys by its explicit
  `storyBeatId`. An engagement with beats source *content* resolves through
  `contentBeats(beatId)`, which throws at module init if the entry is
  missing (fail loud).
- **Renaming a node id orphans its content entry.** Atlas remaps edges,
  the start pointer, and any `armsAfter`/`opensOnBeat` references riding
  the default first-engagement beat id — but cannot touch
  `node-content.ts`; validation reports `content-missing` before export,
  and the fix is renaming the `NODE_CONTENT` key to match.
- Adding content for a new engagement: write the beats in
  `node-content.ts` under its effective beat id, then flip that
  engagement's beats source to *hand-authored content* in Atlas and
  re-export.

## 5. What placeholders give you

A **placeholder battle** is a registered template's map + its default
enemy garrison + its deployment zones + deploy cap 5. The registry
(`src/content/battles/registry.ts`) lists only battlefields with deployment
zones, so **every placeholder is playable the moment it's exported**: the
start fight works, farmable valves open after clearing, skirmishes borrow
the battlefield, vitals probes resolve. The detail tier later swaps
placeholders for real battlefields and authored enemies in the same beat
slot. Default template: River Ridge.

A **placeholder scene** (ADR-0148) is a one-line stub scene titled
"Placeholder Scene" carrying your marker text ("Scene between Lumen and
Chris here"). With stub scenes + placeholder battles, a full chapter —
scene → battle → scene → return-to-camp → new scene — is **walkable as
pure structure before any real dialogue is written**. Swap for real
content later by flipping the engagement's source to *content*.

## 6. Where Atlas is going (planned tiers)

Per the substrate notes' scoping sketch and ADR-0147's deferrals:

- **Beat/scene editor** (tier 2) — per-node ordered beat list; scene editor
  (title + lines with speaker/portrait picker); battle-beat editor
  (template, zones, deployCap, an authored-enemies grid seeded from
  template slots — the `riverRidgeEnemies` pattern as a form). *Prerequisite
  decision:* this tier writes into what is today the hand-authored half, so
  the §4 ownership boundary must be redrawn deliberately (likely per-block,
  not per-file) before building it.
- ~~Engagement queues + per-beat edge gating~~ — **SHIPPED whole**
  (ADR-0148, S91): runtime model + Atlas authoring + stateful preview.
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
  id: string;                 // stable slug ('node-river-ridge') — enters saves
  name: string;               // display name
  chapter: number;            // chapter of first appearance (≥ 1)
  engagements: Engagement[];  // the ORDERED story queue (A.4/A.5)
  offset?: number;            // enemy-level offset (A.3)
  isHub?: boolean;            // commerce here once visited (A.3)
  farmable?: boolean;         // repeatable skirmish once cleared (A.3)
  phantom?: boolean;          // shown on the map, never reachable (A.3)
}

interface Engagement {
  storyBeatId?: string;  // cleared-guard id; first defaults to the node id
  beats: NodeBeat[];     // this engagement's scene/battle sequence (A.4)
  armsAfter?: string;    // beat that arms this; default = previous in queue
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
- **`phantom`** (ADR-0149) — a drawn-but-never-traversable destination
  (Viura beyond Old Ordal: the town the party can see but the chapter
  never opens). Renders as a ghost (dashed outline, faded label); never
  enters the frontier, travel, or reachability. Pair it with a
  `phantom: true` **edge** (dashed on both canvases) — validation errors
  on a *real* edge into a phantom node (`phantom-target-real-edge`, it
  would make the phantom enterable) and warns on engagements authored on
  one (`phantom-with-engagements`, dead content). Phantom nodes are
  exempt from `unreachable` *per-flag* — a real unreachable node next to
  a phantom one still errors.

## A.4 Beats — what happens when you enter a node

A node owns an **ordered queue of engagements**; each engagement owns an
ordered beat sequence. On entry the driver walks the **current**
engagement's beats — the earliest engagement that is *armed* (first in
queue, or its `armsAfter` beat is cleared) and *not yet cleared*. Most
nodes have exactly one engagement, which behaves exactly like the
pre-queue model. Two beat kinds:

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
  guests?: CampaignUnit[];     // guest allies re-skinning guest slots (ADR-0149)
  recordOutcomeAs?: string;    // flag key the fired outcome tag writes to (ADR-0149)
  onOutcome?: Record<string, StoryScene>; // outcome-branched follow-up scene (ADR-0149)
}
```

Authored beat shapes all exist in shipped content: `[story, battle]`,
`[battle, story]`, `[story]` (standalone story node), `[battle]`, and a
node with `engagements: []` (a pure market town — see A.6). Multi-battle
engagements are model-supported but not driver/save-exercised.

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

## A.5 Engagement queues + the per-beat cleared guard

When an engagement fully plays, the save records its **effective beat id**
(`engagementBeatId`: the explicit `storyBeatId` if authored, else — first
engagement only — the node id) in `clearedStoryBeats`. The guard is
**per-beat, not per-node**: an already-cleared beat never replays, but a
later engagement in the queue under its own beat id is a legitimate new
story, no save migration needed. That first-engagement node-id default is
also the save-compat rule: pre-queue saves recorded node ids, and they
resolve unchanged.

**Arming** (ADR-0148): the first engagement is armed at node availability;
a later one arms when its `armsAfter` beat clears — the previous
engagement by default (sequential same-node chains), or a beat at ANY node
(the Igros shape: the camp re-arms after you clear a mission elsewhere).
The **current** engagement on entry is the earliest armed-and-uncleared
one; when nothing is armed right now the node is *temporally
story-complete* — it trades and farms like any cleared location, and flips
back to an armed story when a distant beat arms its next engagement.

**Per-beat edge gating**: each win-edge opens when its `opensOnBeat` beat
clears (default: the source's first engagement — the classic "clearing a
node opens its edges"). Edge opening is **monotonic** — an opened road
never closes, even while the source re-arms — so gate different edges on
different engagements to make each camp visit open a different path.

## A.6 Travel semantics — how the map decides where you can go

All pure selectors in `travel.ts`, driven by the graph + the save:

- **Story-cleared:** TEMPORAL — nothing armed-and-uncleared at the node
  right now (A.5). A node with **no engagements** completes on **first
  visit** (visit-completes) — that's what lets a pure market town sit on
  the road without blocking progression through it.
- **Frontier (forward progress):** the targets of OPEN win-edges (per-beat
  gating, A.5) whose own story is still ahead. These render as *advance*
  choices.
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
| `story-beat-id-collision` | error | Effective beat ids (explicit, or node id for a defaulted first engagement) must be unique across ALL nodes' engagements — the cleared guard keys on them. |
| `engagement-id-missing` | error | Every engagement past the first must author an explicit `storyBeatId` (only the first may default to the node id). |
| `arms-after-unknown` / `opens-on-unknown` | error | `armsAfter` / `opensOnBeat` must reference a real engagement's beat id. |
| `unreachable-under-gating` | error | A node structurally reachable but unreachable once edge gates + arming are accounted for (joint fixpoint over achievable beats and reachable nodes). |
| `engagement-never-arms` | error | An engagement whose arms-after chain can never clear (includes arming cycles). |
| `scene-marker-empty` | warning | A placeholder scene with no marker text. |
| `start-missing` | error | `startId` must be a node. |
| `edge-dangling` / `edge-self` | error | Edges must resolve to nodes; no self-loops. |
| `unreachable` | error | Every node reachable from the start via win-edges. Phantom nodes are exempt per-flag (unreachable by design); phantom edges contribute nothing to reachability. |
| `phantom-target-real-edge` | error | A real (non-phantom) edge into a phantom node — it would make the phantom enterable. Mark the edge phantom too. |
| `phantom-with-engagements` | warning | Engagements authored on a phantom node can never play (dead content). |
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
- **Node** — one location on the campaign map; owns an ordered
  engagement queue.
- **Beat** — one step of a node's entry sequence: a story scene or a battle.
- **Engagement** — one entry of a node's ordered story queue: a beat
  sequence that clears once, forever, under its effective beat id. The
  *current* engagement is the earliest armed-and-uncleared one.
- **Arms after** — the beat whose clearing makes a later engagement
  playable; previous-in-queue by default, any node's beat by authoring.
- **Opens on** — a win-edge's gate: the beat whose clearing opens the road
  (source's first engagement by default). Monotonic — opened roads never
  close.
- **Placeholder scene** — a one-line stub scene carrying the author's
  marker text; makes structure walkable before dialogue exists.
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
