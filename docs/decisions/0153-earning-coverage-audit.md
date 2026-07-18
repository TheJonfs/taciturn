# ADR-0153: The earning-coverage audit — one rule, one registry, one table

**Status:** Accepted (2026-07-18, Session 95)

**Context:** Chapter 1 playtest surfaced earning bugs one per session (rider
double-earn, Compound zero, displacement zero, Math-CT zero — ADR-0151/0152).
Each was an existing ability whose effect shape the earning predicate silently
mishandled — the same silent-dispatcher architecture the AI scorer had before
its S89 sweep. This session ran the equivalent systematic sweep for earning
(the S95 brief's WI1), with two design rulings from Chris up front.

## Ruling 1 — the earning rule

**A connecting action earns XP iff it changed something other than the
caster's own bookkeeping.** Changes to other units count; changes to the
WORLD (terrain, barriers) count the same — terraforming is the main thing a
Terraformer does. The caster's own MP, position, and CT are bookkeeping and
never earn (heal-on-full, self-move, self-refunds stay non-earners; the
anti-grind guard stands). MP cost and enemy pressure are accepted as the
farm limiter, as in FFT's own hit-your-allies economy.

## Ruling 2 — JP follows XP

XP semantics win; JP must not re-derive its own predicate. `computeEarnedJp`
now keys off the engine's generated `system_xp_award` log entries — one
award to a roster unit = one connecting action (base(rosterLevel) + 1/8
spillover, amounts unchanged; awards to leveling enemies/guests pay nothing
via the roster filter). The hit-based `defaultConnectingPredicate` is
deleted; two registries can no longer disagree.

## What the executable audit found (earning-coverage.test.ts)

Six silent zero-earns, one systemic over-earn — all fixed, all pinned:

1. **Worldcraft casts** — `resolveWorldcraft` bypassed the award site
   entirely. Now vouched by the pending `system_terrain_change` /
   `system_barrier_change`.
2. **Barrier attacks (single-target route)** — `resolveBarrierAttack`
   bypassed the site (the AoE fold already earned via tile damage — the two
   routes disagreed). Now awards; destroying denial is a battlefield change.
3. **Bear's Heave** — the S94 "displacement is an effect" fix covered
   knockback *riders*; the real grapple-throw path never called the award
   site. Now awards off the throwee's position change; repeat heaves earn.
4. **Steal MP** — the drain lands as a generated `system_mp_drain` the
   before/after diff can't see. The S94 CT-push vouch is generalized to
   `pendingGeneratedEffectLanded` (ct_push + mp_drain + mp_restore,
   target-ward only, drainee-has-MP / restoree-has-headroom gated).
5. **Chakra ally-refuel** — same generated-action blindness
   (`system_mp_restore`); pure self-refuel stays a non-earner (bookkeeping).
6. **Tide Surge** — the S94 vouch existed only at the instant/Math award
   site; the charged-resolve site never got it.
7. **Over-earn: EVERY charged resolve earned regardless of effect** —
   `finalizeResolution` removes the caster's Charging status inline, which
   the diff read as "the caster changed." Total-miss nukes and no-op
   cleanses all earned since M2. The charged award site now excludes the
   Charging type id from the caster's status diff.

**Known limitation (accepted):** a lethal displacement (heave/knockback into
a fall) KOs via the generated fall-damage action, so the thrower never
receives the +KO bonus. Consistent across both displacement shapes; noted in
the coverage table.

## The display ride-along (third registry)

`formatItemDetail`'s sweep method is a field-list diff: item-definition
fields vs detail arms. Two gaps found and fixed — `pierces` (all five
lances hid the 2-tile line since S62) and `sourceAbilityTagAny` (Prism
Wand's gate rendered "all casts"). Every mechanical field now has an arm.

## The durable artifact

`docs/design/ai-substrate.md`'s discriminant table is now the MERGED
coverage table (AI-scores × earns-XP/JP, with the display registry's method
documented alongside) — the checklist for any new effect shape, so a future
discriminant can't be silently missed by any of the three registries.

## Also this session (S95 WI2–4)

- **Stock-refresh notification** (required companion to refresh waves, per
  the revised economy §5): `CampaignState.shopStockSeen` (optional, lenient
  load) stamped on arrival + beat-clear; `nodesWithUnseenStock` → the Road
  Ahead's "new stock!" badge, persisting until the hub is revisited; one
  authored aftermath line at each Ch1 trigger (Old Ordal, Mount Eska).
- **Road Ahead footprint** decoupling confirmed (own 680px style, no
  battle-map tie) and expanded to min(1080px, 94vw), SVG height clamped.
- **Guest placard** ("Ally's turn — <name>") and the per-hub shop subtitle.
