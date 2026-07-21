# ADR-0159 — Cartographer Tier 3: per-enemy kit, loadout, and gear overrides

**Session:** S98, continued (2026-07-21)
**Status:** Accepted
**Predecessors:** ADR-0157 (Tier 1), ADR-0158 (Tier 2 — which had deferred this)

## Context

ADR-0158 shipped lineup enemies as `class + level` with everything else framework-framed, and
deferred per-enemy control to hand-authored `AuthoredEnemySpec`s. Chris asked for the next step:
explicit control of earned JP, learned and equipped abilities, and equipment, in-tool. The
campaign substrate already supported all of it (the named-unit path); the work was format +
tool.

## Decisions (Chris's four calls)

1. **JP is a dial AND explicit picks, with the honest semantics surfaced:** enemies have no JP
   wallet — `earnedByClass` is empty and only `unlocks` gates anything — so "earned JP" is
   either an input (`jpBudget`: curriculum prefix at that budget, decoupled from level) or an
   output (the sum of explicitly picked components' costs, always displayed). Explicit picks
   win over the dial; both win over the level default.
2. **Full loadout editor:** secondary command set (any other class; its components join the
   explicit picker, since unlocking its actives is what makes the set usable) plus R/S/M
   passive buckets. Class innates still merge in on top, deduplicated — the same
   `withInnatePassives` every campaign-created unit gets.
3. **Full gear catalog, † on pool-managed items:** every catalog item passes through
   `slotIneligibilityReason` per class/slot; hidden (TABA pool) gear is offered but marked —
   authored bosses wielding uniques is a design lever, and the standing "AI undervalues exotic
   effects" note rides the marker.
4. **Riders included:** per-enemy name, Brave/Faith (band-roll placeholders shown), gender.

## Architecture

- `EnemyOverrides` on `EnemyLineupSlot` (`lineup-format.ts`), all fields optional = framework
  default. Unlock refs are a **structural** `{kind, id}` twin of the campaign's `UnlockToken`
  (content cannot import campaign; `unlockRefToToken` brands on consumption, including the
  numeric `mathValue` cases).
- **One composer:** `composeLineupEnemyDraft(slot, catalog)` builds the loadout/equipment/
  unlocks exactly as `enemiesFromLineup` ships them, and is what BOTH the tool's validation and
  the editor's live legality echo run through the engine's `validateDraftUnit` — slots,
  cost-weighted equipment-aware capacity, two-handed grips, the dual-wield UI-tier block, and
  `equipLegality` conflicts all gate export. Nothing tool-side re-implements a rule.
- `enemyKitForBudget` extracted from `enemyKitForLevel` (which now delegates) — the dial is the
  same curriculum-prefix walk.
- Codegen emits `overrides` in fixed field order, only authored fields; the compiled round-trip
  fixture gained an overridden enemy so the byte pin covers the new shape.
- **Unit-restricted signature components** (Hamstring et al.) are excluded from the picker and
  rejected by validation — unit identity stays hand-authored in node-content.

## Acceptance evidence (browser-verified)

A monk lead authored in-tool: renamed, Brave overridden, kit switched to explicit picks (the
picker showing monk components with costs plus Pyromancer's after the secondary was set — a
secondary-class active added to the kit), gear switched to custom with a legality-filtered
accessory. The class-rule filtering was confirmed against the real definitions (monk hands and
armor slots correctly offer nothing). Live legality echo and validation strip stayed green, and
the export emitted the overrides block canonically. Suite 3043, `tsc -b` clean; the
composer/fold parity and override mapping are test-pinned (`lineup.test.ts`).

## Consequences

- A tool-authored lineup can now express named minibosses end to end; the hand-authored
  `AuthoredEnemySpec` path remains for unit-restricted kits and anything the format doesn't
  model (per-unit portraits, death protection — those stay node-content riders).
- The Formation/Team-Builder legality surface gained a third consumer; changes to
  draft-legality now show up in the tool automatically.
