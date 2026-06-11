# Session 63 brief — log redesign + small-items batch

## Session 63 package (three files)

This session's work spans three files, all in `docs/`:

1. **`session-action-log-brief.md`** — the action-log redesign. The major item: reframes the log as an event stream with state collapsed behind a per-turn ledger. Carries its own audit question (structured events vs. formatted strings) that decides whether it's a Medium render-layer job or a Large substrate-plus-render one.
2. **`action-log-concept.html`** — the approved visual concept for that redesign. Standalone; opens in a browser; click a turn header or "Show ledger" to see the interaction. Placeholder colors/icons — *not* production styling.
3. **This brief** — four smaller, independent items batched below.

**Scope and scheduling:** "Session 63" is a nominal anchor for numbering continuity (last was S62, Templar). The work here is very likely *more than one session* — the log redesign is the big rock and may warrant its own. Audit first, then scope and schedule with Chris across one or more sessions; don't assume it all fits one. The four items below are independent of the log redesign and of each other, with one soft coupling noted (item D ↔ the log's KO handling).

---

## Item A — Taunt: audit and report (no redesign this session)

**Context.** Taunt is the lone `straight_line` no-damage ability on the Knight's kit. It was built early, has barely been exercised, and Chris suspects it may not actually work.

**Work.** Audit only. Determine (1) what Taunt is *defined* to do — its intended effect, presumably some form of targeting/threat control — and (2) what it *actually* does across the engine, the AI, and the UI. If it's a control effect, a key sub-question: does the AI's targeting even respond to it, or is the effect inert because nothing consumes it?

**This is audit-and-report. Do not redesign or replace Taunt this session.** Write up intended-vs-actual behavior and a recommendation — salvageable with a specific fix, or needs a ground-up redesign. The keep/salvage/redesign call routes back to Chris.

**Watch-fors.** Don't "fix" it by guessing intent — if the intended effect is ambiguous, surface that to Chris rather than inventing it. The AI-side question (does targeting honor a taunt) likely ties into the threat/targeting model; note any dependency you find.

**Decision status.** Report-only; design decision deferred to Chris.

---

## Item B — Calculator: remove Faith from Precision Fire & Targeted Treatment (buff)

**Context.** Precision Fire (damage) and Targeted Treatment (healing) currently scale `MA × SP × faith`. Chris has settled this as a **deliberate buff**, not a determinism-only change.

**Work.** Remove the faith factor from both abilities' magnitude, leaving `MA × SP × (any other effects)`. **Keep SP unchanged** — do not recalibrate it down. At default faith (~0.49) this is roughly a 2× increase, and makes both abilities deterministic as a side effect. Both intended.

**Acceptance.** Neither ability has a faith term; output ≈ 2× prior at default faith; no faith dependence remains for these two; all *other* faith-scaled abilities are untouched (notably the Templar's Cure/Raise, which still use faith).

**Watch-fors.** Scope strictly to these two abilities — do not modify the shared faith-scaling path other abilities depend on. Maintain three-resolver consistency: live engine, AI projection, and UI forecast must all reflect the no-faith math, so the AI scores these at their new (~2×) value and the forecast shows correct numbers. This re-bases the AI's valuation of both abilities upward; a playtest should confirm the AI now uses the buffed versions sensibly rather than overcommitting to them.

**Decision status.** Settled — buff, SP unchanged.

---

## Item C — Brine (Hydrologist): boost the Speed effect

**Context.** Brine goes unused — too low-impact relative to the Hydrologist's other options. The lever is its effect on Speed.

**Work.** Audit Brine's current Speed effect (magnitude, duration, and whether it's a debuff on a target or a buff on an ally — confirm, don't assume), then increase it. Report the current value and a proposed new value for Chris to confirm before committing — this is a tuning dial, so the number routes through Chris.

**Acceptance.** Brine's Speed effect is meaningfully stronger, at a value Chris has signed off on.

**Watch-fors.** Speed is high-leverage — it drives CT accrual and turn frequency, so a Speed swing moves tempo hard. Size the bump deliberately; don't max it. Surface the current mechanic and value rather than picking a new number unilaterally.

**Decision status.** Direction settled (boost Speed effect); exact value pending Chris's confirmation after the audit.

---

## Item D — End-of-battle summary: KO undercount

**Context.** The end-of-battle summary logs only a unit's *first* KO, not subsequent KOs after revival. With Templar Raise and Phoenix Down, units now get knocked down, revived, and knocked down again routinely, so the summary undercounts.

**Work.** Track all KO events, not just the first per unit, in the end-of-battle summary.

**Acceptance.** The summary reflects every KO event, including re-KOs after revival.

**Watch-fors.** Confirm the counting semantics with Chris if ambiguous — count of KO *events* (a unit downed three times = 3) vs. distinct units downed at least once; "subsequent KOs" implies the former. Soft coupling: this and the log redesign both touch KO eventing — separable, but if the log work restructures how KO events are emitted, coordinate so they read the same source rather than forking.

**Decision status.** Settled and clean; confirm counting semantics on review.

---

## Shared workflow notes

- Plaintext-review gate before any build, per usual.
- Items A and C are audit-first: report findings (Taunt's behavior; Brine's current value + proposed bump) before/instead of committing changes, and route the resulting decision to Chris.
- Items B and D are settled; B carries a playtest follow-up (AI use of the buffed abilities), D carries a semantics confirmation.
- Mid-session design questions route to Chris.

## Out of scope

- The log redesign itself is specced separately (`session-action-log-brief.md`); this brief only cross-references it.
- Any Taunt redesign/replacement (this session is audit-only for Taunt).
- SP recalibration for the Calculator abilities (the buff is intentional).

## Estimated size

- Item A (Taunt audit): small — investigation + writeup, no build.
- Item B (Calculator faith): small — a scoped magnitude change, plus a confirming playtest.
- Item C (Brine): small — audit + a single tuned value.
- Item D (KO undercount): small — a well-defined summary fix.

Collectively a light batch, dwarfed by the log redesign. The natural shaping is the log redesign as its own session and these four as a cleanup pass — but that's the scope-and-schedule conversation for CC and Chris once the log audit lands.
