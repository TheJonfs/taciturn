// The canonical battle-lineup spec — the shared substrate between generated
// lineup modules (Cartographer unit mode, S98 Tier 2) and the tool itself.
//
// A lineup is the SPATIAL half of a battle: an ordered set of slots — player
// staging, optional guest markers, and enemy slots — each carrying position +
// facing (facing is REQUIRED on UnitPlacement and never defaulted; for AI
// units the slot's facing is authoritative end-to-end). Enemy slots also
// carry an authored class + level, but note the layering:
//
//   - `buildBattleFromLineup` (here, content layer) consumes only the
//     positions/facings: it restages the base config's fixture units onto
//     the slots, exactly as the hand-written battle files restage
//     riverRidgeBattle via STARTING_POSITIONS. The fixture identities are
//     placeholders campaign play re-skins.
//   - The authored class/level list is consumed CAMPAIGN-side by
//     `enemiesFromLineup` (src/campaign/lineup.ts), which builds the
//     `NodeBattle.enemies` specs with level-budgeted kits via the enemy-kit
//     framework. It cannot live here — content must not import campaign.
//
// ENEMY SLOT ORDER IS MEANINGFUL: the campaign fold re-skins slots by index
// (lead = slot 0; `withLeadEnemySlot` and death-protection key off it), so
// the codegen preserves authored order — no row-major normalization here,
// unlike zone tiles.

import type {
  BattleConfig,
  BattleMap,
  Direction,
  UnitPlacement,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';

export interface LineupSlot {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
  readonly facing: Direction;
}

export interface EnemyLineupSlot extends LineupSlot {
  // Authored identity, consumed by src/campaign/lineup.ts (see header).
  readonly classId: string;
  readonly level: number;
}

export interface LineupSpec {
  // The lineup's own key — names the generated module and the battle
  // export. Usually equals `mapKey` (the tool emits them equal), but the
  // format keeps them distinct: a map is a reusable template and several
  // lineups may stand on it.
  readonly key: string;
  // The map this lineup stands on — a src/content/maps registry key.
  readonly mapKey: string;
  readonly battleId: string;
  readonly players: ReadonlyArray<LineupSlot>;
  readonly guests: ReadonlyArray<LineupSlot>;
  readonly enemies: ReadonlyArray<EnemyLineupSlot>;
}

const place = (
  proto: UnitPlacement,
  slot: LineupSlot,
): UnitPlacement => ({
  ...proto,
  position: { x: slot.x, y: slot.y, layer: slot.layer },
  facing: slot.facing,
});

// Restage a base config onto the lineup's slots. Player slot count must
// equal the base's (the deployment flow and campaign fold both assume the
// full staging exists); enemy slots beyond the base's count synthesize
// fresh placements by cycling the base enemies with new ids; guests clone
// the first player fixture with `guest: true` (the withGuestSlot pattern).
export function buildBattleFromLineup(
  spec: LineupSpec,
  map: BattleMap,
  base: BattleConfig,
): BattleConfig {
  const playerTeam = base.teams[0]!.id;
  const enemyTeam = base.teams[1]!.id;
  const basePlayers = base.units.filter((u) => u.team === playerTeam && u.guest !== true);
  const baseEnemies = base.units.filter((u) => u.team === enemyTeam);

  if (spec.players.length !== basePlayers.length) {
    throw new Error(
      `buildBattleFromLineup('${spec.key}'): ${spec.players.length} player slot(s) authored, ` +
        `but the base config stages ${basePlayers.length}`,
    );
  }
  if (spec.enemies.length === 0) {
    throw new Error(`buildBattleFromLineup('${spec.key}'): a lineup needs at least one enemy slot`);
  }

  const players = spec.players.map((slot, i) => place(basePlayers[i]!, slot));
  const guests = spec.guests.map((slot, i) => ({
    ...place(basePlayers[0]!, slot),
    id: unitId(`${spec.key}_guest_${i + 1}`),
    name: 'Guest',
    guest: true as const,
  }));
  const enemies = spec.enemies.map((slot, i) => {
    const proto = baseEnemies[i % baseEnemies.length]!;
    const placed = place(proto, slot);
    return i < baseEnemies.length
      ? placed
      : { ...placed, id: unitId(`${spec.key}_enemy_${i + 1}`) };
  });

  return {
    ...base,
    battleId: spec.battleId,
    map,
    units: [...players, ...guests, ...enemies],
  };
}
