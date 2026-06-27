# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S75 — both-AI auto-drive seam (2026-06-27)

Shipped the S75 brief in full: a **test/debug-only headless both-AI battle
runner** + action-log inspection seam that unblocks AI feel-verification. The
S70 in-app auto-drive block (the single biggest AI testing gap, carried since
S70) is now **resolved from the headless side** — we no longer need the setup
toggle to observe a full both-AI battle. `tsc -b` + `vite build` clean; suite
2075 passed / 1 skipped (the gated sim). ADR-0130.

### What landed
- `src/app/demo/headless-battle.ts` — `runHeadlessBattle({teamA, teamB, mapId,
  seed})`: composes the *live* orchestration path (team fold → AI deployment →
  initial state → pre-battle queue → `DemoOrchestrator` + two AI controllers)
  minus React/Pixi, returns the full action log + outcome. Reuses the real
  wiring, so it can't drift from what the app runs.
- `src/app/demo/battle-log-inspect.ts` — generic log readers (`aoeBuffCasts`,
  `chargedTilePinResolutions`). The durable seam: a future AI feel-check adds
  one reader and runs the sim.
- `src/app/demo/both-ai-sim.test.ts` — env-gated dev harness
  (`describe.runIf(TACITURN_SIM)`). Default suite SKIPS it (no permanent A/B
  assertions, per Chris). Run with **`npm run sim:both-ai`**.
- **Nothing in production imports these** — they tree-shake out; no backdoor.

### First dividend — S74 A/B feel read (claudesBulwark vs claudesAnswers, River Ridge, 5 seeds)
- **B (charged-attack dodge devaluation, ADR-0129 B): VERIFIED.** 5/5 committed
  `charged_attack` charges landed, 0% whiff. The AI declined the dodgeable ones.
- **A (coverage-weighted AoE buffs, ADR-0129 A): surfaced but CONFOUNDED, not a
  bug.** Enchanter clustered 0/3 casts on ≥2 allies (avg 0.67 in footprint;
  coverage == buffs-landed, so NOT a buff-exclusivity artifact). But the enchant
  buffs are diamond **radius 1** → two allies must be adjacent to co-cover, and
  on an open map they rarely were; the Enchanter also cast rarely (3 casts / 5
  battles, 0 in two). **Follow-up tune candidates (out of S75 scope):** does the
  AI position allies to *create* cluster-buff opportunities (the protective
  half of the threat-model)? why the low cast frequency? Re-run `sim:both-ai`
  after any tune to re-read.

### Incidental fix (own commit)
- `src/ui/team-builder-unit-card.test.tsx` was **stale, broken by the S74
  Gravity Well retune** (slot-0 Sera no longer holds a Scimitar; she now holds a
  Chef's Knife). Pointed the pill finder at the current weapon. Pre-existing
  failure, unrelated to the seam — fixed to restore suite-green.

## Also S75 — two reaction audits (Chris-requested)
- **Damage Split reflect-on-KO: investigated, NOT a bug.** The survival gate
  (`reaction-compiler.ts` reflect_damage branch) reads the post-damage unit from
  `workingState` and correctly suppresses both halves on a KO. Coverage had a gap
  — the existing KO test faked `hp 0` at the emission level — so added a
  commit-path test driving a real lethal attack (`c2d5d1c`). Passes; the
  suspected bug is absent.
- **Stop now suppresses reactions (ADR-0131, shipped).** Audit found Stop had
  ZERO reaction interaction (only `queryTurnSkipped`); a Stopped unit reacted
  fully. Made it FFT-faithful: new general `StatusEffectType.suppressesReactions`
  flag, gated at the `runOnActionTargeted` choke point (covers all reaction kinds
  uniformly — Counter, Damage Split reflect, ct_push, apply_status). Stop sets
  it; Don't Act deliberately does NOT (reflex vs. volition preserved). **Player-
  facing** (guide-changelog updated). **AI awareness folded in same session:**
  `reactionPenalty` now returns 0 vs. a target with a `suppressesReactions`
  status (reads the generic flag, not a content id), so the AI stops fearing a
  Stopped reactor's dead reaction. Tested in `basic.test.ts`.

## Also S75 — exporter fix + new team
- **Team-export gender fix.** `exportBuiltTeamThin` now carries each unit's
  hand-set `gender` (omits it when unset = class default). Pre-S75 the exporter
  dropped it and a re-loaded team fell back to class-default portraits. Tested
  in `team-export.test.ts`.
- **New bundled team "T-Munny"** (`src/content/teams/t-munny.ts`, in
  `defaultTeamTemplates`): Knight/Thief/Enchanter/Templar/Water Mage,
  transcribed from Chris's export JSON. Passes `assertTemplateCompliance`.

## Still open, NOT touched (carried — in `playtest-watch.md`)
- **Predictive positional threat-model** — the remaining large AI gap. Only the
  protective/anti-AoE half is wanted (camping/high-ground half unwanted per S73).
  S74 AI A's cluster opportunity (above) + AI B's deferred *dodge-incoming* half
  both want it. **The S75 seam is now the tool to verify it.** S70 Mountain Pass
  is the test bed — but note that map only authors 2 slots/team, so a 5v5
  cluster test needs River Ridge (or bump the map's authored slots).
- **S72 Enchanter feel-pass pile** (AoE Protect/Shell TTK, Aura Mastery K, buff→
  Steal-Buffs loop, low-Faith penalty, Auramancy friendly-fire splash, etc.).
- **S70/S69 carries:** S70 in-battle verification (ambush/split-zone); S69
  feel-passes (charm/steal, Math re-base, terrain-occlusion LoS + bounded arc,
  Vantage). **Taunt redesign** (needs Chris to pin intent — `taunt-audit.md`).
  **Templar/Thief** feel passes; **S68 equipment** tunables.
- **S74 strong-version watch-fors** (in `playtest-watch.md`): Ring of Caliora
  (uncapped CT drain) + Glove of Metria (per-target SP, applies to Math Skill)
  compounding on the Calculator; knife `attacker_speed` variance as an uncapped
  speed→damage multiplier. All "confirm, leave for now" per Chris.
- **S74 accessories not yet equipped on a default team** — the four caster
  accessories ship in-catalog but untuned in live builds; Chris may want to slot
  Ring/Glove onto the Calculator in "Claude's Answers" to exercise the field-wide
  case.
- **Action-log redesign** (render-layer, approved, unbuilt).
- Minor: `lightning-mage.ts` stale S20 header; `draft-terraformer-substrate-audit.md`
  archival.

## Loose end (carried from S72, still untracked)
- `guide/art/enchantress_1.png` (5.2 MB) — untracked **guide** asset, left
  unstaged. Leave it for the guide-writing lineage.
