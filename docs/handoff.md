# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S70 — Map 4 + split deployment + zone-registry extraction (2026-06-19)

Shipped on main across three checkpointed chunks. **ADR-0118. 1943 → 1985 tests;
tsc + vite build clean.** Browser-verified end-to-end (Mountain Pass loads, Blue
victim zone tints in the NW valley, Red AI ambusher deploys 3 SW / 2 NE honoring
caps, no console errors).

1. **Extraction + registry + combiner** (`fec6b0e`). Deployment zones left the
   `Tile.deploymentZone` field and now live in `content/deployment/registry.ts`,
   paired with terrain by `assembleBattlefield`. Type + accessors + validation in
   `engine/{types,map}/deployment-zone.ts`. `validateMap` is terrain-only;
   zone-coverage moved to `validateDeploymentZones`. Per Chris's plan-review call:
   threaded the config through all four readers and dropped the tile field
   (single source of truth), not a stamped projection. Three existing maps migrated
   1:1, deploy identically.
2. **Mountain Pass + split config** (`6cce2b5`). 16×16 pass; `mountain_pass`
   registry config — Blue victim (1 NW-valley sub-zone, uncapped); Red ambusher
   (SW massif cap 3 + NE edge cap 2). Restaged the river-ridge 5v5. Side
   assignment per Chris (Blue=victim, Red=ambusher).
3. **Caps + split-zone AI** (`0b8d238`). `planAiDeployment` distributes melee
   round-robin across sub-zones then ranged, laying each wing out by its own local
   forwardness (no role-sorting across the gap — the S66 single-centroid seam).
   Human placement: `canPlaceInZone` rejects over-cap clicks; full sub-zones
   re-tint faint.

### Watch / unverified

- **Two new `playtest-watch.md` entries** (both S70): does the *victim* AI advance
  into the SE crossfire (free probe for the deferred predictive threat-model), and
  does the split-zone AI deployment *read* as a coherent ambush. Both need Chris's
  in-battle pass — all S70 validation is unit/integration + one deployment-screen
  browser check; no full battle was played.
- **Control toggle on the setup screen:** while driving the browser smoke I
  couldn't flip Team A→AI / Team B→Human via DOM clicks (it stayed at the default
  Blue=Human/Red=AI). Likely my eval selector, not a bug — but if a quick manual
  check shows the Human/AI buttons don't toggle, that's worth a look. Not
  investigated further.

### The registry is the encounter-definition seed (kept dormant)

The combiner stays a plain terrain+zones assembler. Config *selection* by context
(story vs random), deploy-K-from-a-larger-roster, scenario/objective/reward
objects — all still out of scope. A second layout for any existing terrain is now
pure authoring (add a registry key); the shape proves it but nothing ships a
non-`default` config yet.

## Still open, NOT touched (carried)

- **Predictive positional threat-model** — the remaining large AI gap (avoid
  reach, protect units, deploy against threats; + don't-feed-the-snowball). The
  S70 ambush map is now the natural test bed for it (see playtest-watch).
- **S69 feel-passes still unverified** — AI charm/steal/break-charm, the Math
  re-base, terrain-occlusion LoS + bounded bow arc (ADR-0117), Vantage perched-vs-
  flat (S68). All in `playtest-watch.md`.
- **Taunt redesign** (needs Chris to pin intended effect — `taunt-audit.md`);
  **Templar (S62)** and **Thief** feel passes; **S68 equipment** tunables
  (Gauntlet +3, Vicious crit). All in `playtest-watch.md`.
- `lightning-mage.ts` stale S20 header; `draft-terraformer-substrate-audit.md`
  archival — minor cleanups, still pending.
