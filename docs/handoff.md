# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S94 — Ch1 feedback round one (2026-07-13, same day as S93)

Chris played the fresh Chapter 1 and all seven feedback items shipped
(ADR-0151), plus the same-day round two: class innates auto-equip on
every created unit; EVERY Ch1 unit starts with an authored small kit
(named cast one signature each; generics their class's cheapest active —
only hires keep full kits); Lumen/Chris armor swap; PER-HUB shop stock
(revises D2); STORY-FIRST entry at hubs (revises the S88 Dorter menu;
campaign start now opens on the Zarghidas scene); progressive map reveal
with always-visible Old Ordal + Viura teases; and a dev level-up chip.
Suite green (**2879**),
`tsc -b` clean, Atlas round-trip pin regenerated for `alwaysVisible`.
Browser-verified: scene-first start, four-node reveal with the dashed
Viura tease, Zarghidas shop selling exactly its 12-item starter kit.

### For Chris / the planner

- **RESOLVED (round two): generics now start with one skill** — their
  class's cheapest active (Potion / Charged Attack / Bear's Heave / Rock
  Toss, via `cheapestClassActive`). Hires deliberately keep the full
  Tier-1 kit (paid convenience). If a specific pick reads wrong (e.g.
  Charged Attack over Scramble — a 100-JP tie broken by authoring
  order), it's a one-line authored override.
- **Level-up debug chip confirmed as-is by Chris** (party-wide +1,
  repeatable). Chris is running a Ch1 playtest speedrun next — expect a
  feedback batch; the offset-curve measure (party avg entering each
  node) is the series to ask about.
- Remaining S93 cosmetic nit STILL open: a GUEST's turn shows
  "Opponent's turn" in the action-menu placard (menu-before-scene and
  the "March on the enemy" scene label were both mooted by story-first
  entry).
- ShopScreen subtitle could name the hub now that stock is per-town
  (cosmetic copy).
- Playtest measure unchanged: party-average level entering each node
  pins the offset curve; the level chip lets you stage the party at any
  rung quickly.

### Noticed, not acted on

- The preview pane is a HIDDEN tab — battles stall on rAF/timer
  throttling there; `window.__taciturnDebug.pump(n)` drives them
  (shipped affordance). Normal visible-tab play is unaffected.
- `buildLocationMenuBeat` keeps its now-driver-unreachable 'story'
  option (pure function; future re-armed camps may want the choice
  back). Its "Dorter coexistence" test is annotated accordingly.
- Progressive reveal keeps the viewBox derived from the FULL layout so
  the frame doesn't jump as places appear — revisit when the map gains
  its illustration backdrop (Chris may re-place nodes over an image;
  positions are one Atlas drag session).

### Carried from earlier (still open, low-priority — pruned)

- **Economy content remaining:** cost TUNING pass (D-econ-6) + Tailored
  Outfit; then M4 authoring proper (real maps, lineups via the
  `generateSkirmishParty` seam, dialogue — M4/M5).
- Theo kit tuning placeholder (L4 pin_down only; L10 full Marksmanship +
  Eagle Eye); exact JP/kit later per Chris.
- `WorldMapBeatView` march-state reset rider; two win-edges between the
  same pair deduped by `addEdge`; engagement-queue shipped-content pin
  when a camp lands (Ch2); Atlas beat-editor tier before M5 volume.
- Kit-seeding tier-threshold watch (full-kit generics may open adjacent
  reclass tiers early — dial seed scope if so).
- S89 playtest watch (AI gold-plating dials); JP spillover seam; "Level
  Up!" banner polish; rapid-dialogue-advance setState warning; "99 cap"
  guide fiction.
- S85/S87 gear watch list (Epee loops, Star Robe lifesteal, Expert's
  Tunic × Golden Hairpin, tempo-caster stack, Scouring × dual-wield,
  Manaeater default, Terra Robe, Cremation × Pendant, Shadowblade vs
  sponges, Del's Stave, Golden Rod clock, Volley Bow friendly fire,
  Excalibur by intent) — watch, don't pre-nerf.
- FormationDevHarness synthetic invalid units (Nova, Ptolemy) intended.
- reclassUnit keeps now-illegal gear (D2: surface, don't resolve).
- Income-to-price / XP rubber-band / recruitment cap / re-entry guard
  watch-fors — now measurable on real Ch1.
- Retreated player units carry hp 0 in apply-back (unreachable in Ch1 —
  only Theo is protected); AI charm asymmetry unreached without enemy
  Steal Heart.
