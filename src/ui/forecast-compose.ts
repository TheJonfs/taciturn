// Forecast composer — pure function that assembles the engine's forecast
// queries (damage range, status chance, AoE per-target preview, CT
// preview) into a single payload the forecast panel and tooltip read.
//
// The panel renders the full payload; the tooltip renders a compact
// per-tile slice. Both consume the same data structure so the two
// surfaces never disagree.

import {
  computeAbilityRange,
  computeMpCost,
  computeOutgoingHitChance,
  estimateChargedTiming as engineEstimateChargedTiming,
  projectAoePreview,
  projectDamageRange,
  projectStatusChances,
  projectTurnEndCt,
  runModifyStatQuery,
  type ActiveAbilityDefinition,
  type AoePreviewTile,
  type Catalog,
  type DamageRange,
  type GameState,
  type Position,
  type ProjectedEvent,
  type StatusChanceForecast,
  type Unit,
} from '@engine/index.ts';

// Per-target row in a forecast (one row per AoE-affected unit; single-
// target abilities produce exactly one row, when the anchor lands on a
// unit).
export interface ForecastTargetRow {
  readonly position: Position;
  readonly unit: Unit | null;
  // True when this tile's occupant would be hit by the ability (false
  // for excluded caster, friendly under no-friendly-fire, KO'd units).
  readonly affected: boolean;
  // Current HP / max HP for the target unit. Snapshot at compose time
  // (live as the cursor moves between targets). Used by the forecast
  // panel to render "HP X/Y" alongside the damage range, so the player
  // can see "this 17-23 dmg hit takes them from 33/44 to 10/44 — KO?"
  // at a glance. `null` for tile-only rows (no unit on the cell).
  readonly hp: { readonly current: number; readonly max: number } | null;
  // Filled when affected and damaging.
  readonly damage?: DamageRange;
  // Status chances per declared effect on the ability.
  readonly statusChances: ReadonlyArray<StatusChanceForecast>;
  // Per Session 30 fold-in: effective hit chance for this target,
  // already composed through caster (Arcane Lens) and target (Blind,
  // Steel Helm) hooks and clamped to [0.05, 1.0]. Omitted for
  // auto-hit and non-physical damage; the renderer reads `undefined`
  // as "always lands."
  readonly hitChance?: number;
}

// Charged-action timing forecast — present only when the hovered
// ability is charged (`actionSpeed > 0`). Surfaces how many events fire
// between commit and resolution, and (when known) whether the target's
// next turn lands before or after the spell resolves.
//
// Session 26.5 (item #3): computed via the engine's `estimateChargedTiming`
// which walks the CT schedule (including other in-flight charges) rather
// than the pre-26.5 naive `ceil(actionSpeed / casterSpeed)`. Carries the
// surrounding-event window for the forecast mini-timeline (item #7) so
// the UI doesn't recompute.
export interface ChargedTiming {
  // Ticks until the spell resolves in the walked schedule.
  readonly ticksToResolve: number;
  // How many events fire before the spell would resolve. 0 means the
  // spell fires first.
  readonly eventsBeforeResolve: number;
  // The target's next turn, if visible in the projection. `null` when
  // not visible within the horizon.
  readonly targetNextTurn: { readonly event: ProjectedEvent; readonly index: number } | null;
  // True when the spell resolves before the target's next turn (the
  // "good outcome" — target can't move out of the way).
  readonly resolvesBeforeTargetTurn: boolean | null;
  // Surrounding-event window (~7 events centered on the resolve) for
  // the mini-timeline render. Session 26.5 (item #7).
  readonly surroundingEvents: ReadonlyArray<ProjectedEvent>;
  // 0-indexed position of the resolution event inside `surroundingEvents`.
  readonly resolutionIndex: number;
}

export interface Forecast {
  readonly caster: Unit;
  readonly ability: ActiveAbilityDefinition;
  readonly anchor: Position;
  // All footprint tiles, in the order `projectAoePreview` returned them.
  readonly tiles: ReadonlyArray<AoePreviewTile>;
  // Per-affected-target damage + status chances, derived from `tiles`.
  // One row per affected target; empty for casts at empty tiles.
  readonly targets: ReadonlyArray<ForecastTargetRow>;
  // End-of-turn CT if the player committed this ability with current
  // budget. `null` for charged casts (the turn ends but CT cost varies
  // per the spec; surface only when meaningful for v1).
  readonly endOfTurnCt: number;
  // Caster MP after this cast. Drives the "MP: x → y" forecast line.
  readonly casterMpAfter: number;
  // Set when `ability.actionSpeed > 0`. `null` for instant casts.
  readonly chargedTiming: ChargedTiming | null;
  // Per Session 30 fold-in: effective ability range after equipment /
  // status / passive `modifyAbilityRange` contributors compose. The
  // forecast panel renders "Range: HxV"; per Chris's design call, the
  // displayed numbers are the effective values with no base+bonus
  // annotation (Wand of Depths' +1 on water spells just shows the
  // already-+1 number when targeting a water spell).
  readonly effectiveRange: { readonly horizontal: number; readonly vertical: number };
}

export interface ComposeForecastArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly ability: ActiveAbilityDefinition;
  readonly anchor: Position;
}

export function composeForecast(args: ComposeForecastArgs): Forecast {
  const tiles = projectAoePreview({
    state: args.state,
    catalog: args.catalog,
    caster: args.caster,
    ability: args.ability,
    anchor: args.anchor,
  });

  const targets: ForecastTargetRow[] = [];
  for (const tile of tiles) {
    if (tile.occupant === null) continue;
    const hp = computeUnitHp(args.state, args.catalog, tile.occupant);
    if (!tile.affected) {
      // Surface unaffected occupants too so the UI can render "—" for
      // them; helps the player see the AoE shape without hiding
      // excluded units.
      targets.push({
        position: tile.position,
        unit: tile.occupant,
        affected: false,
        hp,
        statusChances: [],
      });
      continue;
    }
    const damage =
      args.ability.effects.damage !== undefined
        ? projectDamageRange({
            state: args.state,
            catalog: args.catalog,
            attacker: args.caster,
            target: tile.occupant,
            ability: args.ability,
            targetCount: tiles.filter((t) => t.affected).length,
          })
        : undefined;
    const statusChances = projectStatusChances({
      state: args.state,
      catalog: args.catalog,
      caster: args.caster,
      target: tile.occupant,
      ability: args.ability,
    });
    // Effective hit chance — caster + target hook chains composed,
    // clamped to [0.05, 1.0]. Returns 1.0 for auto-hit / non-physical
    // (the renderer reads `hitChance === 1` as "always lands" and can
    // omit the row when desired).
    const hitChance = computeOutgoingHitChance({
      state: args.state,
      catalog: args.catalog,
      attacker: args.caster,
      target: tile.occupant,
      ability: args.ability,
    });
    targets.push({
      position: tile.position,
      unit: tile.occupant,
      affected: true,
      hp,
      ...(damage !== undefined ? { damage } : {}),
      statusChances,
      hitChance,
    });
  }

  // CT projection: act after whatever's already been consumed.
  const endOfTurnCt = projectTurnEndCt({
    state: args.state,
    catalog: args.catalog,
    unit: args.caster,
    plannedNext: 'act',
  });
  const casterMpAfter = Math.max(
    0,
    args.caster.vitals.mp - computeMpCost(args.state, args.catalog, args.caster.id, args.ability.id),
  );

  // Charged-action timing — surface the queue position the charged
  // resolution would land at and (when targeted on a unit visible in
  // the projection) whether it resolves before the target's next turn.
  const chargedTiming = args.ability.actionSpeed > 0
    ? estimateChargedTiming(args, tiles)
    : null;

  // Effective range — equipment modifiers (Wand of Depths' +1 on water
  // spells) compose through `computeAbilityRange`. Forecast renders the
  // already-modified numbers, no base+bonus annotation.
  const effectiveRange = computeAbilityRange(args.state, args.catalog, args.caster.id, args.ability);

  return {
    caster: args.caster,
    ability: args.ability,
    anchor: args.anchor,
    tiles,
    targets,
    endOfTurnCt,
    casterMpAfter,
    chargedTiming,
    effectiveRange: { horizontal: effectiveRange.horizontal, vertical: effectiveRange.vertical },
  };
}

// Snapshot a unit's current HP and computed maxHp at compose time. The
// max read goes through `runModifyStatQuery` so passives / equipment /
// statuses that shift maxHp are reflected in the forecast.
function computeUnitHp(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
): { current: number; max: number } {
  const max = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxHp',
    baseValue: unit.baseStats.maxHpBase,
  });
  return { current: unit.vitals.hp, max };
}

// Thin caller into the engine's `estimateChargedTiming` (item #3,
// session 26.5). Picks the "concerned target" from the AoE preview to
// drive the ✓/✗ vs-target-next-turn line. Post-S38 (2026-05-17): the
// previous "first affected" heuristic pinned the comparison to the
// alphabetically-first unit ID in the footprint, so hovering different
// units inside an AoE didn't refresh the check. The new heuristic
// prefers the unit AT the hover anchor (the one the cursor is actually
// over), falling back to the first affected unit when the anchor tile
// is empty (e.g. tile-mode cast on bare ground that still catches
// nearby units in the footprint). Returns `null` when the engine
// can't project (caster paused, horizon too short).
function estimateChargedTiming(
  args: ComposeForecastArgs,
  tiles: ReadonlyArray<AoePreviewTile>,
): ChargedTiming | null {
  const anchorTile = tiles.find(
    (t) =>
      t.position.x === args.anchor.x &&
      t.position.y === args.anchor.y &&
      t.position.layer === args.anchor.layer,
  );
  const affectedTarget =
    (anchorTile?.affected ? anchorTile.occupant : null) ??
    tiles.find((t) => t.affected)?.occupant ??
    null;
  const result = engineEstimateChargedTiming({
    state: args.state,
    catalog: args.catalog,
    caster: args.caster,
    ability: args.ability,
    anchor: args.anchor,
    ...(affectedTarget !== null ? { concernedUnitId: affectedTarget.id } : {}),
  });
  if (result === null) return null;
  return {
    ticksToResolve: result.ticksToResolve,
    eventsBeforeResolve: result.eventsBeforeResolve,
    targetNextTurn: result.targetNextTurn,
    resolvesBeforeTargetTurn: result.resolvesBeforeTargetTurn,
    surroundingEvents: result.surroundingEvents,
    resolutionIndex: result.resolutionIndex,
  };
}
