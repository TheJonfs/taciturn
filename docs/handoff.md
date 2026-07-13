# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S93 — Chapter 1 authored & LIVE (2026-07-13)

The whole Ch1 authoring brief shipped (ADR-0150): the M1 test graph is
replaced by the real 13-node Chapter 1, walkable start→finale on
placeholders, all four substrate features exercised, gear waves + stub
prices live, campaign start reset to the true L1 party with rolled
generics. Suite green (**2869**, was 2848), `tsc -b` clean, Atlas
round-trip pin byte-identical on the renamed
`CAMPAIGN_NODES`/`CAMPAIGN_GRAPH`. Portraits for Theo/Wiegraf/Miluda
landed mid-session, bust-cropped + registered.

### Verified live in-browser (the S92 eyeball item)

Oskun's guest battle ran end-to-end in the preview: menu stays closed on
Wiegraf's turn, he acts sanely (moved toward the line), the log names him
in player-blue. Player turns open the menu normally. The battle "hang"
first observed was NOT a bug — the preview pane is a hidden tab, so rAF/
timer throttling stalls AI pacing; `window.__taciturnDebug.pump(n)`
(shipped for exactly this) drives it. Plays normally in a visible tab.

### For Chris / the planner

- **Play the chapter.** The one series to measure is party-average-level
  entering each node (pins the offset curve). Authored placeholder lineup
  levels are 2/3/4/6/7/8/9/10/7/13 for nodes 1–10 — tune freely in
  `node-content.ts` (`lineup(level)` per node).
- **Design nits noticed while walking Zarghidas** (surface, don't fix
  reflexively):
  - The location-menu labels battle-flavor a scene-only story option:
    Zarghidas shows "March on the enemy / The battle for this place
    awaits" for its opening SCENE. A beats-aware label ("Continue the
    story"?) is a small render-layer fix.
  - During a GUEST's turn the action-menu placard reads "Opponent's turn"
    — readable but wrong-flavored for an ally. Cosmetic.
  - Campaign start shows the Zarghidas hub MENU before the opening scene
    (hub + armed story = Dorter coexistence, and startCampaign marks the
    start visited). If Chris wants scene-first-then-menu at campaign
    start, that's an entry-resolution tweak, not authoring.
- **Kit-seeding at L1** (ADR-0150 watch-for): every starter arrives with
  its full Tier-1 class kit unlocked (the shipped hire-tool convention),
  and that seeded spend counts toward reclass-tier thresholds — priced
  for L25 veterans, now applied at L1. If early reclass options open too
  fast in playtest, dial the seed scope.
- **Chris's Alchemist trickle** is 100 JP (`CH1_CHRIS_ALCHEMIST_JP`) —
  sized to "buy one cheap ability"; confirm against real component costs.
- **Join gear is authored judgment** (brief didn't pin it): Clio
  wand_of_depths+linen_robe, Thessaly battle_dictionary+linen_robe+
  pointy_hat, Sera dagger+padded_vest+lookouts_hood. Tune freely in
  `ch1-roster.ts`.
- **Pendant of Lumara** is granted at the Oskun battle (brief allowed
  node 0–1; node 0 has no battle beat to hang a grant on).
- **Miluda's portrait is registered** (`plot-miluda`) but nothing
  references it yet — her Ch2 join will (her m1Roster debug unit doesn't
  carry a portrait key).

### Noticed, not acted on

- Theo's kit tuning is placeholder: L4 = pin_down only; L10 = all three
  Marksmanship actives + Eagle Eye equipped. Chris said exact JP/kit
  comes later.
- The whiteboard map's Ivalice/Ordallia border (red line) isn't drawn on
  the world map — a render-layer backdrop feature; goes with the future
  map-illustration backdrop (Chris may re-place nodes over an image
  later; positions are one Atlas drag session).
- Skirmish-stub enemy ids (`skirmish-enemy-N`) are reused by story-battle
  lineups — unique within a battle, harmless across battles; the M4
  generator replaces them anyway.
- `node-content.ts` now calls `loadDefaultCatalog()` at module init
  (authoring-time derivation only; ADR-0150 consequences note).
- Old M1-sandbox saves are silently discarded at Resume (deliberate,
  ADR-0150). Saves made on Ch1 nodes are v2-normal.

### Carried from earlier (still open, low-priority — pruned)

- **Economy content remaining:** cost TUNING pass (stub prices shipped
  S93; D-econ-6) + Tailored Outfit; then M4 authoring proper (real maps,
  lineups via the `generateSkirmishParty` seam, dialogue — M4/M5).
- `WorldMapBeatView` march-state reset rider (hoist if a surface keeps it
  mounted across advances).
- Two win-edges between the same (from, to) pair still deduped by
  `addEdge`; flag if a layout wants it.
- Engagement-queue acceptance test uses hand-built graphs; add a
  shipped-content pin when the real graph gains a camp (Ch2).
- Progressive reveal stays a small render-layer rider.
- Atlas beat-editor tier before M5 authoring volume; drag-from-rim edge
  gesture deferred.
- S89 playtest watch: AI gold-plating dials; kiting tie-break intended.
- JP spillover on over-threshold spend; enemy progression tuning for
  the recycled battlefields.
- Loadout 2nd-secondary UI, "Level Up!" banner polish,
  rapid-dialogue-advance setState-in-render warning, "99 cap" guide
  fiction.
- S85/S87 playtest watch items (Epee CT-refund loops, Star Robe
  lifesteal, Expert's Tunic × Golden Hairpin, tempo-caster stack,
  Scouring × dual-wield, Manaeater-as-default, Terra Robe maybe weak;
  Cremation × Pendant, Shadowblade vs HP sponges, Del's Stave
  dump-on-buffs, Golden Rod clock, Volley Bow friendly fire, Excalibur
  above-curve by intent) — watch, don't pre-nerf.
- FormationDevHarness still shows 2 synthetic invalid units (Nova,
  Ptolemy) as a warning-state showcase.
- reclassUnit frees now-illegal passives but keeps now-illegal gear (D2:
  surface, don't resolve).
- Income-to-price ratio / XP rubber-band / recruitment cap / re-entry
  guard watch-fors from S88 remain live — now measurable on real Ch1.
- Retreated player units classify `survived` with hp 0 (apply-back would
  carry 0 HP); unreachable in Ch1 (only Theo is protected). Decide the
  carry-HP rule if a future chapter protects a player unit.
- AI charm asymmetry (charmed PLAYER unit foe computation) unreached
  while no enemy has Steal Heart.
