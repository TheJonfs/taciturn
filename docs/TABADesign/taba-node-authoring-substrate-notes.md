# TABA node/map authoring — substrate notes for the authoring-utility session

*Written S88 (2026-07-11) at Chris's request. Purpose: when campaign authoring
(M4/M5) begins, Chris wants a small HTML/TS-driven utility with a real UI for
authoring nodes — the graph, per-node capabilities, and the story
interstitials — instead of hand-editing TypeScript. Building that tool is a
session-sized project of its own. This document is the enabling half: an
**authoritative reference of how nodes and the map actually work today**
(everything the tool would read and write), a **scoping sketch**, and the
**open decisions** the planner should settle before an implementation session
picks it up. Substrate references are current as of ADR-0145; re-audit
lightly if sessions have landed since.*

---

## 1. The authored data model (what the tool edits)

The campaign map is **static authored content** — plain TypeScript values in
`src/campaign/node.ts` (`M1_CAMPAIGN_GRAPH`). It is *never serialized*; the
save stores only ids into it (`currentNodeId`, `visited`, `clearedStoryBeats`).
That split is what makes authoring safe: reshaping the graph can't corrupt a
save beyond dangling ids, and the deserializer fails loud on those.

### 1.1 The graph (`src/campaign/graph.ts`)

```ts
interface CampaignGraph {
  startId: string;
  nodes: CampaignNode[];
  edges: CampaignEdge[];   // { from, to, on: 'win' | 'loss' }
}
```

- **Forward DAG of win-edges.** An edge `{from, to, on:'win'}` means: clearing
  `from`'s story beat offers `to` as forward progress. Authored edge order =
  the order choices render on the map. Loss-edges are expressible but
  unauthored (loss = retry, handled in the driver).
- **Roads are edges read undirected.** Return travel (travel.ts) and the
  world-map march animation both treat win-edges as two-way roads. There is
  no separate road layer — if two nodes should be walkable-between, they need
  an edge.
- A **terminal** node (no win-edges) completes the campaign when cleared.

### 1.2 The node (`graph.ts`, capabilities per ADR-0145)

```ts
interface CampaignNode {
  id: string;              // stable slug, e.g. 'node-river-ridge' — in saves!
  name: string;            // display name
  beats: NodeBeat[];       // the CURRENT story engagement (see 1.3)
  storyBeatId?: string;    // engagement id for the cleared guard; default = node id
  offset?: number;         // enemy-level offset: skirmish level = partyAvg + offset
  isHub?: boolean;         // shop + recruitment here (commerce on visit)
  farmable?: boolean;      // skirmish valve opens once story cleared
}
```

Capabilities are **orthogonal flags, not a type enum** — a location can be
hub + farmable + have a story battle simultaneously (the Dorter pattern; the
driver presents coexisting availabilities as a menu). The authoring tool
should present them as independent toggles.

**The per-BEAT cleared guard:** the save records `storyBeatIdOf(node)`
(= `storyBeatId ?? node.id`) when an engagement fully plays. A future
location that re-arms with a LATER story beat (Dorter re-arm queue) must give
each engagement a distinct `storyBeatId` — that is the entire migration
story; the save shape already accommodates it. Today every node has exactly
one engagement, so nobody authors `storyBeatId` explicitly yet.

### 1.3 Beats — the story engagement (`src/campaign/sequence.ts`)

A node owns an **ordered beat sequence**; the driver walks it on entry:

```ts
type NodeBeat = StorySceneBeat | BattleBeat;

interface StorySceneBeat {
  type: 'story-scene';
  scene: { title?: string; lines: DialogueLine[] };
}
interface DialogueLine {
  speaker: string;         // display name
  text: string;
  portrait?: PortraitRef;  // absent = plain nameplate (narrator)
}

interface BattleBeat {
  type: 'battle';
  battle: NodeBattle;
}
interface NodeBattle {
  template: BattleConfig;       // map + enemy team + placeholder player slots
  playerTeam: TeamId;           // 'team_a' in all shipped content
  zones: DeploymentZoneConfig;  // deploymentZonesFor(key) — content registry
  deployCap: number;            // K of N roster units deployable
  enemies?: CampaignUnit[];     // authored enemy progression (optional)
}
```

Authoring shapes that all exist in shipped content: `[story, battle]`
(pre-battle scene), `[battle, story]` (aftermath), `[story]` (standalone
story node), `[battle]`. Multi-battle nodes (`[battle, story, battle]`) are
model-supported but never authored; the save is node-granular, so a
mid-sequence reload resumes at the world map.

- **Portraits:** `PortraitRef` is `{kind:'class', classId, gender?}` (derive
  from a class — generics) or `{kind:'fixed', key}` (a plot character's
  enduring face, e.g. `plot-chris`; registry in
  `src/assets/portraits/index.ts`, unknown keys fall back gracefully). A
  dialogue editor wants a picker over: none / class(+gender) / fixed key.
- **Battle templates** are NOT campaign content — they live in
  `src/content/battles/*.ts` (map + terrain + enemy placements + victory
  conditions) and campaign beats *reference* them. Five exist (river-ridge,
  stonebridge, marshmoor, mountain-pass, training-field, plus demo).
- **Deployment zones** come from `src/content/deployment/` —
  `deploymentZonesFor(key)`, keys parallel the template names.
- **Authored enemies** (`enemies?`) re-skin the template's enemy slots
  through `foldEnemyTeam`: each is a `CampaignUnit` built via
  `authoredEnemy({id, name, classId, level, loadout, equipment, unlocks})` —
  curve stats at `level`, mid-battle leveling, kit GATED to `unlocks` (a
  subset = a deliberately weak enemy). The shipped pattern
  (`riverRidgeEnemies()` in node.ts) derives them FROM the template's slots
  (reusing slot ids/positions) and overrides level + kit. Count must not
  exceed the template's enemy slots; extras pass through as-authored.

### 1.4 Map layout — currently render-layer (a known wart)

Node positions for the world-map SVG live in `NODE_LAYOUT` in
`src/app/interstitial/WorldMapBeatView.tsx` — a hand-authored
`Record<nodeId, {x, y}>` in a 640×350 viewBox, **not** part of the authored
graph. An authoring tool wants drag-to-place layout as part of its output;
migrating layout into authored campaign data (a field on `CampaignNode` or a
sibling layout module the view imports) is a natural **precursor chore** for
the tool session. The march animation and edge rendering read the same
table, so it's a one-module move.

### 1.5 Adjacent economy authoring (same tool or phase 2)

- **`offset`** (on the node) is the one scaling lever — it prices skirmish
  challenge AND all three rewards.
- **Shop bundles:** `firstAvailableAt: nodeId` on gear-pool entries
  (`src/campaign/equipment-pool.ts`), today stamped from the throwaway
  `PLACEHOLDER_BUNDLES` table. The real bundle→node assignment is exactly
  the kind of thing a node-authoring UI could edit (a per-node "items this
  clear adds to the shop pool" list), but it needs balance data — planner's
  call whether it's in the tool's v1.
- Prices/curves live in `src/campaign/economy-config.ts` — global constants,
  not per-node; probably out of the tool's scope.

## 2. Invariants the tool must validate (the checklist)

Anything the tool exports should pass these before a human ever runs it —
most have fail-loud runtime counterparts, but authoring-time validation is
the point of having a tool:

1. **Ids:** node ids unique, non-empty, stable (they enter saves); edge
   `from`/`to` must resolve; `startId` must exist. `storyBeatId`s (where
   authored) unique across all engagements.
2. **Reachability:** every node reachable from `startId` via win-edges; at
   least one terminal node reachable (or the campaign can't complete).
3. **The start node must contain a battle beat** — `bootstrapRosterVitals`
   probes effective maxes against it and throws otherwise.
4. **`farmable` requires a battle beat** (the skirmish borrows the node's
   battlefield; `isFarmableNow`/`buildSkirmishBattle` guard it).
5. **`isHub` requires a battle beat** today — recruitment sizes the hire's
   vitals against the hub's battlefield (`hireGeneric` fails loud). A
   battle-less market town needs an explicit template source first (noted in
   ADR-0145).
6. **Battle beats:** template exists; `playerTeam` has placeholder slots;
   zones key resolves; `deployCap` ≤ player slots; `enemies` count ≤
   template enemy slots; every authored enemy's `classId`/ability ids
   resolve in the catalog.
7. **Dialogue:** `fixed` portrait keys should resolve in `FIXED_PORTRAITS`
   (warn, don't block — art lands incrementally; unknown keys fall back).
8. **Layout:** every node has a position; positions distinct enough to
   render (badges/labels overlap below ~40px separation).
9. **Sanity for the march/roads:** the undirected edge graph should be
   connected (it is iff reachability holds), or return trips fall back to
   straight-line movement.

## 3. Where everything lives (file map)

| Concern | File |
|---|---|
| Graph + node types, routing, `storyBeatIdOf` | `src/campaign/graph.ts` |
| Beat model (`NodeBeat`, `NodeBattle`, cursor helpers) | `src/campaign/sequence.ts` |
| THE authored campaign (nodes/edges/scenes/enemies) | `src/campaign/node.ts` |
| Authored-enemy builder | `src/campaign/authored-enemy.ts` |
| Travel/availability semantics (what capabilities DO) | `src/campaign/travel.ts` |
| Skirmish valve (offset consumer) | `src/campaign/skirmish.ts` |
| Battle templates | `src/content/battles/*.ts` |
| Deployment zones | `src/content/deployment/` |
| Portrait refs + fixed-key registry | `src/assets/portraits/index.ts` |
| World-map layout (render-layer, see §1.4) | `src/app/interstitial/WorldMapBeatView.tsx` |
| Shop bundle assignment (placeholder) | `src/campaign/equipment-pool.ts` |
| Graph/lifecycle pins (what a refactor must keep green) | `src/campaign/{graph,node,sequence,travel,loop}.test.ts` |

## 4. Scoping sketch for the utility

The natural shape is a **dev-gated route in the existing app** (the
`?formation` harness precedent in `main.tsx`) rather than a separate
project: it gets the type system, the catalog, the real renderers, and hot
reload for free. Suggested capability tiers, each independently useful:

1. **Graph editor.** Canvas of nodes over the world-map skin: add/rename
   nodes, drag to place (writes layout), draw/delete win-edges (order
   matters — expose it), toggle capabilities, set `offset`. Live validation
   panel running §2.
2. **Beat-sequence editor** per node: ordered beat list (add/remove/reorder);
   story-scene editor (title + lines with speaker/text/portrait picker);
   battle-beat editor (template picker from the content registry, zones key,
   `deployCap`, and an authored-enemies grid seeded FROM the template's
   enemy slots — level + kit-subset per slot, the `riverRidgeEnemies`
   pattern as a form).
3. **Live preview.** Reuse the REAL components: `WorldMapBeatView` for the
   map (it already renders from graph + choices), `StorySceneBeatView` /
   `InterstitialRunner` for scenes, even `buildSkirmishBattle` to sanity-
   check a farmable node. This is the big payoff of living inside the app.
4. **Economy layer (later):** per-node shop-bundle assignment
   (`firstAvailableAt`) once balance data exists.
5. **Out of scope (recommend):** battle-TEMPLATE authoring (maps, terrain,
   victory conditions — a different, bigger tool), portrait art pipeline,
   engine anything.

Tool-side persistence: draft in localStorage; export on demand (format
below). Import should round-trip the shipped `M1_CAMPAIGN_GRAPH` so the
existing campaign is editable from day one — that round-trip is also the
tool's best correctness test.

## 5. Open decisions for the planner

1. **Export format: TypeScript codegen vs JSON + loader.** Today the graph
   is TS code — type-checked at build, and things like `riverRidgeEnemies()`
   derive enemies from template data with real logic. A tool wants a
   data format. Options: (a) codegen a `node.ts`-shaped module (keeps the
   type-checked substrate, diffs reviewably; generator must handle the
   derive-from-template enemy pattern or flatten it); (b) JSON schema + a
   runtime loader with loud validation (simpler tool, but a new load/
   validate layer and the derive-logic flattens to data). Leaning (a) for
   fidelity with everything else in the repo, but it's a real call.
2. **Layout ownership.** Move `NODE_LAYOUT` from the view into authored
   campaign data (precursor chore, small). Also: fixed 640×350 viewBox or
   authorable canvas size once the real map outgrows six nodes?
3. **Engagement queues.** Should the tool's data model support the Dorter
   re-arm queue (multiple `storyBeatId`'d engagements per node) from day
   one, even though the runtime driver only reads one engagement today?
   The save already supports it; the runtime `beats` field doesn't. Authoring
   ahead of the runtime risks drift; runtime-first is probably right.
4. **Scope of enemy authoring.** Full per-slot loadout/equipment editing, or
   the shipped pattern only (level + ability-subset over template slots)?
   The latter covers everything authored so far and is much less UI.
5. **Where it runs.** Dev route in-app (recommended, §4) vs standalone Vite
   page in the repo vs external tool. In-app maximizes reuse; standalone
   isolates risk. Either way it must be DEV-gated out of production builds
   (the `import.meta.env.DEV` chip precedent).
