# ADR-0152: Chapter 1 playtest batch two — four fixes, the enemy-kit framework, battle-end pacing

**Status:** Accepted (2026-07-14, Session 94 continued)

**Context:** Chris's Chapter 1 speedrun surfaced eleven items: four real
bugs, two UI corrections, a design framework for generated enemies, and a
presentation change. All shipped in this batch.

## Bug fixes

**Rider casts no longer earn XP/JP (the double-award).** A weapon
`attackProc` (Wand of Lumen Resonance) is a generated `use_ability`
attributed to the attacker, so `buildXpAward` paid it a second time and
`computeEarnedJp`'s connecting predicate counted it again — one attack, two
`+11 XP · +10 JP` lines, both real. Both sites now exclude
`riderSource !== undefined`, parallel to the existing reaction exclusion:
the weapon acts, not the wielder. One action, one award.

**The delivery-action rule (Compound/Throw Item lockout).** `compound` and
`throw_item` are neither class `freeAbilities` nor JP components — they
exist only as Alchemy command-set members, so `usableActiveIds` could never
emit them and the allowlist stranded them (an Alchemist with Potion
unlocked couldn't throw it; a Knight wielding Alchemy as a secondary was
equally blocked). `usableActiveIds` now also unions the NON-component
members of every wielded command set: structural verbs ride the set;
gated members (Scorch) still require their unlock; item resource gating
stays on `usableItems`.

**Battle-less resolutions commit immediately (the vanishing Oskun).**
`resolutionRun` embedded the resolved awaiting_route state only in the
run's completion callback; the driver's live state stayed pre-scene until
the player picked a route. A Manage Roster detour from the first world map
rebuilt the map from that stale state — no Oskun, scene re-armed. A small
effect now commits (setState + save) the resolved snapshot as soon as its
route-run shows; the battle path already did the equivalent in
handleBattleEnd.

**Pixi canvas-text double-free.** `elevation-label-layer` destroyed its
Text children with `{ texture: true, textureSource: true }` (an S50 memory
mitigation) — but canvas-text textures are POOL-managed by Pixi's
CanvasTextSystem, which also returns them on unload; the double-return
corrupted the TexturePool bucket (`returnTexture: cannot read 'push'`).
Plain `destroy()` now; the pool + texture GC own the bitmap lifecycle.

## The enemy-kit framework (new)

Generated enemies previously received the FULL class starting kit at any
level (an L2 Hydrologist with Tidal Wave). Now (`enemy-kit.ts`):

- **Kit = a curriculum prefix sized by level:** budget `level ×
  ENEMY_JP_PER_LEVEL` (economy-config dial, placeholder 100), spent down
  the class's active-side component list in authoring order, stopping at
  the first unaffordable component. Passives are skipped (innates already
  arrive equipped); restricted signatures never spawn on generics.
- **Brave/Faith roll the players' 50–70 band,** deterministically (hashed
  from level + slot index) so same inputs still build the same party —
  true per-encounter variance stays with the M4 generator.
- **Basic gear:** a Dagger wherever the class may legally hold one
  (legality-resolved, like the hire kit).

Named story units (Theo, Wiegraf, the Ruk captain) stay hand-authored.
The M4 real generator inherits the budget dial; per-node authored
equipment/kit overrides remain future authoring surface.

## Presentation and UI

- **The winning action animates out:** BattleView's battle-end effect
  polls the renderer's animator and fires `onBattleEnd` only once the
  queue drains, plus a 600ms linger. No-renderer callers keep the old
  immediate timing.
- **Gendered name pools:** rolled generics draw a name from the pool
  matching their rolled gender (no more female-named male Monks); hires
  draw from their class-default gender's pool. Formation deploy cards and
  manage-roster cards show ♀/♂ beside the class.

## Consequences

- Suite 2879 → 2885; `tsc -b` clean. Browser-verified: the Manage Roster
  round-trip keeps the frontier; console clean.
- Replay note: the rider-award change alters generated-action streams for
  NEW battles only (fewer `system_xp_award`s); determinism within a code
  version is unchanged.
- Open watch: `ENEMY_JP_PER_LEVEL = 100` and the curriculum-prefix policy
  are the first draft of "how strong is a generated enemy's kit" — tune
  with the offset curve. Story-lineup EQUIPMENT authoring beyond the
  Dagger floor is still M4 surface.
