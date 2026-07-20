# ADR-0157 — Cartographer: the battle-map authoring tool and the MapSpec generated format

**Session:** S98 (2026-07-20)
**Status:** Accepted
**Brief:** `docs/TABADesign/taba-map-authoring-tool-brief.md`
**Findings:** `docs/TABADesign/taba-map-authoring-findings.md`

## Context

Ch1 needs ~8 more battlefields (plus Ch2/3), and the hand-spec → implementer-build loop that
produced Oskun and Alvera doesn't scale. The brief called for an Atlas-shaped tool: DEV-gated
in-app editor, codegen, byte-identical round-trip, live preview through the real renderer —
audit-first. The audit (run inline; findings doc checked in) established that every shipped map
decomposes into one canonical shape, that the real `BattleRenderer` can mount a units-empty
`GameState`, and that both engine validators are pure and reusable as-is.

## Decisions

### 1. Maps migrated to a generated-shaped canonical format (`MapSpec`)

Chris's call, mirroring the Atlas `node.ts` move: the six registry maps were regenerated as
codegen output — one-time migration verified **data-identical** (deep-equal built `BattleMap`
against the hand-written modules, pre-overwrite) — and byte-identical round-trip is pinned
thereafter (`src/app/cartographer/codegen.test.ts`, `?raw` imports).

`MapSpec` (`src/content/maps/map-format.ts`) = elevation grid + **ordered terrain bands**
(`eq`/`gte` elevation → terrain, fallback `ground`) + **position-keyed terrain overrides** +
per-tile **property tags** + **layer-1 deck list**. This losslessly captures every bespoke
structure the audit found: the universal water table (ADR-0073), Mountain Pass's rock bands
(threshold constants dissolved into band data; its test now pins band-boundary *data*),
Stonebridge's nine position-keyed ramparts (overrides), and Alvera's deck + `bridge_ramp` ramp
property. Each generated module exports its spec as a runtime value, so tool import is lossless
by construction — no Atlas-style reconstruction/classification step. Prose headers moved to
`docs/maps/` (Mountain Pass got a new doc capturing its lost header). Training Field stays
hand-written: it's a test probe, in no registry.

### 2. Deployment-zone registry codegens wholesale

Chris's call. The tool's model carries **every** map's zone configs (sub-zones and caps in full
fidelity — Mountain Pass's split ambush survives) and export re-emits
`src/content/deployment/registry.ts` entirely, with `rect()` detection for rectangular tile sets
and canonical row-major ordering so editor paint order never leaks into bytes.

### 3. Tier 1 shipped; enemy placement (Tier 2) is a fast-follow

Chris's call, mirroring Atlas's structural-tier-first. The canvas mode/brush architecture is the
designed seam for the enemy-placement mode; `enemyKitForLevel(cls, level, catalog)` is confirmed
ready as its kit-filling interface. Not built this session.

### 4. Connectivity is a tool-side advisory, not an engine rule

The engine validator deliberately has no reachability rule (authored-unreachable terrain is
legitimate — Alvera's walls). The brief's "catch disconnected regions" acceptance therefore
lives in the tool as a **warning** (BFS from the player zone, ≤2 elevation step, flags cut-off
enemy-zone tiles) that never blocks export.

### 5. Renderer surface addition

`TERRAIN_COLORS` / `TERRAIN_FALLBACK_COLOR` joined `src/renderer/index.ts` so the tool canvas
paints with the renderer's own fill table (single-source rationale, as with `TEAM_PALETTE`).
The preview mounts the real `BattleRenderer` (DeploymentScreen's units-empty recipe) — no
tool-specific renderer fork, per the brief's anti-drift watch-for.

## Acceptance evidence (S98, browser-verified)

Round-trip byte-identical on all six maps + registry (test-pinned, permanent). A fresh map
("Proving Grounds") was authored **in the tool** — elevation painted, bands deriving terrain
live, rampart overrides, both zones — exported through the real codegen path, wired (battle
template + both registries + quick-battle picker), deployed 5v5, and the battle ran with the CT
queue ticking and the AI acting on it. The scratch wiring was then reverted; the tool and the
round-trip pins are the shipped artifact.

## Consequences

- Hand edits to the six map modules and the deployment registry are legal TS but the next
  Cartographer export overwrites them wholesale (file headers say so).
- New terrain types remain engine work (canEnter × 14 classes + `AUTHORED_TERRAINS` +
  ruleset tags); the tool's picker is fixed to the seven authored terrains.
- Full stacked-cell *editing* stays deferred: v1 displays decks, toggles them, edits deck
  elevation, and round-trips Alvera losslessly — the brief's minimum plus a little.
- The `?cartographer` route is DEV-gated like `?atlas`; no production chunk is emitted.
