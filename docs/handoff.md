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

## From session 2026-05-06 (session 14: magical damage foundation)

### Suggested next-session scope

Session 15 — Charged action lifecycle. Per `docs/roadmap-sessions-14-20.md`, this is a heavy engine session: the ChargedAction entity, Charging status, the `actionSpeed > 0` UseAbility path, the interruption matrix (KO / Stop / Silence / Don't Act / damage / movement), engine-side `turn_end` auto-emit on active-unit KO (ADR-0013 deferred work), and the `'tile'` TargetingSpec validation. One throwaway charged ability for end-to-end coverage.

The session 14 substrate that session 15 inherits:
- **Magical damage handler ships and is exercised by tests** but no v1 content uses `'magical'` yet. Session 16's Earth Mage is the first content consumer; session 15's throwaway "Slow Spell" is the first *charged* spell and could be magical or status-only — author's call.
- **`'tile'` TargetingSpec still throws "not yet implemented"** in `validateAction`. Session 15 implements it for the charged-tile-AoE consumer (real per-target dispatch lands session 17 with the AoE work).
- **MP refund-on-fizzle** is the design rule (no refund). Session 15's interruption matrix is the first time this matters in code (today's instant abilities never fizzle). The current `reduceUseAbility` deducts MP unconditionally; the charged-action resolution path will need to preserve that "MP already spent at commit time, fizzle does nothing to vitals."
- **Engine-side `turn_end` auto-emit on active-unit KO** is on session 15's plate per the roadmap. The demo orchestrator currently guards against this with a defensive check; promoting to engine means any caller (replay, networked, headless) inherits it. ADR-0013's "deferred" status will get superseded by the new ADR.

### Things noticed during the session

- **Faith default placeholder discipline.** v1 units default to faith 80 (Faith_factor 0.64 for symmetric demo casts). The 80 value is documented in `engine/types/stats.ts` and `content/battles/demo.ts` as a v1 placeholder. When realistic Faith curves land per-class with content/tuning passes (sessions 16+), each class needs deliberate Faith values rather than inheriting 80 from the test fixture.

- **`HitRollSpec.accuracy` defaults to 100 (unarmed).** Knight's `attack` declares `hitRoll: {}` (no override → 100% accuracy before evasion). Equipment integration in session 17 (per ADR-0014) replaces this default with weapon-sourced accuracy. The session 17 expansion of session 14's Knight content will need to re-think `attack`'s accuracy — probably the equipped-sword-WP path provides accuracy, and the per-ability `accuracy` field becomes an override only.

- **All v1 classes have evasion 0/0/0.** Knight's evasion baseline is zero; today's `evasion_check` clamp at [0.05, 1.0] means even with `hit_chance` computing toward 1.0, *every* attack lands. The handler's logic exercises through tests with constructed evasive classes; no demo battle behavior changes from session 13. Session 17's Knight expansion + later Thief class are when evasion becomes real for content. Worth a consistency check at the start of session 16: if Earth Mage gets a non-zero side/back evasion baseline, the demo dynamics change subtly.

- **The `evasion` modifyStatQuery indirection is deferred.** ADR-0019 mentions a future `'evasion'` stat name in StatName. Session 14 reads class baseline directly. When Blind status ships in session 16, that's the first consumer that needs the `modifyStatQuery` layer — adding `'evasion'` to StatName and routing the read through the hook chain is a single-handler change at that point.

- **Brave roll seed sub-stream is 2.** Variance = 0, evasion = 1, brave-reaction = 2. Future seed-consuming subsystems (status application formula in session 16, crit roll in session 20) need new sub-stream constants. There's no central registry of these constants yet — they live in their respective handler files. Worth flagging if it becomes painful, but at 3 in-use today, it's fine.

- **Faith reads through `modifyStatQuery`.** v1 has no faith-modifying status, so the chain is identity. The hook surface is in place for Mediator-style faith manipulation later. Same shape applies to Brave (the Brave roll also reads through `modifyStatQuery`).

### Things considered but did not do

- **Implementing absorption (resistance > 100 → healing).** Considered both the tag-flip approach and an explicit `absorbed: boolean` flag on DamageContext. Rejected per ADR-0022 — no v1 content sets resistance > 100, so the path would be infrastructure ahead of consumer. Capped at 100 (immune) until the first content consumer arrives. Both shapes documented in the ADR for that future session.

- **Adding `'evasion'` to StatName.** Per the rationale above, deferred until session 16's Blind. The class baseline read is enough for v1.

- **Refactoring Counter to use ADR-0017's reaction compiler.** The compiler's first new consumer is Earth's Reaction in session 16 per ADR-0017's Implementation note. Counter's gate flip in session 14 is a behavior change that doesn't need the compiler; refactoring both at once would conflate two concerns. Counter stays hand-coded until session 16 lands the compiler with its worked example.

- **Updating the `damageDealt > 0` documentation in any other place.** Searched for the gate; the only consumer was Counter. Other reactions don't exist yet. Healing-tag check stays as the polarity filter.

### Open questions for later sessions (not blocking)

- **Should Counter's `'healing'` tag check be moved to the Brave roll or stay in the handler?** Today Counter's handler returns `[]` if the incoming damage is healing-tagged. The Brave roll is per-reaction and lives in the runner; the runner could in principle gate on damage tags, but that conflates "what the reaction is" with "did the reactor decide to fire." Leaving it in the handler is correct — the runner's only job is the Brave gate.

- **Reaction-cap semantics for missed-attack Counter.** Today the reaction cap (1 per turn) decrements when a reaction *commits*, not when it *attempts*. A Counter that fires against a missed attack still decrements the cap. That's reasonable but worth noting: a Brave 100 unit who's targeted by 4 missed attacks in a row will only Counter the first one (cap = 1). If FFT specifies different semantics here, surface it before session 18 lands more reactions.

- **Faith-floor for damage clamping.** Faith 1 / Faith 1 → factor 0.0001 → 0 effective damage from the floor in finalize. The Battle Mechanics Guide notes the range goes to 0.0001 minimum; if low-Faith encounters become a real test case (a Faith-0 status, an undead target with implicit Faith-1), the [1, 100] clamp ensures no division-by-zero, but a Faith-1 target would receive ~1% effective magical damage. Probably fine, but worth a sanity check against intent before session 16's Faith-modifying content lands.

- **`evasion` stat for Blind in session 16.** When Blind ships, it modifies hit chance — likely as a multiplier on `hit_chance` rather than directly on evasion. Worth thinking about: does Blind add an `'evasion'` modifyStatQuery handler (raises evasion percentage), or does it add an `onActionAttempted` / `modifyHitChance` hook (multiplies hit chance directly)? The Battle Mechanics Guide formula has `hit_modifiers` as a multiplicative term distinct from evasion; that suggests a separate hook. Surface in session 16 plaintext review.

### Notes for future ADRs

- When session 15 lands the engine-side `turn_end` on KO, ADR-0013's "deferred" status flips to "superseded." Add a back-reference from ADR-0013 to the new ADR.

- ADR-0022 (absorption deferred) gets superseded the session that lands resistance > 100 content. The follow-up ADR should reference both ADR-0022's documented shape choices (tag-flip vs explicit flag) and pick one based on what the consumer needs.
