# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S98 — Cartographer shipped, BOTH tiers (2026-07-20)

**FIRST REAL AUTHORING (2026-07-22): Zelmonia Hills shipped through the
whole pipeline** — Chris authored map/zones/6-enemy lineup in-tool (incl.
Tier 3 overridden generics Oscar + Tina and a 6th-slot Monk; 6v5 confirmed
plain data), downloaded the three exports, and the wiring landed:
reload entries, round-trip corpus (first shipped-lineup byte pin),
registries, MAP_OPTIONS, node-content swap (withLeadEnemySlot kept for the
deathProtected stamp; theoConditions untouched), plus
zelmonia-hills-node.test.ts booting the folded battle. The
authored-enemy.test escort pin was updated from the superseded
lineup(4,4) stub — expect one such stale-pin per stand-in map replaced
(Mount Eska, Grek Forest, etc. still fight on River Ridge). PLAYTEST the
node: heights-vs-lowground with a 6-unit enemy party is a real difficulty
change; watch the Theo retreat still firing (test-pinned but feel counts).

**Tier 3 landed too (ADR-0159, 2026-07-21):** the per-enemy ✎ override
editor — three-mode kit (auto/budget/explicit picks with costs; implied JP
always shown — enemies have no wallet, the kit IS the earned JP), full
loadout (secondary set + R/S/M on the real capacity budget), full gear
catalog with † on pool-managed items, name/Brave/Faith/gender riders.
`composeLineupEnemyDraft` is the single composer the fold, the editor echo,
and validation share; restricted signature components stay hand-authored.
Guide §3 (unit mode) + §7 updated. Named minibosses are now fully
tool-authorable; portraits/death-protection remain node-content riders.

**Tier 2 landed same-session (ADR-0158):** the unit mode — player staging +
guest markers + enemy slots (class + level, kits framework-framed via the
shared `generatedEnemyUnit` constructor extracted from the skirmish stub),
generated `<key>-battle.ts` lineup modules (compiled fixture round-trip pin),
`enemiesFromLineup` as the node-content consumer, preview running the real
fold (authored classes as real sprites). The guide's §5b/5c now describe the
lineup flow; §7 has the fine print (river_ridge reserved; per-enemy kit
override deferred). The "enemy tier fast-follows" line below is superseded.

The whole map-authoring Tier 1 landed (ADR-0157): the six shipped maps +
deployment registry migrated to the generated `MapSpec` format (data-identical
verified pre-overwrite; byte-identical round-trip pinned by
`src/app/cartographer/codegen.test.ts`), and the `?cartographer` DEV editor —
paint elevation (bands derive terrain live), terrain overrides, properties,
zones with sub-zones/caps, deck toggles; engine-validator gating + a
connectivity *warning*; real-`BattleRenderer` preview; Atlas-style export
overlay. Acceptance proven end-to-end in-browser: a fresh map authored in the
tool, exported through the real codegen, wired, deployed, and fought on (AI
acting, CT ticking). The scratch "Proving Grounds" wiring was reverted after
proof — recreate any time via the tool. Suite 3025, `tsc -b` clean.

### For Chris — first real authoring session

- **Read `docs/cartographer-guide.md`** (S98 cont.) — the full user's guide:
  modify-existing and author-new workflows through wiring a fresh map to a
  Ch1 story node. Linked from the CLAUDE.md context table.
- **Pointer-to-tile offset FIXED** (S98 cont., commit `0725546`): the canvas
  mapped clicks proportionally over the element, ignoring SVG letterboxing —
  off by whole tiles toward the left/right edges (Chris's report). Now uses
  the SVG screen CTM; verified far-left/far-right clicks land exactly.
  **AtlasCanvas has the same latent bug** — flagged as a spawned task chip;
  port the same fix (matters for node drag precision into node-layout.ts).
- **Open `?cartographer` in dev.** Pick a shipped map or "+ New map…". Export
  gives you two files to paste over (`src/content/maps/<slug>.ts` +
  `src/content/deployment/registry.ts`); `tsc` + the round-trip test vouch. For
  a NEW map to be *fightable*, also add a battle template + `BATTLE_TEMPLATE_
  REGISTRY` entry (same key) — the export overlay reminds you.
- **Hand edits to the six map modules / the zone registry are overwritten
  wholesale** by the next export (file headers say so). Prose lives in
  `docs/maps/` now — Mountain Pass got a new doc holding its old header prose.
- **Deck editing is minimal by design** (brief's deferral): toggle-deck brush +
  deck elevation via the Inspect-mode tile readout. Full bridge authoring
  (multi-span chains, ramp placement guidance) is the deferred tier — the
  `bridge_ramp` property brush exists, but the art-chain conventions from S97
  are on the author to follow for now.
- **Tier 2 (enemy placement) is the agreed fast-follow** (Chris's call,
  ADR-0157): a second canvas mode placing class+level+position+facing, kits
  auto-filled via `enemyKitForLevel`. The brush/mode architecture is the seam.

### Noticed, not acted on

- The tool's `window.confirm` guards (map switch / reset) block automated
  browsers — stub `window.confirm = () => true` when driving it via the
  preview pane. Human use unaffected.
- Browser-pane synthetic drags sample sparsely, so drag-painting via
  automation skips tiles (real mouse drags are fine — the canvas applies per
  pointermove). Also re-confirmed from S97: dispatch-then-read must be
  separate `javascript_exec` calls (React flush), and a page left open across
  `main.tsx` HMR edits accumulates duplicate React roots — hard-reload before
  driving UI flows.
- Deployment-zone painting on the tool canvas removes a tile from any other
  zone (no-overlap by construction); the engine validator double-checks on
  export anyway.

### Carried from S97 (playtest-with-eyes-on, still pending)

- **Bridge lift is DIAGONAL (up-left), not straight-up** — judge in playtest
  (ADR-0156; `DECK_LIFT_*` constants tunable).
- **Unit-over-unit stacked reading** pre-accepted pending a look; **AoE
  dual-highlight** over the bridge and cross-layer targeting feel never
  browser-exercised — first Worldcraft/AoE playtest over Alvera's bridge
  should look.
- **Stack chip lingers on stale hover** after keyboard-driven state changes;
  cosmetic.

### Carried from earlier (still open, low-priority)

- ADR-0155 deferred edges: `layerScope` (needs a consumer), deployment zones
  exclude stacked cells by convention, charged tile-cast on a destroyed deck.
- Pit-the-bridge vs enemy Terraformers; ramming your own span from below is
  legal — watch feel.
- Economy: cost TUNING pass (D-econ-6) + Tailored Outfit; then M4 authoring
  proper (real maps now unblocked by Cartographer; lineups via
  `generateSkirmishParty`; dialogue — M4/M5).
- Enemy-kit dial (ENEMY_JP_PER_LEVEL = 100) — measure in playtest; Theo kit
  placeholder.
- Latent (ADR-0152): joint planner fail-hard-null path unreachable now.
- `WorldMapBeatView` march-state reset rider; win-edge dedupe in `addEdge`;
  engagement-queue shipped-content pin when a camp lands (Ch2); Atlas
  beat-editor tier before M5 volume.
- S85/S87 gear watch list; kit-seeding tier-threshold watch; JP spillover
  seam; "Level Up!" banner polish; "99 cap" guide fiction.
- Pre-S95 saves badge-once self-heal (documented, accepted).
