## ADR-0135: TABA M1.5 — battle-as-beat (the node-sequence loop generalization)

**Status:** Accepted
**Date:** 2026-07-01

## Context

M1 (ADR-0134) shipped a **fixed pipeline**: each node ran formation → deployment
→ battle → a post-battle interstitial. Beats ran **only post-battle** and were
**outcome-built** by `buildInterstitial`, not authored per node; `requireBattle`
asserted every node fights. FFT-style story, though, plays **before** a battle
(dialogue → fight), **after** it, or **standalone** (a scene, no fight) — none of
which had a slot.

M1.5 — "story-scenes" (decomposition §8) — generalizes the loop so a node owns
an **ordered `beats: NodeBeat[]`** where a **battle is one beat-type among
others**. The motivating cost/benefit (Chris's call): battle-as-beat makes future
progressions pure *authoring* rather than loop-structure work — consecutive
battles at one node become `[battle, story, battle]`; choice-driven story becomes
a routing beat later — so we generalize once, here, instead of adding a third
structural change the next time content wants a beat somewhere new.

### The seam-audit (the brief gated Chunk 1 on it) inverted two expectations

The M1.5 brief feared two seams. The audit found the opposite of what it braced
for:

- **Formation/deployment coupling — expected heaviest; came back light.**
  `FormationScreen` / `DeploymentScreen` already take a battle config as props
  and know nothing about the loop. The only entanglement was that `CampaignApp`
  read a *single* `battle = requireBattle(node)` and closed over it. Unwinding to
  per-battle-beat = thread *the current battle beat's* `NodeBattle` instead.
- **Persistence (v3 mid-sequence save) — expected necessary; came back
  unexercised.** Persisting a beat-cursor and a *resolved battle mid-node* only
  matters for a `[battle, story, battle]` node, and **M1.5 authors none**
  (consecutive battles are the future case). M1.5's only real save points —
  node-entry (`in_progress`) and post-win (`awaiting_route`) — are already
  covered by the M1 v2 save.

So neither seam triggered the brief's fallback (retreat to a narrow "fixed
pre-battle slot"); battle-as-beat is clean and worth doing. But the persistence
finding reshaped the work: **Chunk 2's v3 widening was dropped.** Confirmed with
Chris in review, along with the brief's D1–D3.

## Decisions

### 1. A node owns an ordered `beats: NodeBeat[]`; battle is a peer beat

`src/campaign/sequence.ts` (new) defines the beat model: `StorySceneBeat` +
`BattleBeat` = `NodeBeat`, plus `StoryScene` / `DialogueLine`. `NodeBattle` moves
here from `graph.ts` (so `graph.ts` imports the beat types without a cycle:
sequence → engine; graph → sequence). `CampaignNode.battle?` becomes
`beats: readonly NodeBeat[]`. **`requireBattle` is deleted** — a node with no
battle beat is a standalone story node; the graph machinery is entirely
beat-agnostic, only the driver walks the sequence. The cursor helpers
(`takeStoryRun`, `firstBattleBeat`, `hasBattleAtOrAfter`, `isStandalone`) are
pure and unit-tested (`sequence.test.ts` — the sequence progression, incl. the
3+-beat and battle-less cases).

### 2. The runner stays an open set; battle vs presentational is the one structural split

The two beat KINDS differ by nature: `battle` is the **engine-launching
structural beat** (the driver runs formation/deployment/battle for its own
`NodeBattle`); `story-scene` (and the driver-injected `result-summary` /
`world-map-choice`) are **presentational beats** the generic
`InterstitialRunner` dispatches by `beat.type` and never switches on. Adding
`story-scene` was a descriptor variant + a renderer (`StorySceneBeatView`,
click-through dialogue reusing the class-portrait pipeline) + a registry entry —
**the runner was untouched** (watch-for held). Future rewards/shops are the same
move. The runner's first React test (`InterstitialRunner.test.tsx`) walks a 3-beat
mixed sequence and asserts generic advance + the world-map route output.

### 3. `resolveWin` splits into per-battle apply-back + per-node resolution

`loop.ts`: `applyBattleBeatWin` (apply-back, once per winning battle beat — phase
untouched) + `resolveNode` (phase: terminal → `won`, else `awaiting_route`, once
per node; battle-agnostic so a standalone node resolves too). `battleWasWon` now
takes the battle beat's `playerTeam`, not the node. `bootstrapRosterVitals`
probes off the start node's `firstBattleBeat` (fail-loud if a start node has no
battle — M1.5's does). The **result-summary is outcome-built and auto-inserted**
after a battle beat (D2 hybrid): `buildInterstitial` is replaced by
`buildResultSummaryBeat` + `buildRouteChoiceBeat`, which the driver composes into
presentational runs.

### 4. `CampaignApp` becomes a beat-sequence walker

The driver holds a single `Screen` discriminated state (run | formation |
deployment | battle) + a beat cursor. It plays a maximal run of presentational
beats through the runner, and at a battle beat runs the sub-flow for *that beat's*
`NodeBattle`, resuming after. On a win it applies back; on the node's **last**
battle it resolves + saves `awaiting_route`; a loss shows the result and retries
that battle beat (state unchanged). D1 (formation per battle-beat) is the general
shape and — for M1.5's single-battle nodes — behaviorally identical to per-node.

### 5. Persistence stays node-granular (no v3); routing stays edge-driven (D3)

The save schema is **unchanged (v2)**. The only checkpoints are node-entry
(saved by the prior route) and `awaiting_route` (saved right after a node's last
battle wins — preserves M1's "never re-fight a won battle"). A reload
mid-sequence (e.g. during a post-battle scene) resumes at the world map. In-scene
player choices / branch-from-beat are **deferred** (D3): routing stays
outcome/edge-driven; the beat model *could* emit a routing result later, but M1.5
authors none.

## Content

A boilerplate storyline proving all three placements (placeholder Ivalician
prose, roster speakers with real portraits): **River Ridge** `[story(intro),
battle]` (pre-battle), **Stonebridge** `[battle, story(aftermath)]` (post-battle),
and a new **standalone story node "The Crossing"** `[story]` on the south route
(Marshmoor → The Crossing → The Return). Graph is otherwise M1's (fork, skippable
side-node, convergent terminal).

## Consequences

- Future between-battle content (rewards, shops, more scenes, consecutive
  battles) is authoring against the sequence, not loop surgery. **No engine
  changes** (M1.5 is all shell/loop). Mage War unaffected.
- **The deferred multi-battle-node machinery** (a `[battle, story, battle]` node)
  is expressible in the *model* but not wired in the *driver/save*: mid-node
  resume would re-fight, since only node-entry + `awaiting_route` persist. When
  consecutive battles are actually authored, the driver already loops over
  battle beats; the save gains a beat-cursor + resolved-battle persistence
  (the v3 the audit deferred). Flagged, not built.
- **Verified in-browser** (S79): pre-battle scene → formation; the standalone
  node → world map; the new 6-node map + edge highlighting; routing → next
  node's formation + autosave. The battle → result-summary → aftermath path is
  covered by pure tests + the runner test; a full deploy→fight playthrough of it
  is left to hand-verification (Pixi deployment isn't script-drivable) — the
  battle sub-flow itself is unchanged M1 machinery.
