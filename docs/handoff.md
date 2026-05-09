# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-09 (session 20b — last implementation session of wave 2)

**Wave 2 is closed.** Sessions 14-20b shipped: magical damage / Faith pipeline, charged-action lifecycle, four Mage classes, AoE substrate, equipment integration, custom-trigger statuses, status side-effect infrastructure, crit / chain / self-damage / Vulnerable, AI tier 1.5, AI tier 2 (stat-aware projection + reaction tag-filter inspection + joint planner + polarity hints + cone/line direction). 557 tests pass. The demo battle plays through end-to-end with all five classes on the field.

### The next session is a design / planning session, not an implementation session

The user's call: before another implementation wave starts, do a planning pass that merges:

1. **What was built** — the implementation surface from sessions 14-20b (5 classes, ~36 abilities, ~22 statuses, ~5 equipment, tier-2 AI). See `docs/content-snapshot.md` for the comprehensive numerical snapshot.

2. **What needs designing** — UI improvements (general ability-picker, charged-action surface, battle log), more content (sixth class, equipment expansion, status catalog growth), and a calibration pass on existing numbers now that tier-2 AI is sensitive to them.

3. **A balancing pass on existing content** — the AI's tier-2 projection now folds in PA/MA, weapon WP, Faith × Faith, resistance, Vulnerable, crit, evasion, and variance. With everything composing into expected damage, the calibration surface is small enough to tune now and scales sub-linearly with new content; doing it before wave-3's first content session lands the right baseline for the new class to slot into.

### The primary artifact for the next session

**`docs/content-snapshot.md`** — frozen as of end-of-20b. It's the numerical reference for the design planner: every class's stats, every ability's power_coefficient / mpCost / actionSpeed / range / status effects, every equipment item's WP / accuracy / grants, every status's magnitude / duration / stacking / polarity, plus ruleset constants. Calibration questions are surfaced inline ("Storm Caller never fires from the AI — intent or under-tuned?", "Free-passive asymmetry across classes", etc.) so the planner can scan them for prompts.

The snapshot is a frozen reference. After a calibration pass changes numbers, refresh it.

### Suggested shape for the planning session

Three blocks to work through, in roughly this order:

1. **Calibration pass** — go through the snapshot's "Calibration questions surfaced" section. For each question, decide one of: (a) tune now, (b) defer with reason, (c) tune as part of the next content session. Anchor decisions in target gameplay (e.g., "Storm Caller should fire roughly once per battle" → tune `SELF_COST_DAMPING_FACTOR` and/or HP totals).

2. **Wave-3 sequencing** — pick the next 3-5 sessions. Candidates from the prior handoff:
   - **Sixth class** (Priest / Time Mage / Thief / Monk / Wizard, ranked by what new mechanics they pull in).
   - **Equipment expansion** (mage weapons, armor variety, consumables).
   - **Status catalog growth** (Reflect / Protect / Shell / Sleep / Slow / Quick — typically tied to a class).
   - **General ability-picker UI** (FFT-style submenu).
   - **Charged-action UI surface** (cast indicator).
   - **Battle log surface** (narrate damage / status / reactions / charges).
   - **Move-to-heal / move-to-buff** AI extension.
   - **Status-impact projection** in the AI (currently coarse for status-only abilities).

3. **Wave-3 framing** — name the wave's identity. Wave 1 was "engine through first playable battle." Wave 2 was "content-led mechanism extensions" (each Mage class drove its engine extension). Wave 3 candidates: "calibration + UX wave", "second-playable wave (content density + UI maturity)", "v1 declaration wave" (gate the v1 deliverable definition).

### What's in flight that affects planning

- **Pre-existing TS strict-mode test errors persist.** `tsc -b --noEmit` surfaces them; npm test passes via Vitest's loose mode. Defer to a focused cleanup pass — not blocking but worth scheduling.

- **AI tier-3 candidates from session 20b's deferral list** (carry forward, not blocking):
  - Move-to-heal / move-to-buff (joint planner doesn't reach for out-of-range allies).
  - Reaction-effect value inspection (current penalty is flat per-match-trigger, not weighted by what the reaction would actually do).
  - `minDamage` gate respected in penalty calculation.
  - Charged-action multi-turn awareness ("I'll be skipped next turn").
  - Affordability filter expansion beyond MP (Silence / Don't Act conditional rejection).

- **Vite HMR cache desync** (one observed during session 20b): a transient broken-imports state cached in HMR persisted across reloads even after the source was fixed. Recovery needed cache-busting URL navigation. Worth noting if next session's planning involves any code changes that touch import surfaces — a Vite restart is the bigger hammer if HMR gets stuck.

### Items dropped from the prior handoff

- **Implementation-detail notes** about tier-1.5 calibration drift, joint planner cost concerns, cone scoring positional details: these belong in code comments / ADR-0033's "Consequences" section, not in the planning-session handoff. Promoted there; dropped from active reading.
- **"Things considered but did not do" from 20b implementation**: those were rationale for 20b's design choices, captured in ADR-0033. Not relevant to the planning session.

### Suggested first prompt for the planner

> "I want to plan wave 3. Read `docs/content-snapshot.md` end-to-end, then read `docs/handoff.md` and `docs/progress.md` for context. Then walk me through the calibration questions in the snapshot's section 7. We'll go question-by-question; for each, you propose a tuning direction and reasoning, I confirm or redirect. After calibration, we'll sequence the next 3-5 sessions."
