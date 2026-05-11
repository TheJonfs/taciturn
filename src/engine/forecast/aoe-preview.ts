// AoE per-target preview — given a caster + ability + anchor (where the
// player is hovering), returns the set of tiles the AoE would cover and
// the unit (if any) occupying each tile. Used by:
//   - The forecast hover tooltip (per-tile target identification).
//   - The forecast panel (per-target damage/status table for AoE casts).
//
// Mirrors the live `resolveAbilityTargets`' filter rules — exclude caster
// (when `excludeCaster` is set, the default), exclude friendlies (when
// ruleset.behaviors.friendlyFire is false), skip KO'd units — so the
// preview agrees with the actual cast. v1 keeps things simple: no
// runModifyAoeShape (Fire Mage's "larger AoE" rider lands in Phase B; for
// now the base shape is the shape).

import { aoeFootprint, cardinalFromTo } from '../map/aoe.ts';
import { tileAt, unitAt } from '../map/accessors.ts';
import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState, Position, Unit } from '../types/index.ts';

export interface AoePreviewTile {
  readonly position: Position;
  // The unit occupying that tile, if any. `null` for empty tiles within
  // the footprint.
  readonly occupant: Unit | null;
  // Whether this tile's occupant would actually be affected — false for
  // KO'd units, excluded casters, or friendlies under no-friendly-fire.
  readonly affected: boolean;
}

export interface ProjectAoePreviewArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly ability: ActiveAbilityDefinition;
  // Where the player is hovering — the prospective AoE anchor (target
  // tile or unit's tile). Used both as the geometric anchor for
  // `anchorMode: 'target'` shapes and as the direction reference for
  // caster-anchored cone/line shapes.
  readonly anchor: Position;
}

// Single-target abilities collapse to a one-tile preview (the anchor
// itself). AoE abilities expand through `aoeFootprint`.
export function projectAoePreview(
  args: ProjectAoePreviewArgs,
): ReadonlyArray<AoePreviewTile> {
  const aoe = args.ability.effects.aoe;
  if (aoe === undefined) {
    const occupant = unitAt(args.state, args.anchor.x, args.anchor.y, args.anchor.layer) ?? null;
    return [{ position: args.anchor, occupant, affected: occupant !== null && occupant.vitals.hp > 0 }];
  }

  const anchorMode = aoe.anchorMode ?? 'target';
  const anchorPos =
    anchorMode === 'caster' ? args.caster.position : args.anchor;
  const anchorTile = tileAt(args.state.map, anchorPos.x, anchorPos.y, anchorPos.layer);
  if (anchorTile === undefined) return [];

  const ruleset = args.catalog.getRuleset(args.state.ruleset.id);
  const verticalTolerance = aoe.verticalTolerance ?? ruleset.rangeDefaults.aoeVerticalTolerance;

  const direction =
    aoe.shape.kind === 'cone' || aoe.shape.kind === 'line'
      ? cardinalFromTo(args.caster.position, args.anchor)
      : undefined;

  const tiles = aoeFootprint({
    map: args.state.map,
    anchor: { x: anchorPos.x, y: anchorPos.y, elevation: anchorTile.elevation },
    shape: aoe.shape,
    verticalTolerance,
    ...(direction !== undefined ? { direction } : {}),
  });

  const excludeCaster = aoe.excludeCaster ?? true;
  const respectFriendlyFire = !ruleset.behaviors.friendlyFire;
  const seen = new Set<string>();
  const out: AoePreviewTile[] = [];
  for (const tile of tiles) {
    const position: Position = { x: tile.x, y: tile.y, layer: tile.layer };
    const key = `${position.x},${position.y},${position.layer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const occupant = unitAt(args.state, position.x, position.y, position.layer) ?? null;
    const affected =
      occupant !== null &&
      occupant.vitals.hp > 0 &&
      !(excludeCaster && occupant.id === args.caster.id) &&
      !(respectFriendlyFire && occupant.team === args.caster.team && occupant.id !== args.caster.id);
    out.push({ position, occupant, affected });
  }
  return out;
}
