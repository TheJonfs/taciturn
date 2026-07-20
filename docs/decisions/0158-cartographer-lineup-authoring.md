# ADR-0158 — Cartographer Tier 2: battle-lineup authoring (the unit mode)

**Session:** S98, continued (2026-07-20)
**Status:** Accepted
**Predecessor:** ADR-0157 (Cartographer Tier 1 + MapSpec migration)

## Context

The map-authoring brief designed enemy-party placement in as the Cartographer's second canvas
mode: per unit a class + level + position + facing, kits auto-assigned via the `enemy-kit.ts`
framework, exported as a battle **lineup** referencing a map — separate data from the map
template, since maps are reused. An audit of the placement/fold chain established the design
constraints: `UnitPlacement.facing` is **required and never defaulted** (template slots are the
facing source of truth for AI units end-to-end); campaign story battles re-skin template enemy
slots **by index** (`foldEnemyTeam`, lead = slot 0, specs ≤ slots); guests are guest-flagged
player-team slots re-skinned the same way; and a battle template's real contribution beyond the
base config it spreads is map + ordered positions/facings.

## Decisions

### 1. The lineup is a generated battle-template module, split across the layer boundary

`LineupSpec` (`src/content/battles/lineup-format.ts`): ordered player staging + guest markers +
enemy slots, each `{x, y, layer, facing}`, enemy slots adding `{classId, level}`. One spec, two
consumers on the correct sides of the content/campaign boundary:

- **Content** (`buildBattleFromLineup`) consumes only the spatial half: it restages the base
  config's fixture units onto the slots (guests become guest-flagged clones; enemy slots past
  the base count synthesize fresh ids) — exactly what hand-written `STARTING_POSITIONS`
  templates did. Fixture identities remain placeholders.
- **Campaign** (`enemiesFromLineup`, `src/campaign/lineup.ts`) consumes the identity half:
  the class/level list becomes `NodeBattle.enemies` specs, index-aligned with the slots.
  Content cannot import `enemy-kit.ts` (wrong dependency direction), which is why the kit
  framing lives campaign-side.

The generated module (`src/content/battles/<key>-battle.ts`) exports the spec as a runtime
value plus the built `BattleConfig`; imports use aliases so the round-trip fixture can live
outside `content/battles`. Byte-identical round-trip is pinned by a **compiled** fixture module
(`lineup-fixture-battle.ts` — both `?raw` bytes and a value import, so the emitted shape always
type-checks and builds).

### 2. One enemy constructor for authored and generated parties

The skirmish stub's per-unit construction was extracted into
`generatedEnemyUnit(...)` (`enemy-kit.ts`): class first-action set + innate passives,
level-budgeted curriculum kit, deterministic Brave/Faith, basic gear. `generateSkirmishParty`
and `enemiesFromLineup` both call it; a parity test pins that an authored enemy and a skirmish
generic of the same class/level/index differ only in id/name. One framework, two callers — the
M4 "real generator" seam is unchanged.

### 3. Scope calls (Chris)

- **The six shipped Mage War battle files stay hand-written** — the tool generates battle files
  for new maps. `river_ridge` is reserved outright (it is the base every lineup spreads;
  self-import); surfaced as a validation error gating Export, not a codegen crash.
- **Player staging + guest markers are in scope** alongside enemies — a tool-authored template
  is complete, and `withGuestSlot` becomes unnecessary for tool-authored battles.
- **Kit/equipment override per enemy stays deferred** (the Atlas enemy-depth parallel); the
  hand-authored `AuthoredEnemySpec` path in node-content is the escape hatch.

### 4. Order is data

Enemy slot order is preserved verbatim through codegen (no row-major normalization, unlike zone
tiles) because the fold maps specs to slots by index — the tool marks slot 0 with a gold lead
ring and provides reordering. Named units re-skin the lead slot via
`[theoRenault(...), ...enemiesFromLineup(spec, catalog).slice(1)]`.

### 5. The preview runs the real campaign chain

With a lineup authored, the preview builds `buildBattleFromLineup` → `enemiesFromLineup` →
`foldEnemyTeam` → `createInitialState` — the authored classes render as their actual sprites at
their tiles with their facings. No preview-only unit path exists to drift.

## Acceptance evidence (browser-verified)

Lineup authored in-tool on a renamed River Ridge (5 staging slots, monk/knight/pyromancer
enemies with the monk reordered to lead), chips + facing wedges + lead ring rendering, live
validation catching the reserved-key case, preview showing the folded real sprites, and the
export overlay emitting all three files (map, registry, lineup module). Suite 3037 green,
`tsc -b` clean. Format/fold behavior pinned by `lineup-format.test.ts`, `lineup.test.ts`
(incl. skirmish parity), and the codegen fixture round-trip.

## Consequences

- A tool-authored node needs no hand battle-template file: generated lineup module + registry
  entry + `enemiesFromLineup` in node-content.
- `SHIPPED_LINEUPS` in `cartographer/import.ts` is the reload registry — one import line per
  shipped lineup, same convention as `SHIPPED_MAP_SPECS`.
- Lineup enemies are always framework-framed; bespoke kits remain node-content authored.
