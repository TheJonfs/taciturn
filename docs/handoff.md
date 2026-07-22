# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S99 — M4 enemy generation shipped (2026-07-22)

**The generator landed whole** (ADR-0160): `composeEnemyBuild` in
`enemy-generation.ts` is THE composer — skirmishes, Cartographer auto/budget,
and story-lineup defaults all resolve through it. Kit bought toward a
POPULATED loadout (R/S/M filled from the free-in-class native passives;
budget spillover past a FINISHED primary tree buys into a seeded pair class
≤ the primary's tier and wields its set as Second Action), gear via
`rankItemsForUnit` over the level-banded pool (L1–12/13–24/25+ per
`ENEMY_GEAR_BANDS`, unclamped, per-slot 10%→100% ramp; NO uniques, NO
exotics — both sweep-pinned), archetype-cast skirmishes with per-win seed
advance (`skirmish_wins:<nodeId>` flag; reload never rerolls). Suite 3081,
`tsc -b` clean. Guide-changelog carries the player-facing entry; the
Cartographer guide's kit/equipment sections updated.

### For Chris — review gates from this session (his answers pre-authorized the shape)

- **Exotic flag votes** (equipment-pool.ts `exotic` entries): flagged =
  Prism Wand, Scouring Wand, Healer's Staff, Epee, Palliative Pike, Moon
  Robe, Terra Robe. Deliberately NOT flagged (floor-valued common effects):
  Gaia's Axe, Star/Void Robe, variance weapons (Dagger/Estoc/etc.),
  cast-speed items (Trident, Mithril Chain), Spiked Maul, Wand of Expanse,
  Channeler's Hat, Abjurer's Codex, Talisman of Endurance. Flip any entry
  with one word — tests read the flag, not a list.
- **Ch1 archetypes** (archetypes.ts): Ordallian Patrol / Bandits /
  Hedge-Mages / Poachers + the node mapping + weights are a DRAFT for
  discussion before locking. Ch2/Ch3 registries are deliberately absent —
  author them with those chapters (flagged per Chris's answer #4).
- **Two composer calls I made beyond the brief, flag-not-ask tier:**
  (1) pair class rolls only from classes AT OR BELOW the primary's tier
  (legibility guard — no Tier-3 secondaries on grunts); (2) native-class
  R/S/M passives equip FREE at any level — that's the existing player rule
  (export tax only), so an L1 enemy fields its class passives. Parity, but
  it does mean the loadout half of difficulty isn't budget-gated. Both in
  ADR-0160; revisit in calibration if L1–3 feels hot.

### Playtest before the calibration pass

- **This is the global difficulty increase the brief promised.** Every
  generated enemy (skirmishes AND non-hand-authored story lineups) now has
  passives, secondaries at high level, and real gear. Do NOT pre-tune
  offsets or `ENEMY_JP_PER_LEVEL` — playtest, then run the calibration
  pass (offset curve + dial) against the REAL enemies (brief's ship order;
  bands + ramp dials are in economy-config as placeholders).
- Zelmonia Hills: Oscar/Tina keep their authored overrides, but any half
  they did NOT override (e.g. R/S/M fill against their authored gear) got
  the new defaults — worth an eyes-on.
- Carried from S98: RE-TRY the Zelmonia Hills skirmish post-fix (crash
  fixed + regression-pinned; now also archetype-cast), and the full-party
  no-debug story fight there (heights vs lowground, 6-enemy party).

### Noticed, not acted on

- One unnamed test failed in the very first baseline run and never
  reproduced (two subsequent full runs green). If a flake resurfaces,
  capture the name before it vanishes.
- The Cartographer's auto/budget kit list now shows composer spillover; the
  explicit-mode picker widens to any class present in the effective kit.
  Driving the tool via the browser pane still needs the S98 notes
  (`window.confirm` stub, sparse synthetic drags, hard-reload after HMR).
- AtlasCanvas still has the S98 pointer-offset latent bug (Cartographer's
  was fixed; the spawned-task chip may still be pending).

### Carried (unchanged, low-priority)

- S97 playtest-with-eyes-on: bridge lift diagonal (ADR-0156 dials),
  unit-over-unit stacked reading, AoE dual-highlight over Alvera's bridge,
  stale stack chip on keyboard-driven changes.
- ADR-0155 deferred edges (layerScope, stacked-cell deploy convention,
  charged tile-cast on destroyed deck); pit-the-bridge vs enemy
  Terraformers; ramming your own span.
- Economy: cost TUNING (D-econ-6) + Tailored Outfit.
- Latent ADR-0152 joint-planner null path; `WorldMapBeatView` march-state
  reset rider; win-edge dedupe in `addEdge`; engagement-queue
  shipped-content pin when a Ch2 camp lands; Atlas beat-editor tier before
  M5 volume; S85/S87 gear watch list; kit-seeding tier-threshold watch; JP
  spillover seam; "Level Up!" banner polish; "99 cap" guide fiction;
  pre-S95 saves badge-once self-heal (documented, accepted).
