// Cartographer — model → export specs. One place builds the LineupSpec the
// codegen, preview, and export overlay all share, so key/mapKey derivation
// can't drift between them (the tool emits key === mapKey === the map's key;
// the format itself allows divergence for hand-organized content).

import type { LineupSpec } from '@content/battles/lineup-format.ts';
import type { CartographerModel } from './model.ts';

export function lineupSpecFromModel(model: CartographerModel): LineupSpec {
  const lineup = model.lineup;
  if (lineup === null) {
    throw new Error('lineupSpecFromModel: no lineup authored');
  }
  return {
    key: model.spec.key,
    mapKey: model.spec.key,
    battleId: lineup.battleId,
    players: lineup.players,
    guests: lineup.guests,
    enemies: lineup.enemies,
  };
}
