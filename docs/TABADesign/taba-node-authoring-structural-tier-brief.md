# Brief — Node-authoring tool, structural tier (pre-economy-content)

*Status: plaintext review by Chris before it ships to CC. Design source:
`taba-node-authoring-substrate-notes.md` (the authoritative node/graph/beat data model + scoping tiers).
This is the **structural slice** of that tool — the prerequisite for the economy content pass, which needs
the chapter graphs laid out before bundles can key to nodes. Beat/enemy/economy authoring are later tiers,
explicitly deferred.*

---

## Context

The economy content pass (real bundle→node assignment) can't proceed until the campaign's chapter graphs
exist — which node is a gate, which is a hub, what level band each sits in, how they link. That layout is
provisional and will churn as the story firms up, so hand-editing x/y coords and edge arrays through the
churn is the wrong ergonomic; drag-to-place with live preview is the right one, and it earns its keep most
*now*, while the graph is soft.

Key finding: **the skeleton the economy pass reads is a subset of the node model that already ships**
(topology, `offset`, `isHub`, `farmable`, stable ids) — the structural tier authors a slice of the
existing model, not an extension. Only one new field (`chapter`) is added.

## Settled decisions (recorded)

- **Codegen, not JSON+loader** — preserves the "graph is static TS, never serialized, saves store only ids"
  safety invariant (a loader would reintroduce the graph-deserialization corruption surface the design
  removed).
- **`NODE_LAYOUT` → sibling authored module** — precursor chore; move it out of `WorldMapBeatView` (the
  march + edge rendering read the same table, so it's a one-module move).
- **In-app dev route** — `import.meta.env.DEV`-gated, the `?formation` harness precedent; reuses the type
  system, catalog, and real renderers (live-preview payoff).
- **Runtime-first on engagement queues** — the tool authors one engagement per node (what the driver
  reads); Dorter re-arm queues wait until the runtime reads multiple engagements.
- **Monotonic map** — nodes appear (chapter of first appearance), never disappear; disappearance deferred
  (it would conflict with the economy's monotonic availability and needs deliberate reconciliation).
- **Pan-zoom canvas, one graph spanning chapters** — one `CampaignGraph`, one `startId`, one terminal;
  chapters are regions linked by chapter-boundary edges. Far past the current 640×350/6-node viewBox.
- **Enemy-authoring depth: deferred** — a detail-tier decision that doesn't touch the structural tier.

## Goal

A dev-gated, in-app graph editor that authors the campaign **skeleton** — nodes, win-edges, capabilities
(`offset`/`isHub`/`farmable`), `chapter` tags, and layout — on a pan-zoom canvas with live map preview,
exporting **type-checked codegen** that round-trips the shipped `M1_CAMPAIGN_GRAPH`. Every exported
skeleton is **runtime-valid and immediately walkable** (placeholder battle templates). Beat/scene/enemy
and economy-bundle authoring are deferred to later tiers.

---

## Work items

### WI0 — Precursor: move `NODE_LAYOUT` out of the view

Migrate `NODE_LAYOUT` from `WorldMapBeatView.tsx` into a sibling authored module the view imports. The
march animation and edge rendering read the same table, so update those imports. No behavior change; this
is what lets the tool own layout as authored output. Small.

### WI1 — Add the `chapter` field to the model

Add `chapter: number` (or a `ChapterId`) to `CampaignNode` — the chapter of first appearance. Authored;
drives canvas organization (chapter regions), economy tiering (maps the equipment lineup's Ch1/2/3 tiers
onto nodes), and display. **Not** a reachability gate — reachability stays DAG-driven; `chapter` is
organizational/tiering metadata that must stay *consistent* with the DAG (see validation). Monotonic map:
once a node's chapter is reached it persists; no disappearance field. Small.

### WI2 — Battle-presence via placeholder templates (keeps every skeleton walkable)

Any node the author marks `start`/`isHub`/`farmable` needs a battle beat (invariants). The structural tier
lets a node carry a **placeholder battle beat** referencing an existing template (default a neutral
stand-in, e.g. `training-field`), pickable from the content registry. This satisfies
`bootstrapRosterVitals`/`hireGeneric`/`buildSkirmishBattle` so the authored graph is runtime-valid and
walkable *immediately* — placeholder fights, real topology. The detail tier later swaps placeholders for
real battlefields + authored enemies. The structural tier does **not** author enemies or scenes.

### WI3 — Graph editor (the core)

A pan-zoom canvas over the world-map skin:
- Add / rename / delete nodes; **drag-to-place** (writes the WI0 layout module).
- Draw / delete **win-edges**; edge order matters (it's the on-map choice order) — expose and let it be
  reordered.
- Per-node: toggle `isHub` / `farmable`, set `offset`, set `chapter`, pick the WI2 placeholder template.
- **Live validation panel** running the substrate §2 checklist, adapted: unique/non-empty/stable ids;
  edges resolve; `startId` exists; every node reachable from `startId`; ≥1 terminal reachable; start node
  has a battle beat; `isHub`/`farmable` nodes have a battle beat; `deployCap` ≤ player slots; layout
  positions distinct enough to render; **and the new rule — `chapter` is monotonic non-decreasing along
  win-edges** (an edge may not lead to an earlier chapter).

### WI4 — Live map preview

Render the authored graph through the **real** `WorldMapBeatView` (it already renders from graph +
choices). This is the anti-drift payoff — what you preview is what ships. Scene/battle preview is
detail-tier, deferred.

### WI5 — Export + round-trip

Codegen the structural graph as type-checked TS. **The correctness test: import `M1_CAMPAIGN_GRAPH` →
edit → export → the round-trip reproduces it** (structure identical, `tsc -b` clean). Draft in
localStorage; export on demand.

**The one real implementation risk to resolve in the audit:** the structural tier edits topology +
capabilities but node content also carries hand-authored **beats and enemy derivation**
(`riverRidgeEnemies()` etc.) it does *not* own. Round-tripping must **not clobber or flatten** that
content. Whether that's a module split (structural graph vs hand-authored beat/enemy content, referenced
by node id) or opaque pass-through of the blocks the tool doesn't edit is the implementer's call — flag
which, and preserve enemy/beat authoring losslessly either way.

---

## Acceptance criteria

- Round-trips `M1_CAMPAIGN_GRAPH` exactly (structure + preserved beat/enemy content; `tsc -b` clean).
- Author a fresh multi-chapter skeleton that is runtime-valid and **walkable in-game** on placeholder
  templates (return travel, hub commerce, and a skirmish all function on an authored node).
- Live preview via the real `WorldMapBeatView` matches what ships.
- Validation catches each invariant violation, including chapter-monotonicity-along-edges.
- `NODE_LAYOUT` lives in its own module; the world map + march render unchanged.
- DEV-gated out of production builds; suite green.

## Out of scope

- **Beat / scene editor** (tier 2), **enemy authoring** (tier 2 — the enemy-depth decision is deferred).
- **Economy bundle assignment** (`firstAvailableAt`, tier 4 — needs balance data; the structural tier
  produces the graph bundles will later key to, nothing more).
- **Battle-TEMPLATE authoring** (maps/terrain/victory — a separate, bigger tool).
- **Engagement queues** (runtime-first), **node disappearance** (monotonic map), **runtime
  progressive-reveal** behavior (the tool authors `chapter` tags; how the runtime reveals nodes by
  progress is a separate runtime concern).

## Files (audit to confirm; over-specified)

- `src/campaign/graph.ts` — add `chapter` to `CampaignNode`; validation counterparts.
- `src/campaign/node.ts` — the authored graph (round-trip target; preserve its beat/enemy content).
- New layout module (WI0 target) — `NODE_LAYOUT` moved here; imported by `WorldMapBeatView`.
- `src/app/interstitial/WorldMapBeatView.tsx` — import layout from the new module; reused for WI4 preview.
- `main.tsx` — dev route registration (`?formation` precedent).
- New: the graph-editor route/components, the codegen exporter, the validation runner (reuse §2 runtime
  counterparts where they exist).
- `src/campaign/{graph,node,sequence,travel,loop}.test.ts` — the pins a refactor must keep green.

## Workflow notes

- **Round-trip first.** Build import + codegen + the M1 round-trip test before the editing UI — it's the
  correctness spine and the fiddliest part; the canvas is bulk on top of it.
- **Audit-first on the content-coexistence question** (WI5 risk) — resolve split-vs-passthrough against the
  real `node.ts` shape and report which.
- Mid-session design questions route through Chris to the planner.

## Watch-fors

- **Lossy round-trip** — if the export doesn't reproduce M1 exactly (esp. the hand-authored enemy
  derivation), the exporter is lossy; that's the primary correctness failure to guard.
- **Codegen fidelity vs the derive helpers** — don't flatten `riverRidgeEnemies()`-style logic into data
  during a structural-only edit; that's detail-tier content the structural tier passes through.
- **Chapter/DAG consistency** — the monotonicity rule is the guard that keeps `chapter` tags from drifting
  out of sync with actual reachability.

## Estimated size

One session, comfortably within the tool's session-sized envelope since this is a slice. Front-loaded by
WI0 (small) + the WI5 round-trip spine (the fiddly correctness work); WI3's canvas editor is the bulk;
WI2/WI4 compose on existing renderers. Audit resolves the one content-coexistence risk.
