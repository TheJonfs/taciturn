# Session Brief — Thief (12th class) content build

*Operationalizes `thief-concept-notes.md`, which is the authoritative design spec
(stats, gear, the four actives, the Steal Heart formula, the three RSM passives, deferred
items, and the audit questions). This brief sequences the work; it does not re-decide the
design. Design was plaintext-reviewed in conversation, so surface at a checkpoint only if
an audit materially reshapes something.*

## Context

The Thief is the roster's twelfth class and fifth physical — the resource-theft axis the
roster doesn't yet touch. It's being built **content-ahead-of-AI by choice**: its kit
leans on the self-state AI dimension (valuing buffs gained on self, valuing a charm
swing), which is a future AI-arc beat. Until that lands the AI will under-play those
parts — flagged in watch-fors, not a blocker.

Three chunks plus two independent side pieces, checkpointed. **Steal Heart's
control-override substrate is the keystone and the throttle-cut:** chunk 1 yields a fully
playable Thief without it, so if that substrate balloons, defer Steal Heart to a focused
follow-up rather than letting it sink the session.

## Inputs

- **`thief-concept-notes.md`** — authoritative spec. All numbers live there; don't
  duplicate, reference.
- Substrate to compose on: the S65 `{ brave, pa }` status-chance shape + PA_factor
  (ADR-0108); S66's extracted `computeAbilityChance` pure-compute (ADR-0109); the
  **Purifier** accessory's duration machinery (Slip Free); **Flow State** (Momentum
  parallels it); `move_plus_1` (Move +2); `system_mp` / `system_damage` channels
  (Steal MP drain/restore, Steal HP lifesteal); the status **polarity declarations**
  (`aiHints.polarity: 'buff'`) for the Steal Buffs filter.
- Portrait pipeline: sips + pngquant → 512×512.
- `docs/playtest-watch.md` (action-log entry to close).

## Goal

Ship a playable Thief per the spec, in dependency order:
1. Class skeleton + the three straightforward actives + the three RSM.
2. Steal Heart + the temporary control-override substrate.
3. Side pieces — Thief portraits to 512×512; action-log visual verification recorded.

Attempt all; throttle by deferring chunk 2 if its substrate surprises.

## Pre-implementation plan (audit first — from the spec's audit questions)

Resolve before building; report at the relevant checkpoint if an answer reshapes the work:
- **Steal Buffs** — is there a dispel / clear-specific-status primitive, or is it net-new?
  Confirm every stealable buff carries the polarity declaration; "neither" statuses
  (Stop / charging) must be excluded from the steal.
- **Steal MP** — confirm restore keys off MP *actually removed*, not nominal PA×3.
- **Steal Heart chance** — confirm the existing `{ brave, pa }` shape's `brave` term is
  the **caster's** (positive proc factor); the Thief introduces the **new**
  target-Brave-as-resistance form (the spec's tuned-additive formula) — define it
  explicitly.
- **Momentum** — is "non-magical action" cleanly the inverse of Flow State's magical-tag
  check (basic attack **included**, per the spec)?
- **Control-override (sizes chunk 2)** — does the engine separate unit-*controller* from
  unit-*team*, or is that net-new substrate? This answer determines whether chunk 2 is
  composition or real engine work.

## Implementation work

### Chunk 1 — Thief skeleton + straightforward kit  *(checkpoint after)*

- **Class def** per the spec stat table (HP 90 / MP 28 / PA 7 / MA 3 / Speed 11 /
  Brave 70 / Faith = current roster default / Move 3 / Jump 3 / evasion 8-4-0), universal
  gear access (same as the non-Knight/non-Templar physicals), `physical` tag.
- **Shared chance helper** — the tuned-additive formula `baseChance + 3·PA +
  0.5·(Thief_Brave − Target_Brave)`, clamp [1, 95], with target-Brave-as-resistance. Used
  by Steal Buffs now and Steal Heart in chunk 2 — build it once.
- **Steal HP** (5 MP): 75% weapon damage, heal 50% of damage dealt; evadable; heals only
  on damage actually dealt.
- **Steal MP** (3 MP): drain PA×3 MP, restore 50% of MP *removed*; evadable.
- **Steal Buffs** (4 MP): strip all positive-polarity statuses, apply all to the Thief;
  chance via the shared helper at baseChance 33.
- **RSM**: `Slip Free` (reaction, 1 pt — advance an applied debuff one tick; composes on
  Purifier machinery; Brave-gated); `Momentum` (support, 1 pt — small CT refund on any
  non-magical action incl. basic attack, magnitude matching Flow State); `Move +2`
  (movement, 2 pt — `move_plus` pattern).

### Chunk 2 — Steal Heart + control-override substrate  *(checkpoint after; throttle-cut)*

- **Control-override primitive** — temporary controller-decoupled-from-team for a
  duration. Build it as reusable substrate (future Confusion / Berserk consumers; note in
  the ADR).
- **Steal Heart** (24 MP): charm 3 turns; **gender-gated Male ↔ Female**; chance via the
  shared helper at baseChance 10; **50% chance to clear early on any damage**; post-revert
  immunity window to prevent chain-charm-lock.
- **Edge cases** (resolve, don't crash): Steal-Heart on the last enemy (win condition?);
  KO while charmed (whose loss?); revert timing mid-charge; damage the puppet dealt while
  charmed **persists** after revert.

### Chunk 3 — Side pieces  *(independent; survive a chunk-2 throttle)*

- **Portraits** — Thief portraits are in place but need cropping to square aspect ratio
  and downscaling to 512×512 (sips + pngquant pipeline). Process them.
- **Action-log verification** — Chris has confirmed the S63 action-log redesign (and the
  team-builder) read correctly in-battle. Record that confirmation in
  `docs/playtest-watch.md` (mark the action-log visual item verified/closed) so it stops
  recurring in handoffs.

## Acceptance criteria

- Class loads, is selectable, equips universal gear; stats match the spec.
- The three chunk-1 actives resolve to spec (drain/heal/strip math; Steal Buffs strips all
  true buffs and applies them to the Thief at the formula chance); the three RSM compose
  (Slip Free advances a debuff on application and is Brave-gated; Momentum refunds CT on
  non-magical actions including the basic attack; Move +2 → effective Move 5).
- Steal Heart charms a valid-gender target at the formula chance; the puppet acts for the
  duration; 50% break-on-damage; clean revert with persisted damage; edge cases resolved
  without crash; post-revert immunity holds.
- Portraits at 512×512; action-log item marked verified in playtest-watch.
- Full suite green; `tsc -b` + `vite build` clean; new ADR captures the Thief, the
  control-override substrate, and the new target-Brave-resistance chance form.

## Out of scope

- **Steal Equipment / Equip Change** — deferred to an inventory/campaign context.
- **Expansive Steal Heart targeting** — gender-gated v1 only.
- **AI valuation of the self-state kit** (buff-gain, charm) — a separate AI-arc beat; the
  AI will under-play these until then.
- The Thief's inclusion in default team templates / playtest battles — a follow-up once
  it exists.

## Files (hedged — audit confirms)

Content: class def, the four ability defs, the three RSM defs, the charm/control-override
status def, the shared chance helper. Engine: the control-override substrate; a
clear-specific-status (dispel) primitive if net-new. Assets: Thief portraits. Docs:
`playtest-watch.md`, a new ADR. Plus Vitest specs throughout.

## Workflow notes

- Checkpoint after chunk 1 and chunk 2.
- **Throttle:** if chunk 2's control-override surprises, ship the playable Thief (chunk 1)
  + side pieces (chunk 3); Steal Heart + control-override becomes a focused follow-up.
- Side pieces (chunk 3) are independent — do them opportunistically; they survive a throttle.
- Audit questions resolved at checkpoints; design is settled in the concept-notes.

## Watch-fors

- **PA-centric kit** — every active scales PA; confirm no double-scaling bugs (Steal MP
  reads PA correctly for both drain *and* restore-base).
- **Steal Buffs filter** — only `polarity: 'buff'` statuses; exclude "neither" (Stop /
  charging).
- **Steal MP restore** — 50% of MP *removed*, no free MP off a near-empty target, no
  overflow past the Thief's maxMP.
- **Steal Heart break** — fires on any damage incl. DoT / friendly-fire (v1 simple);
  charm is intentionally fragile — note in playtest-watch; restrict to original-team
  damage later if it reads random.
- **Control-override edge cases** (win / KO / revert) — the crash-risk surface; test hard.
- **Momentum magnitude** — small, matching Flow State; don't let basic-attack refund
  runaway tempo.
- **AI** — uses the legible parts (Steal HP damage+heal, Steal MP gain, Steal Heart
  target-by-value), under-plays buff-gain/charm; content-ahead-of-AI, flagged.

## Estimated size

Large — a full class introduction (blueprint → audit → substrate → class → polish). The
control-override substrate is the heavy, uncertain piece and the throttle-cut. The two
side pieces are small and independent.
