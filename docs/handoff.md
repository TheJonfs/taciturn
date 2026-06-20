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

### Team Builder slot levels → fixed per slot (late S71, Chris's call)

The S71 `slotLevelProspective` stopgap (and the underlying S49 *compaction*
scheme) caused the roster level pills to shift as the team filled — every empty
slot read the same number; a unit placed out of order showed L25 and renumbered
as earlier slots filled. Per Chris, levels are now a **fixed property of the slot
position** (`slotLevelFor(index)` everywhere: assembly, stat preview, display) —
restoring ADR-0087's *blueprint* (which the implementation had drifted from).
Browser-verified: empty roster reads L25/24/26/23/27; filling slot 3 first shows
L26 and nothing shifts. ADR-0087 amended; `slotLevel(index)` no longer takes
state/returns null; `slotLevelProspective` removed. **Behavior change for <5-unit
teams: placement now sets level** (3 units in slots 1/3/5 = 25/26/27, was
25/24/26). Full 5-unit teams unchanged. Watch item if slot-skipping level-gaming
matters → contiguous-fill constraint is the mitigation (not adopted).

### Two playtest bug fixes (late S71)

- **Throw Item "can't target self" (fixed — real cause).** First diagnosis (empty
  stockpile) was wrong: Chris had Phoenix Down + Remedy + Ether, no Potion, full
  HP. The throw target-click probed a *single arbitrary* stocked item; with Phoenix
  Down first (and Phoenix Down's KO-only gate), validating it against a living self
  failed, and the handler cancelled the click. Fix: the click now proceeds if **any
  stocked item is throwable** at the target (`use-turn-flow.ts`); the item picker
  greys out per-item invalid throws with the engine reason
  (`ThrowItemItemPicker`, `action-menu.tsx` — the gate had been stubbed
  `disabled={false}`); and Throw Item is still disabled when the bag is empty
  (`computeAbilityDisableReason`).
  - **KO'd-target highlight (fixed).** Extracted `hasThrowableItemAt` (exported
    from `use-turn-flow.ts`) and used it for BOTH the target-click and the throw
    branch of `computeLegalTargets` — so the highlight now includes KO'd-but-not-
    removed allies (Phoenix Down targets) and excludes living units a revive-only
    bag can't reach, exactly matching the click. Highlight ↔ click are now in
    lockstep through one helper.
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
