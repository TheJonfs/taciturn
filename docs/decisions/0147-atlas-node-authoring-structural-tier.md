# ADR-0147: Atlas node-authoring tool, structural tier — chapter field, node.ts split, codegen round-trip

**Status:** accepted (S90)
**Context:** `docs/TABADesign/taba-node-authoring-structural-tier-brief.md`
(design source: `taba-node-authoring-substrate-notes.md`). The economy
CONTENT pass needs the chapter graphs laid out before bundles can key to
nodes; the layout is provisional and will churn, so drag-to-place with live
preview beats hand-editing coordinates through the churn. This tier authors
the campaign **skeleton** only; beat/scene/enemy and economy-bundle
authoring are later tiers.

## What shipped

The **Atlas** graph editor (`?atlas`, DEV-gated, lazy-loaded so production
builds never emit the chunk): pan-zoom canvas over the world-map idiom with
drag-to-place layout, node/edge editing (win-edge order = map choice order,
reorderable), per-node chapter/offset/isHub/farmable/placeholder-template
authoring, a live validation panel, live preview through the **real**
`WorldMapBeatView`, and export of type-checked codegen. Suite 2773 green;
the M1 round-trip is pinned byte-identical.

## Decisions

### 1. `chapter: number` on `CampaignNode` — required, organizational only

The chapter of first appearance. Drives canvas regions, economy tiering
(Ch1/2/3 equipment lineup), display grouping — **never reachability**,
which stays DAG-driven. Validation holds the two consistent: chapter must
be non-decreasing along win-edges (a win-edge may not lead to an earlier
chapter); loss-edges are exempt (retreat is expressible). All M1 nodes are
chapter 1. Monotonic map: no disappearance field.

### 2. WI5 content-coexistence: module split, not pass-through

The brief's one real implementation risk — the structural tier edits
topology but nodes also carry hand-authored beats/enemy derivation it does
NOT own. Resolution: **split the module**.

- `src/campaign/node-content.ts` (hand-authored, tool-invisible): scenes,
  battle-beat builders, `riverRidgeEnemies()`-style derivation, keyed by
  RAW node-id strings; `CAMPAIGN_RULESET_ID` moved here. Loud-fail
  `contentBeats(id)` at module init catches structural/content id drift.
- `src/campaign/node.ts` (generated-shaped, tool-owned): ids table, nodes
  (with `beats: contentBeats(id)` / `[placeholderBattleBeat(key)]` / `[]`
  references), edges, graph. The Atlas export overwrites it wholesale.

Losslessness is **structural**: the exporter emits references and never
parses or re-emits content, so derive-from-template enemy logic cannot be
flattened. The rejected alternative (opaque TS pass-through) would have
made the exporter a TS parser — exactly the lossy-round-trip failure the
brief warns against.

### 3. Codegen, not JSON+loader (settled in the brief, confirmed here)

The graph stays static TS, type-checked at build, never serialized; saves
keep storing only ids. The round-trip contract: **import the shipped graph
→ export → byte-identical `node.ts` + `node-layout.ts`** (`codegen.test.ts`).
Changing the emitted shape requires regenerating the shipped files in the
same change. Importer classification uses reference equality against
`node-content`/registry values (everything is static module data), failing
loud on non-canonical shapes.

### 4. Layout is authored data: `node-layout.ts`, bounds-derived viewBox

`NODE_LAYOUT` moved from `WorldMapBeatView` to
`src/app/interstitial/node-layout.ts` (generated-shaped, second codegen
output). The view derives its viewBox from layout bounds with the original
640×350 frame as the floor — shipped layout pixel-identical, larger
skeletons expand instead of clipping. `WorldMapBeatView` gained optional
`graph`/`layout` props (runner passes neither) so the Atlas preview renders
the draft through the shipped component.

### 5. Placeholder battle beats keep every skeleton walkable

`placeholderBattleBeat(templateKey)` (campaign layer): a registered
template's map + default enemies + its zones + deployCap 5. Default
template **River Ridge** (Chris's call — it has deployment zones attached;
training-field is probe-only and has none). New enumerable
`BATTLE_TEMPLATE_REGISTRY` (content layer, keys mirror the deployment-zone
registry) backs the picker and the codegen's stable references; an entry
promises its zones resolve — the walkability guarantee, pinned in
`registry.test.ts`. Walkability acceptance (`walkability.test.ts`): a fresh
two-chapter skeleton with zero hand-authored content validates clean,
codegens, and supports start battle, pure-market-town passage, return
travel, and a borrowed-battlefield skirmish.

### 6. Validation: substrate §2 adapted, plus acyclicity

Errors gate Preview/Export; warnings don't. Notables:

- **Chapter monotonicity along win-edges** (the new rule).
- **Forward-DAG acyclicity** added as an error — not in the substrate
  checklist, but `graph.ts` documents the model as a forward DAG and
  chapter monotonicity alone permits same-chapter cycles.
- The brief's WI3 listed "start node has a battle beat", which S88's
  probe-fallback LIFTED as a runtime invariant; reconciled as a
  **warning** (sensible default, not a blocker). Battle-less hubs are
  simply legal (pure market towns).
- `storyBeatId` collisions checked on EFFECTIVE ids (explicit or defaulted
  to node id). The editor preserves `storyBeatId` losslessly but does not
  expose authoring it (engagement queues are runtime-first, deferred).

## Consequences / watch-fors

- **Hand edits to scenes/enemies now belong in `node-content.ts`**;
  `node.ts` is paste-from-tool territory (header says so). Content keyed
  by raw id strings: renaming a node id in Atlas orphans its content entry
  — `contentBeats` throws at module init (fail loud), and the validation
  panel reports `content-missing` before export.
- Export is copy/download from the browser (no repo write access); the
  round-trip test + `tsc -b` vouch after pasting.
- `M1_NODES`/`M1_CAMPAIGN_GRAPH` export names are now historical (the
  graph spans the campaign, not a milestone). Kept to avoid churning ~16
  importers; rename is a cheap cosmetic follow-up if wanted.
- Editor drafts live in localStorage (`taciturn-atlas-draft-v1`),
  disposable by design; a model-shape change bumps the key version.
