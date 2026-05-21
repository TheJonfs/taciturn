import { classId, teamId, unitId, type BattleMap, type Tile } from '@engine/index.ts';
import { planAiDeployment, type DeployableUnit } from './deployment.ts';

const BLUE = teamId('team_a');
const RED = teamId('team_b');

// Build a small map with explicit deployment zones. `blueRows` / `redRows`
// are the y-rows tagged for each team; every listed column gets a ground
// tile. Untagged rows are plain ground (the central no-man's-land).
function zonedMap(args: {
  readonly width: number;
  readonly height: number;
  readonly blueRows: ReadonlyArray<number>;
  readonly redRows: ReadonlyArray<number>;
}): BattleMap {
  const { width, height, blueRows, redRows } = args;
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const zone = blueRows.includes(y) ? BLUE : redRows.includes(y) ? RED : undefined;
      tiles.push({
        x,
        y,
        layer: 0,
        elevation: 0,
        terrain: 'ground',
        properties: [],
        ...(zone !== undefined ? { deploymentZone: zone } : {}),
      });
    }
  }
  return { width, height, tiles };
}

function deployable(id: string, maxHP: number, klass: string): DeployableUnit {
  return { id: unitId(id), maxHP, classId: classId(klass) };
}

describe('planAiDeployment', () => {
  // 2-wide × 5-tall. Blue zone is the north row (y=0); Red zone is the
  // two south rows (y=3, y=4). Red's "front" is y=3 (nearer Blue).
  const map = zonedMap({ width: 2, height: 5, blueRows: [0], redRows: [3, 4] });

  it('places high-HP units forward (nearer the enemy), low-HP behind', () => {
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('bruiser', 80, 'monk'),
      deployable('skirmisher', 80, 'assassin'),
      deployable('support', 60, 'alchemist'),
    ];
    const { placements, unplaced } = planAiDeployment({ map, team: RED, units });

    expect(unplaced).toEqual([]);
    expect(placements.size).toBe(4);

    // The highest-HP unit lands in the front row (y=3, nearer Blue); the
    // lowest-HP unit lands in the back row (y=4). Exactly two per row.
    expect(placements.get(unitId('tank'))!.position.y).toBe(3);
    expect(placements.get(unitId('support'))!.position.y).toBe(4);
    const front = [...placements.values()].filter((p) => p.position.y === 3);
    const back = [...placements.values()].filter((p) => p.position.y === 4);
    expect(front).toHaveLength(2);
    expect(back).toHaveLength(2);
  });

  it('puts the single highest-HP unit on the front-center tile', () => {
    const units = [
      deployable('tank', 120, 'knight'),
      deployable('a', 50, 'monk'),
      deployable('b', 40, 'assassin'),
      deployable('c', 30, 'alchemist'),
    ];
    const { placements } = planAiDeployment({ map, team: RED, units });
    // Front center = own-zone tile closest to Blue centroid (0.5, 0):
    // (0, 3) by tile-order tie-break.
    expect(placements.get(unitId('tank'))!.position).toEqual({ x: 0, y: 3, layer: 0 });
  });

  it('faces every unit toward the opposing zone (Red faces north)', () => {
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('bruiser', 80, 'monk'),
      deployable('skirmisher', 70, 'assassin'),
      deployable('support', 60, 'alchemist'),
    ];
    const { placements } = planAiDeployment({ map, team: RED, units });
    for (const p of placements.values()) {
      expect(p.facing).toBe('N');
    }
  });

  it('breaks maxHP ties by class id ascending (deterministic)', () => {
    // Two units tied at 80; "assassin" sorts before "monk", so it takes
    // the better (closer-to-front) of the two contested tiles.
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('m', 80, 'monk'),
      deployable('a', 80, 'assassin'),
      deployable('support', 40, 'alchemist'),
    ];
    const { placements } = planAiDeployment({ map, team: RED, units });
    // tank → (0,3) front center. Next pick is the 'assassin' (class id
    // "assassin" < "monk"), which takes (1,3) — the remaining front-row
    // tile — leaving the monk to the back row.
    expect(placements.get(unitId('a'))!.position.y).toBe(3);
    expect(placements.get(unitId('m'))!.position.y).toBe(4);
  });

  it('is deterministic — same inputs, same plan', () => {
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('bruiser', 80, 'monk'),
      deployable('skirmisher', 80, 'assassin'),
      deployable('support', 60, 'alchemist'),
    ];
    const r1 = planAiDeployment({ map, team: RED, units });
    const r2 = planAiDeployment({ map, team: RED, units });
    for (const [id, p] of r1.placements) {
      expect(r2.placements.get(id)).toEqual(p);
    }
  });

  it('returns leftover ids in `unplaced` when the zone is smaller than the team', () => {
    // Red zone shrunk to a single 2-tile row; four units → two unplaced.
    const smallMap = zonedMap({ width: 2, height: 5, blueRows: [0], redRows: [4] });
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('bruiser', 80, 'monk'),
      deployable('skirmisher', 70, 'assassin'),
      deployable('support', 60, 'alchemist'),
    ];
    const { placements, unplaced } = planAiDeployment({ map: smallMap, team: RED, units });
    expect(placements.size).toBe(2);
    // The two lowest-HP units are the ones that don't fit (sort is
    // descending, tiles run out at the tail).
    expect([...unplaced]).toEqual([unitId('skirmisher'), unitId('support')]);
  });

  it('throws when the map declares no opposing zone', () => {
    const noOpp = zonedMap({ width: 2, height: 5, blueRows: [], redRows: [4] });
    const units = [deployable('tank', 100, 'knight')];
    expect(() => planAiDeployment({ map: noOpp, team: RED, units })).toThrow(/opposing deployment zone/);
  });

  it('throws when the deploying team has no zone', () => {
    const noOwn = zonedMap({ width: 2, height: 5, blueRows: [0], redRows: [] });
    const units = [deployable('tank', 100, 'knight')];
    expect(() => planAiDeployment({ map: noOwn, team: RED, units })).toThrow(/no deployment zone for team/);
  });
});
