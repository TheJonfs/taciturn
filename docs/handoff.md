# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S92 — Ch1 substrate SHIPPED whole (2026-07-12)

All four pieces of `taba-ch1-substrate-brief.md` landed in one session
(ADR-0149): the victory-condition grammar + death-protection + death
tracking (WI1), the campaign-flag store + outcome-branched post-battle
scenes (WI2), phantom node/edge with Atlas authoring (WI3), and guest
allies + `joinPlotUnit` (WI4). Suite green (**2848**, was 2798), `tsc -b`
clean, saves back-compatible (flags lenient-absent, no schema bump),
Atlas round-trip pin byte-identical. Design docs updated:
`turn-structure.md` (victory grammar + death protection),
`atlas-guide.md` (phantom + the new NodeBattle fields, validation rules
table).

### For Chris / the planner

- **The Ch1 Atlas layout session is unblocked**: nodes 3/8/9/10's outcome
  logic, the 9/10 `onOutcome` scene branches, Viura's phantom edge, and
  the 1/6 guests are all authorable in `node-content.ts` / Atlas now.
- **Design points settled at session start (recorded in ADR-0149):**
  D-sub-1 → boss retreat presents post-battle only (no mid-battle beat);
  D-sub-2 → confirmed, subdue ENDS the battle as a win; the missing
  plot-unit-join mechanism → built (`joinPlotUnit`, campaign/join.ts).
- **Brief write-backs (audit findings):** guests are NOT
  Steal-Heart-minus-timer — Steal Heart flips control and keeps team; a
  guest keeps team and flips control, which the existing seams handle
  almost for free (the AI's team-derived friend/foe is *correct* for
  guests). "Same mechanism as Clio/Thessaly joining" didn't exist — plot
  units were seeded into the initial roster; the runtime join is new.
  Scenes are inline beats, not sceneRefs, so `onOutcome` maps tag →
  inline `StoryScene`.
- **Threshold semantics pinned** (per the brief's watch-for lean): strict
  `<` for below-fraction; "died" = ever hit 0 HP this battle, revival
  does not clear it; a not-standing unit counts as below any threshold.

### Noticed, not acted on

- **Same-boundary decide edge:** battle_end's outcome is decided at the
  checkpoint that satisfies it; a generated action still draining on the
  same boundary (e.g. a poison tick killing an enemy right after the
  good-outcome battle_end enqueued) does not retro-downgrade the recorded
  outcome. Documented in ADR-0149; revisit only if a playtest ever
  surfaces it as feeling wrong.
- **Retreated player units** classify `survived` with hp 0 in the battle
  summary — apply-back would carry 0 HP. Unreachable in Ch1 (only the
  antagonist is death-protected); if a future chapter protects a player
  unit, decide the carry-HP rule then.
- **AI charm asymmetry re-confirmed** (audit): the AI driving a charmed
  PLAYER unit computes foes from the puppet's real team (backwards);
  unreached while no enemy has Steal Heart. Unchanged by WI4 — guests
  route around it because team and side agree.
- **Guest turn-flow UI**: `isOurTurn` gating is tested at the hook level
  and the orchestrator routing end-to-end (guest-control.test.ts), but no
  browser playtest of a guest battle happened (no shipped battle authors
  one yet). First Ch1 authoring session should eyeball Oskun's guest
  fight live: menu stays closed on the guest's turn, guest acts sanely,
  banner/log read right.
- **`evaluateBattleOutcome` now takes the catalog** — any future caller
  outside commit.ts must thread it.

### Carried from earlier (still open, low-priority — unchanged from S91)

- **Economy CONTENT pass remains the other M3 beat** (real bundles,
  prices, unique placement; dials in `campaign/economy-config.ts`), then
  Tailored Outfit; M4 authoring follows (gear seam ready per ADR-0146).
- `WorldMapBeatView` march-state reset rider (hoist into the component if
  a surface ever keeps it mounted across advances).
- TERMINAL node with a multi-engagement queue sets `won` on clearing its
  current engagement (edge-count-based isTerminal); cheap validation
  warning if Ch1 authoring trips on it. Note: phantom edges are now
  excluded from isTerminal (a node whose only out-edge is phantom IS
  terminal) — that's load-bearing for Old Ordal if it ends a spur.
- Two win-edges between the same (from, to) pair still deduped by
  `addEdge` (not authorable in-tool); flag if a layout wants it.
- Engagement-queue acceptance test uses hand-built graphs; add a
  shipped-content pin when the real graph gains a camp.
- Progressive reveal stays a small render-layer rider.
- Atlas beat-editor tier before M5 authoring volume; `M1_NODES` cosmetic
  rename; drag-from-rim edge gesture deferred.
- S89 playtest watch: AI gold-plating dials; kiting tie-break intended.
- JP spillover on over-threshold spend; enemy progression tuning for
  Stonebridge/Marshmoor/Mountain Pass.
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
  guard watch-fors from S88 remain live.
