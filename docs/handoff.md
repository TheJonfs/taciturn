# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 54 close (2026-05-30) — Terraformer class content

The full Terraformer class landed on the S53 substrate (ADR-0088), in seven
commits to `main`. **1562 → 1605 tests** (+43), `tsc -b` clean, browser-verified
in the team builder. The arc is now **S53 substrate → S54 class → S55 AI + UI**.

### What landed (committed to main)

1. **Worldcraft command set + 5 abilities + cast-resolution substrate.** New
   `AbilityEffects.worldcraft` spec (`elevation` | `barrier`) carries the
   mutation as content data; a Worldcraft cast resolves through
   `resolveWorldcraft` (a dedicated path parallel to `selfMove`), emitting
   `system_terrain_change` / `system_barrier_change` + enqueuing via
   `enqueueWorldcraftEffect` (LIFO-evict + revert). New `tile_set` AbilityTarget
   + TargetingSpec for the Barrier line; validation enforces straight H/V
   contiguity, length 3-5, range, and unoccupied/barrier-free placement.
2. **Terraformer ClassDefinition + R/S/M.** HP 105 / MP 35 / PA 6 / MA 8 /
   SPD 8, Move 2 / Jump 2, evades 6/3/0, `dominantStat: 'ma'`. Ignore Height
   (Movement 3 SP, jump→99) + Expert Former (Support 1 SP, cap +2); Damage
   Split wired into freeAbilities.
3. **Barrier damage routing.** `computeBarrierDamage` (attacker base offense, no
   variance/resistance); validateAction names barrier tiles damageable even for
   `single_unit`; single-target (basic Attack) + per-tile AoE both emit
   `system_barrier_damage`.
4. **Barrier TTL global tick (ADR-0089).** Ticks every `turn_start` across all
   units, owner-independent.
5. **Equipment.** Terraformer added to mage armor + headgear + Books'
   `classRestrictions`.
6. **Portrait + class-picker tagline.** Cropped 1696×2496 → top 1696² → 512²
   RGBA; "Battlefield-shaping geomancer".
7. **Docs + stale-comment fixes** (this commit).

### Decisions worth Chris's eyes

- **Move 2 = slow-caster tier, NOT a roster rebaseline.** The audit found the
  "Move 2 for most classes" rebaseline Chris recalled never landed: only
  Calculator / Geosage / Pyromancer / (now) Terraformer are Move 2; Knight, the
  two other mages, Alchemist, Assassin, Hunter are Move 3. Per your call,
  Terraformer is Move 2 (matches its tier) and I fixed only the three stale Move
  comments (calculator.ts claimed Knight was Move 2; water-/lightning-mage
  headers claimed Move 4). **Open: is the two-tier split intentional, or do you
  want a deliberate roster-wide Move pass?** (playtest-watch S54 entry).
- **Barrier-TTL cadence is per-turn** (ADR-0089), so `ttl` is in turn-starts,
  not rounds. Tuned to **`ttl: 50`** (Chris's call) ≈ 5 full rounds in a 5v5
  (~10 turn-starts/round) — the blueprint's intended lifetime. Lifetime scales
  inversely with party size; flagged in playtest-watch.
- **Engine-surface additions** (within established patterns, no new hooks/system
  actions): `AbilityEffects.worldcraft`, `tile_set` AbilityTarget/TargetingSpec,
  `computeBarrierDamage`. The three exhaustive `AbilityTarget` switches
  (`buildTargetRefs`, `resolveSingleTargetUnit`, `resolveAoeAnchor`) gained
  `tile_set` throw-cases — unreachable (Worldcraft short-circuits first).

### Browser verification (done)

Team builder confirmed live: Terraformer card with portrait + tagline; stats
105/35/6/8/8 render; Damage Split / Ignore Height / Expert Former present;
Books equippable; Worldcraft is the fixed first-action set (correctly absent
from the *secondary* list). No console errors. **Not click-driven:** an
in-battle Worldcraft cast (terrain mutate → fall damage → barrier spawn →
barrier take damage). Those exact code paths are covered by the 43 new tests
through the real catalog + reducers, but a manual playthrough is the right way
to get the playtest-watch *feel* signal (MP economy, barrier HP/TTL, eviction
legibility). The game dev server is `vite-dev` on **5173** via
`.claude/launch.json` (the S53 "stale guide on 5173" worry no longer applies).

### Deferred / carry-forward

- **S55: AI Worldcraft scoring** (blueprint §"AI scoring") and **Worldcraft UI
  polish** — target-select for elevation tiles + the Barrier line (the builder
  doesn't list command-set *members* by name; in-battle target UX is basic),
  effect-queue display, terrain-transition animation (instant redraw only).
- **OQ#6** (multi-Terraformer team queues) still open; **default team templates
  with Terraformer** still out of scope (content session).
- **Cross-class Worldcraft + Expert Former** build — worth a watch (playtest).
- **lightning-mage.ts header** still carries pre-retune S20 stats
  (spd/hp/mp) in its "session 20 plaintext review" block — I annotated it but
  didn't rewrite (out of S54 scope); a small cleanup if you want it accurate.
- **`docs/decisions/draft-terraformer-substrate-audit.md`** — ADR-0088/0089
  supersede it; safe to archive or leave as the survey record.
- All standing carries unchanged (Marshmoor template-compliance tests,
  Calculator team-template revision, AI deployment role-aware sorting, etc.).
