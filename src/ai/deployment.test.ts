import { classId, teamId, unitId, type DeploymentZoneConfig, type Position } from '@engine/index.ts';
import { planAiDeployment, type DeployableUnit } from './deployment.ts';

const BLUE = teamId('team_a');
const RED = teamId('team_b');

// Build a deployment-zone config with explicit per-team rows. `blueRows` /
// `redRows` are the y-rows for each team; every column 0..width-1 in a
// listed row is a zone tile. Each team gets a single sub-zone (the
// pre-S70 degenerate case). `height` is unused now that zones live off
// the map but kept in the arg shape so call sites read the same.
function zonedConfig(args: {
  readonly width: number;
  readonly height: number;
  readonly blueRows: ReadonlyArray<number>;
  readonly redRows: ReadonlyArray<number>;
}): DeploymentZoneConfig {
  const { width, blueRows, redRows } = args;
  const rowTiles = (rows: ReadonlyArray<number>): Position[] =>
    rows.flatMap((y) => Array.from({ length: width }, (_, x) => ({ x, y, layer: 0 })));
  return {
    teams: [
      { team: BLUE, subZones: [{ tiles: rowTiles(blueRows) }] },
      { team: RED, subZones: [{ tiles: rowTiles(redRows) }] },
    ],
  };
}

function deployable(id: string, maxHP: number, klass: string): DeployableUnit {
  return { id: unitId(id), maxHP, classId: classId(klass) };
}

describe('planAiDeployment', () => {
  // 2-wide × 5-tall. Blue zone is the north row (y=0); Red zone is the
  // two south rows (y=3, y=4). Red's "front" is y=3 (nearer Blue).
  const zones = zonedConfig({ width: 2, height: 5, blueRows: [0], redRows: [3, 4] });

  it('places high-HP units forward (nearer the enemy), low-HP behind', () => {
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('bruiser', 80, 'monk'),
      deployable('skirmisher', 80, 'assassin'),
      deployable('support', 60, 'alchemist'),
    ];
    const { placements, unplaced } = planAiDeployment({ zones, team: RED, units });

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
    const { placements } = planAiDeployment({ zones, team: RED, units });
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
    const { placements } = planAiDeployment({ zones, team: RED, units });
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
    const { placements } = planAiDeployment({ zones, team: RED, units });
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
    const r1 = planAiDeployment({ zones, team: RED, units });
    const r2 = planAiDeployment({ zones, team: RED, units });
    for (const [id, p] of r1.placements) {
      expect(r2.placements.get(id)).toEqual(p);
    }
  });

  it('returns leftover ids in `unplaced` when the zone is smaller than the team', () => {
    // Red zone shrunk to a single 2-tile row; four units → two unplaced.
    const smallMap = zonedConfig({ width: 2, height: 5, blueRows: [0], redRows: [4] });
    const units = [
      deployable('tank', 100, 'knight'),
      deployable('bruiser', 80, 'monk'),
      deployable('skirmisher', 70, 'assassin'),
      deployable('support', 60, 'alchemist'),
    ];
    const { placements, unplaced } = planAiDeployment({ zones: smallMap, team: RED, units });
    expect(placements.size).toBe(2);
    // The two lowest-HP units are the ones that don't fit (sort is
    // descending, tiles run out at the tail).
    expect([...unplaced]).toEqual([unitId('skirmisher'), unitId('support')]);
  });

  it('throws when the map declares no opposing zone', () => {
    const noOpp = zonedConfig({ width: 2, height: 5, blueRows: [], redRows: [4] });
    const units = [deployable('tank', 100, 'knight')];
    expect(() => planAiDeployment({ zones: noOpp, team: RED, units })).toThrow(/opposing deployment zone/);
  });

  it('throws when the deploying team has no zone', () => {
    const noOwn = zonedConfig({ width: 2, height: 5, blueRows: [0], redRows: [] });
    const units = [deployable('tank', 100, 'knight')];
    expect(() => planAiDeployment({ zones: noOwn, team: RED, units })).toThrow(/no deployment zone for team/);
  });
});
