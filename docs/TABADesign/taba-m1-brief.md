# TABA M1 — Branching graph + interstitial framework + world map

*The second TABA milestone (decomposition §8). Goal: make the campaign **navigable** — generalize
M0's linear A→B into a forward-branching graph the player routes through at a **world map**, and
build the **interstitial framework** (the between-node phase) that the map plugs into now and story
scenes (M1.5), rewards, and shops plug into later. Builds entirely on M0's shipped spine
(`src/campaign/`, ADR-0133) — the graph, loop, and persistence already exist; M1 generalizes them.*

**Scope philosophy:** M1 builds *slots*, not content. The map is a lightweight Claude-authored SVG
(structure, not art); the branching graph is small but exercises real routing; the interstitial
framework is the forward-paying investment (it's why this milestone is worth more than "make the
graph branch"). **Explicitly deferred:** the roster-builder (→ M3, where acquisition gives it the
economy context that determines its shape — see the test-roster note instead), story-scenes (→ M1.5,
plugging into the framework this milestone builds), progression (→ M2).

## Pre-implementation plan — light seam-audit FIRST (read before designing)

M1 designs on top of M0 code the planner hasn't seen. **Before building, audit the M0 seams and
report a short findings paragraph; adjust the plan below if the shapes differ from these
assumptions:**
1. **The node-graph model** — how does M0 represent the linear A→B graph? (A list/array? Node ids?
   Where authored?) The generalization target is *nodes + directed edges*; confirm what's there.
2. **The loop's extension points** — where does M0's loop transition between nodes, and where would a
   *between-node phase* (the interstitial) naturally insert?
3. **Persistence of graph position** — how does M0 store "where you are"? (A linear index? A node
   id?) M1 needs a node-id-based position (the natural branching generalization). Confirm + flag if
   it's a linear index that needs widening.
4. **The existing victory/defeat/result screens** — these become *beats* in the interstitial
   framework (Chunk 2); confirm their current shape so they refactor in rather than get rebuilt.

This is "show me the recent seams," not M0's deep model-discovery — a paragraph, not a session.

## Proposed design + decision points (confirm/adjust in review)

- **D1 — Branch drivers (the core call).** *Proposed:* edges are **outcome-aware in the model**, but
  M1 *content* uses **player-choice-on-win** (winning a node exposes its out-edges; the player picks
  the next node at the map) + **retry-on-loss** (M0 behavior — loss resumes the pre-node autosave and
  re-fights). Loss-routing (lose → a different node) is *expressible in the model* but **unauthored in
  M1**. → Confirm, or do you want authored loss-routing content in M1 too?
- **D2 — Topology.** *Proposed:* a **forward DAG** for M1 — no cycles, no revisiting, no free-roam.
  You move forward through choices to a terminal node. (Revisiting / hub-navigation / backtracking is
  a later, richer thing.) → Confirm, or want free-navigation now?
- **D3 — Interstitial framework shape (the table-setting call).** *Proposed:* an **extensible
  beat-sequence** — a node's resolution plays an ordered list of typed interstitial *beats*, then
  routes to the next node. M1 ships two beat types (**result-summary**, **world-map-choice**); M1.5
  adds a **story-scene** beat type that authors drop into any node's sequence. This is the
  forward-paying shape (story/rewards/shops all become beat types). → Confirm the extensible sequence,
  or keep M1 to a simpler fixed result→map and generalize later?
- *Recommendations (easily adjusted, not flagged as forks):* the map is a **choose-next** screen
  (shows the graph + your position + selectable available nodes), not a free-roam hub. M1 **nodes are
  battles**; keep a node's battle *loosely optional* in the model so story-only nodes are possible at
  M1.5 without a rework (don't hardcode "every node has a battle"). The model **supports optional
  side-nodes** (a branch you can take or skip that rejoins); M1's content *may* include one to
  exercise it (cheap, and proves skip/rejoin routing) — your call whether to author one.

## Implementation work — three chunks

### Chunk 1 — Graph generalization + routing + persistence (the testable core)
- Generalize the node-graph to **nodes + directed edges**, each edge outcome-aware (D1). Author M1's
  small graph: a forward DAG with **at least one player-choice fork** (win → choose among 2+ next
  nodes) reaching a terminal node. (Optionally one skippable side-node per D3-recs.)
- **Routing logic:** given a resolved node + outcome, compute the available next nodes (the won node's
  win-edges). Pure and testable.
- **Persistence:** store graph position as a **node id** (+ the roster), generalizing M0's position
  (widen it if M0 used a linear index). Save/resume must restore mid-graph position. Round-trips
  cleanly (the M0 plain-serializable container discipline holds).
- *Independently testable:* the graph model, the routing computation, the position round-trip.

### Chunk 2 — The interstitial framework (the forward-paying investment)
- A **between-node phase** in the campaign loop that runs an **ordered beat-sequence** after a node
  resolves, then proceeds to routing/next-node. Each beat is a typed component + its data; the runner
  advances through them.
- Ship **two beat types:** `result-summary` (refactor M0's existing victory/defeat/result screen into
  a beat — don't rebuild) and `world-map-choice` (Chunk 3).
- Design the beat-sequence so a node can specify its beats (forward-compat for M1.5 story beats at
  authored nodes). Keep the runner ignorant of specific beat types (open set).
- *Verify:* the sequence runs result → map between nodes; the framework is the slot M1.5 plugs into.

### Chunk 3 — The world map (the choose-next screen)
- A **lightweight Claude-authored SVG** map: render the graph (nodes as points, edges as connections),
  mark the current position, highlight + make selectable the **available next nodes** (the win-edges).
  Selecting one routes the loop to that node.
- **Placeholder fidelity is the point** — stylized SVG, no art pipeline, structure over polish (like
  the boilerplate-story ethos). Easy to reskin later.
- *Verify by hand:* the map shows position + choices, selection launches the right node, a multi-edge
  fork actually offers a choice.

## Default test roster — discuss with Chris (collaboration prompt, not a build task)

M0's test roster was implementer-chosen (8 units). For M1 playthroughs **Chris wants to pick the
units from the existing class lineup** rather than inherit that default. **Before Chris's playthrough,
have a quick exchange with him on the roster composition** (which classes, what levels) and author it
into the roster config (`roster.ts` / `M0_BASELINE_LEVEL`). Small QoL for playtesting — *not* the
M3 roster-builder, just a hand-picked default Chris is happy piloting. (If a fork-and-side-node graph
wants more than K deployable per node, size the roster accordingly.)

## Acceptance criteria

- A **branching playthrough**: win a node → the interstitial runs (result → map) → the map offers the
  won node's next options → pick one → fight it → … → reach a terminal node → campaign complete.
- The **player-choice fork** genuinely offers ≥2 next nodes and routes to the chosen one.
- **Loss = retry** still works (resume the pre-node save and re-fight), unchanged from M0.
- The **interstitial framework** runs a typed beat-sequence; the M0 result screen is now a beat (not a
  parallel path); a second beat type (map) composes in.
- **Persistence** saves/restores **mid-graph** position (node id), survives reload + Resume.
- Mage War unaffected; **no engine changes** expected (flag immediately if M1 seems to need one).
- Suite green; `tsc -b` + `vite build` clean; ADR for the branching graph + interstitial framework;
  decomposition §8 marks M1 shipped.

## Out of scope

- **Roster-builder** — M3 (acquisition gives it its shape). The test-roster note above is the interim.
- **Story-scenes** — M1.5 (the beat type plugs into this milestone's framework).
- **Authored loss-routing content** — model-expressible (D1), unauthored in M1.
- **Free-roam / revisiting / hub-navigation** — M1 is a forward DAG (D2).
- **Heterogeneous (story-only/rest/shop) nodes** — M1 nodes are battles; keep the model loosely
  battle-optional for forward-compat, but don't build non-battle node types.
- **Progression / economy** — M2 / M3. **Map art** — placeholder SVG only.

## Files (hedged — the seam-audit confirms placement)

Within `src/campaign/`: the graph model generalization + routing, the interstitial-phase framework +
beat runner + the two beat types, the world-map component (+ SVG), the persistence widening. The
result/victory/defeat screens refactor into beats. ADR. Vitest for the pure core (graph, routing,
position round-trip) + framework sequencing. **No engine changes expected.**

## Watch-fors

- **Keep the graph model forward-compatible** — outcome-aware edges + loosely-optional battle per
  node, even though M1 authors only win-edges + battle nodes. The model is the expensive part to
  rework; the content is cheap.
- **The interstitial framework must stay an open set** — the beat runner shouldn't know about specific
  beat types, so M1.5's story beat (and later rewards/shops) plug in without touching the runner.
- **Persistence is node-id-based**, not a linear index — branching position can't be an integer offset.
- **Refactor the result screen into a beat, don't fork it** — one interstitial path, not two.
- **Map stays placeholder** — SVG structure, no art pipeline; don't gold-plate the visual.
- **Don't build the roster-builder** — the test-roster discussion is the entire interim scope.

## Estimated size

Substantial — three chunks (graph + framework + map), but each is contained and M0 already built the
spine they extend. Chunk 1 is the testable core; Chunks 2–3 are framework + UI (more hand-verify).
The interstitial framework is the deliberate over-investment (it's table-setting for M1.5 and M5).
Likely **one session, possibly spilling** — lighter than M0 (no model-discovery, no engine risk),
heavier than a pure content session. M1.5 (story-scenes) follows as a separate, smaller milestone
plugging into the framework this one builds.
