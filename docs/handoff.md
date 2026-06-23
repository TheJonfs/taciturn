# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S73 — AI tuning: MP-bottleneck gate + buff-aware cohesion (2026-06-23)

Two commits on main. **ADR-0123.** 2021 → 2032 tests; tsc + vite build clean.
Both tunes are AI-scoring only (no game rule / content / UX change → guide
changelog got the "no player-facing" entry). Feel is **unverified** — the PixiJS
harness can't drive both-AI battles since S70; see the new `playtest-watch.md`
entry for what to watch.

### Chunk 1 — MP-bottleneck gate — `8c3b526`
- `mpBottleneckFactor` (`src/ai/basic.ts`) gates the Ether restore-valuation on
  whether MP is a genuine bottleneck for the **recipient's kit** (not its current
  MP): MP-free offense (bow Alchemist) → 0 → advance; any MP-gated heal/buff/
  debuff or MP-gated damage beating the free attack → 1 → unchanged. Applied in
  `bestThrowCandidate`'s Ether branch; the offense-side MP-*spend* penalty
  (ADR-0109) is untouched.
- Proved by `session-73-mp-bottleneck.test.ts` (constructed deterministic repro).
  The S66 Ether fixture was updated to give its recipient a real `fire_spells`
  loadout (an empty-loadout mage can't spend MP and rightly scores 0 now).

### Chunk 2 — buff-aware cohesion — `9bd8c45`
- A **banded** advance term in `pickBestMove`'s pure-advance regime: with an
  AoE-buffer on the team, among advance tiles within `COHESION_BAND` (1) of the
  best forward progress, prefer the one nearest the buffer. Bounded → no stall;
  inert without a buffer; off for combat tiles and height-seeker perch approaches
  (subordinate by construction). `isAoeBuffer` / `cohesionAnchor` are the new
  helpers. Tests in `session-73-buff-cohesion.test.ts`.
- A *weighted* distance-blend was rejected (near-inert under Manhattan movement at
  a mild weight; stall-prone at a strong one) — see ADR-0123.

### Watch-fors / deliberate scoping (S73)
- **`COHESION_BAND` is the cohesion dial.** Mild (1) for now per Chris. Raising it
  tightens packing — but the AI still can't weigh **enemy** AoE threat, so
  over-packing feeds enemy AoE (Chris saw two Enchanters die to one AoE).
- Cohesion anchors on the buffer's **current** position (a clustering proxy), not
  a predicted prospective-AoE footprint, and the buffer itself gets no
  stay-near-beneficiaries term. Both are deferred refinements, not bugs.
- The gate is binary/kit-keyed (no numeric dial); confirm in live play it neither
  idles on self-restore nor stops a real caster valuing Ether.

## Still open, NOT touched (carried — deferred, in `playtest-watch.md`)

- **Predictive positional threat-model** — the remaining large AI gap (avoid
  reach, protect units, deploy against threats; + don't-feed-the-snowball). Its
  camping/high-ground half is **unwanted** (engagement-bias is the design intent
  per S73); only the protective/anti-AoE half is wanted. S70 Mountain Pass is the
  natural test bed. The S73 cohesion over-pack risk is the first thing that
  *wants* the enemy-AoE half of this.
- **S72 Enchanter feel-pass pile** (untuned at S72): reliable AoE Protect/Shell
  time-to-kill shift; Protect/Shell now COMPOUND with native resistance
  (multiplicative); Aura Mastery K=1.33 potency; buff→Steal-Buffs loop; low-Faith-
  ally penalty feel; Auramancy friendly-fire splashing onto enemies; Esuna
  `remedyImmune` + Resistance Save looseness levers; Protect-as-multiplier
  symmetric-with-Shell (easily reverted).
- **S70/S69 carries:** S70 in-battle verification (ambush crossfire / split-zone);
  S69 feel-passes (charm/steal/break-charm, Math re-base, terrain-occlusion LoS +
  bounded bow arc, Vantage perched-vs-flat). All in `playtest-watch.md`.
- **Taunt redesign** (needs Chris to pin intended effect — `taunt-audit.md`);
  **Templar / Thief** feel passes; **S68 equipment** tunables (Gauntlet +3,
  Vicious crit).
- **Action-log redesign** (render-layer, approved, unbuilt).
- Minor cleanups: `lightning-mage.ts` stale S20 header;
  `draft-terraformer-substrate-audit.md` archival.
- **In-app battle auto-drive still blocked** — the setup screen's Human/AI toggle
  doesn't respond to DOM clicks (since S70), so both-AI battles can't be
  auto-driven in the preview. (This is why all S73 validation is unit-test-only.)
  Team Builder itself drives fine.

## Loose end (carried from S72, still untracked)
- `guide/art/enchantress_1.png` (5.2 MB) is an untracked **guide** asset, left
  unstaged — not a game asset. Leave it for the guide-writing lineage.
