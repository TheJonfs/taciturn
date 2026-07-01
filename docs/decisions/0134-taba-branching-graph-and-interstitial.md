## ADR-0134: TABA M1 — the branching node-graph + the interstitial beat framework

**Status:** Accepted
**Date:** 2026-06-30

## Context

M0 (ADR-0133) shipped the campaign spine as a **linear A→B** graph: a flat
`ReadonlyArray<CampaignNode>` walked by an integer `nodeIndex`, with a hardcoded
win→advance→next-formation transition and terminal victory/defeat screens. M1 —
"the loop" (decomposition §8) — makes the campaign **navigable**: a
forward-branching graph the player routes through at a **world map**, plus the
**interstitial framework** (the between-node phase) that the map plugs into now
and story-scenes (M1.5), rewards, and shops plug into later.

A light seam-audit of the M0 code confirmed the generalization is additive: nodes
already carried stable string ids (clean to key a graph on), `advanceOnWin` was
pure (easy to split), and the win→next-formation transition had an empty seam
where a between-node phase inserts. Two shapes diverged from the M1 brief's
assumptions and are recorded below (§4, §5). **No engine changes** — M1 is shell
code on the unchanged pure battle, as M0 predicted.

Decisions D1–D3 were confirmed with Chris in review (player-choice-on-win +
retry-on-loss; a forward DAG; an extensible beat-sequence), plus authoring one
skippable side-node.

## Decisions

### 1. The graph is nodes + outcome-aware directed edges; a node's win-edges ARE the player's map choices

`src/campaign/graph.ts` replaces M0's array with `CampaignGraph = { startId,
nodes, edges }`, where each `CampaignEdge` carries `on: 'win' | 'loss'`. The
routing rule is deliberately uniform — **winning a node exposes its win-edges as
the choices the player picks from at the world map**:

- linear = one win-edge; a **fork** = 2+ win-edges; a **terminal** node = zero.
- a **skippable side-node** needs no special machinery: the node before it has
  win-edges to *both* the side-node and the rejoin target, and the side-node has
  a win-edge to the rejoin target. "Skip" is just picking the rejoin edge.

Routing is a handful of pure functions (`winChoices`, `isTerminal`, `isWinChoice`,
`nextNodes`) — independently testable, no special-casing per shape. Loss-edges are
**expressible but unauthored** in M1 (D1): loss = retry the same node, handled in
the driver exactly as M0. The model doesn't privilege win over loss; M1 content
just authors only win-edges.

**Why edges-are-choices over a separate "choice" abstraction:** it collapses fork,
skippable-side-node, and linear-chain into one concept (out-edges), so the map, the
routing, and the persistence all speak the same small vocabulary. The expensive
part to rework is the model; this keeps it minimal while foreclosing nothing.

### 2. Battle is loosely optional on a node (forward-compat for M1.5 story-only nodes)

A node's battle fields live in an optional `battle?: NodeBattle` sub-object, not
inlined on the node. M1 authors a battle on **every** node (asserted by
`requireBattle`, which fails loud if a battle path hits a battle-less node), but
the graph machinery is entirely battle-agnostic — only the driver reads
`node.battle`. This is the brief's watch-for ("don't hardcode 'every node has a
battle'"): M1.5 story-only nodes drop in by omitting `battle`, with no graph
rework. This is a *shape* hedge, not machinery — no story-node code is built.

### 3. Position is a node id; the save format is v2

`CampaignState.nodeIndex: number` → `currentNodeId: string`. A branch can't be an
integer offset. `CAMPAIGN_SCHEMA_VERSION` bumps 1→2; the deserializer validates
`currentNodeId` as a non-empty string. Per M0's fail-loud discipline, **old v1
saves hard-fail to load** rather than silently migrate — acceptable for the
dev-only localStorage slot, and deliberate (a wrong version is rejected, not
guessed). The autosave lands at each *node-entry* checkpoint (start, and after
each map-choice route), so it doubles as the retry checkpoint; a reload *during*
an interstitial re-enters the just-won node (the known M0 "save = node entry"
simplification, carried forward).

### 4. The win transition splits into `resolveWin` + `routeToNode`

M0's single `advanceOnWin` (apply-back + `nodeIndex++` + phase) couldn't branch,
because the next node is now a *choice*, not the next index. M1 splits it:

- `resolveWin` — applies the battle result back to the roster (heal, mark lost)
  and sets `phase: 'won'` iff the cleared node is terminal. **Position does not
  move** — it holds at the won node while its interstitial runs.
- `routeToNode` — the player's map pick; validates the target is a legal
  win-choice (fail loud otherwise) and advances `currentNodeId`.

### 5. The interstitial is an ordered, open-set beat-sequence; the result screen is ONE beat with variants

After a node resolves, the campaign runs an ordered `InterstitialBeat[]` before
routing. The **runner is ignorant of specific beat types** — it dispatches through
a `Record<beat.type, renderer>` registry and never switches on the type — so
M1.5's story-scene beat (and later rewards/shops) plug in by adding a descriptor
variant + a renderer + a registry entry, never by editing the runner (the brief's
"keep the set open" watch-for). The pure descriptors + builder live in
`src/campaign/interstitial.ts`; the React runner + renderers in
`src/app/interstitial/`.

M1 ships two beat types:

- `result-summary` — **one beat type with win / loss / campaign-complete
  variants**, so victory, defeat, and the between-node result are a single path,
  not three forked screens (the brief's "don't fork the result screen"). Its
  per-deployed-unit lines surface survival / KO / permadeath.
- `world-map-choice` — the SVG choose-next screen (Chunk 3); present only on a
  non-terminal win. Its advance carries the chosen next-node id.

Sequences: non-terminal win → `[result-summary(win), world-map-choice]`; terminal
win → `[result-summary(campaignComplete)]` (the victory screen); loss →
`[result-summary(loss)]` (advance = retry). **This is a divergence from the brief's
"refactor the existing result screen" framing (§ below): M0 had no between-node
result screen** — a mid-graph win went straight to the next formation. The
between-node summary is therefore net-new, though it reuses the M0 end-screen
presentation; the terminal victory + retry-defeat screens fold *in* as variants of
the one beat, so there is exactly one post-battle path.

### 6. The world map reads the static graph; the beat carries only position + choices

`WorldMapBeatView` imports the authored `M1_CAMPAIGN_GRAPH` for topology + a
hand-authored node layout, and renders a lightweight **placeholder SVG** (nodes as
points, win-edges as connections). The beat descriptor carries only `fromNodeId`
("you are here") + the selectable `choices`, so the generic runner stays
graph-agnostic. Placeholder fidelity is the point — stylized structure, no art
pipeline, easy to reskin.

## The authored M1 graph

River Ridge (start) → **fork**: Stonebridge (north) | Marshmoor (south).
Stonebridge → **skippable side-node**: Mountain Pass | skip straight to the
finale. Marshmoor and Mountain Pass both rejoin **The Return** (terminal — a
"there and back again" finale that revisits the River Ridge battlefield). Five
battle nodes over four maps (the finale reuses River Ridge — one reuse is
unavoidable and the return framing makes it deliberate). This exercises a genuine
≥2-way fork, skip/take/rejoin routing, and a convergent terminal.

## Consequences

- **Forward-compatible where it's expensive:** outcome-aware edges + optional
  per-node battle + an open beat set mean M1.5 (story beats), M2 (progression),
  and later loss-routing are additive, not reworks. The content M1 authors is
  cheap; the model it authors on is the load-bearing part.
- **One post-battle path**, not forked victory/defeat/result screens.
- **Old M0 saves don't resume** (v1→v2 break) — start a new campaign.
- **Hand-verify owed (Chris):** the full win→result→map→branch→terminal
  playthrough, loss→retry, and mid-graph save/resume. Tool-verified to battle
  launch (boot, New Campaign → v2 autosave at the start node, Formation, the
  reused deployment screen) with no new console errors.
