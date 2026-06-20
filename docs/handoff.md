# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S71 — Polish & correctness batch (all 3 chunks) (2026-06-19)

Shipped on main across two commits + one no-op chunk. **ADR-0119. 1985 → 1992
tests; tsc + vite build clean.** Chunk 1 browser-verified in the Team Builder
(Mage War default team); chunks 2–3 are unit/integration + audit.

- **Chunk 1 — legibility & polish** (`5cf3d3b`). Tooltip corrections (Damage
  Split half-reflect, Tidal Pull self-CT, Ignition any-magical, Spiked Mail
  reflect, Wand of Potential +1 SP, the four wand Resonances); Team Builder
  affordances (empty-slot prospective level, primary-class command set pinned +
  hoverable, gender on roster cards + Steal-Heart note); targeting recolor (new
  `'target'` amber highlight for Math Skill + Barrier previews, which land on
  either team — red read as Red Team). No engine behavior change.
- **Chunk 2 — behavior fixes** (`76d6f32`, ADR-0119). Templar Jump forfeits the
  Move budget (`spendsMoveBudget` flag → zeroes `movesAvailable` at commit; UI
  Move button already budget-gated). Exact Rhythm drops Faith from its CT-push
  magnitude (the S63 Math-Skill sweep's leftover) — now `SP × MA`, ~2× at default
  Faith.
- **Chunk 3 — Ignition** (no code). Audited: already fires on any magical damage
  at cost 2 (the documented intent); the only defect was the tooltip, fixed in
  chunk 1. Chunk 3 closes with no behavior change.

### Two playtest bug fixes (late S71)

- **Throw Item dead-end (fixed).** Throwing an item at self — incl. at full HP —
  always validated fine at the engine level (probe-tested). The reported "can't
  target self" was an *empty/insufficient stockpile* dead-ending the target step:
  Throw Item was offered with nothing to throw, so target clicks hit the bogus-item
  fallback and silently cancelled. Fixed by gating Throw Item disabled (with a
  "Compound first" hint) when the stockpile is empty — `computeAbilityDisableReason`
  in `use-turn-flow.ts`.
- **Battle-end turn count (fixed).** Results screen "ended on turn T####" counted
  only `turn_start`; the action log's T-number also advances on each
  `charged_action_resolve`. They disagreed in any charged-spell battle. Extracted
  `finalTurnNumber` in `action-log-format.ts` as the shared source of truth; the
  results screen now uses it.
- **Browser-verify blocked (carry):** couldn't auto-drive a both-AI battle to
  re-confirm the turn count in-app — the setup screen's Human/AI toggle still
  doesn't respond to DOM clicks (the same issue noted in the S70 handoff). Both
  fixes are unit-tested; #2's two surfaces now share one function so they can't
  drift. Worth a manual in-app check if convenient.

### Resolved this session — Math Skill status-application Faith gates

- The flag raised at first review (whether to drop Faith from Math Skill *status*
  applications, not just output) was **settled with Chris: Option B applied.**
  Precision Fire's Burn, Sculpted Enhancement, and Engineered Defenses now use the
  MA-only factor (`factors: { ma: true }`), with bases retuned **50→25 / 50→25 /
  80→40** to keep effective landing rates near the prior ~45% / ~45% / ~72% at
  base MA 9 (the MA factor ≥1.8 would otherwise have pushed them to ~90–100%).
  ADR-0119 updated; **25/25/40 logged as a tuning watch item in
  `playtest-watch.md`** — best-effort match, not playtested, and a high-MA
  Calculator still trends toward 100%.

### Noted divergence (in ADR-0119, not silently resolved)

- **Jump "reposition" framing vs implementation.** The finding calls Jump a
  reposition, but the shipped Jump lands back on its takeoff tile (no relocation,
  ADR-0103). The Move-lock is justified on action-economy grounds, not "it moved
  you." If Jump is ever made to land on the *target* tile (FFT-canonical), the
  lock already fits; and `movesConsumed` was deliberately left unbumped (CT cost
  unchanged) — bumping it to price Jump as a Move+Act turn is a reserved lever.

## Still open, NOT touched (carried from S70)

- **Predictive positional threat-model** — the remaining large AI gap (avoid
  reach, protect units, deploy against threats; + don't-feed-the-snowball). The
  S70 ambush map (Mountain Pass) is the natural test bed (see `playtest-watch.md`).
- **S70 in-battle verification** — does the victim AI advance into the SE
  crossfire, and does the split-zone deployment read as a coherent ambush. Both
  need Chris's in-battle pass (S70 validation was unit/integration + one
  deployment-screen browser check). In `playtest-watch.md`.
- **S69 feel-passes still unverified** — AI charm/steal/break-charm, the Math
  re-base, terrain-occlusion LoS + bounded bow arc (ADR-0117), Vantage
  perched-vs-flat (S68). All in `playtest-watch.md`.
- **Taunt redesign** (needs Chris to pin intended effect — `taunt-audit.md`);
  **Templar (S62)** and **Thief** feel passes; **S68 equipment** tunables
  (Gauntlet +3, Vicious crit). All in `playtest-watch.md`.
- `lightning-mage.ts` stale S20 header; `draft-terraformer-substrate-audit.md`
  archival — minor cleanups, still pending.
