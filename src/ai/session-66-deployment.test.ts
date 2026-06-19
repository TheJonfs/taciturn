// Session 66, chunk 3 — role-aware deployment sorting (D3: coarse
// melee / ranged split classified off weaponType, ADR-0105).
//
// Layer 1: deployRoleFromWeaponType — the weaponType → role mapping.
// Layer 2: planAiDeployment — melee claim the forward tiles, ranged/casters
//          the protected tiles behind, and role dominates HP for the
//          front/back split.

import { describe, expect, it } from 'vitest';
import {
  classId,
  teamId,
  unitId,
  type DeploymentZoneConfig,
  type Position,
  type WeaponType,
} from '@engine/index.ts';
import { planAiDeployment, deployRoleFromWeaponType, type DeployableUnit } from './deployment.ts';

const BLUE = teamId('team_a');
const RED = teamId('team_b');

// Single sub-zone per team built from explicit rows (S70 — zones live off
// the map). `height` is unused but kept in the arg shape.
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

function deployable(
  id: string, maxHP: number, klass: string, role?: 'melee' | 'ranged',
): DeployableUnit {
  return { id: unitId(id), maxHP, classId: classId(klass), ...(role !== undefined ? { role } : {}) };
}

describe('S66 chunk 3 — deployRoleFromWeaponType', () => {
  it('classifies bows, wands, and staves as ranged', () => {
    for (const wt of ['bow', 'wand', 'staff'] as WeaponType[]) {
      expect(deployRoleFromWeaponType(wt)).toBe('ranged');
    }
  });

  it('classifies every melee weapon as melee', () => {
    for (const wt of ['sword', 'knife', 'knight_sword', 'axe', 'polearm'] as WeaponType[]) {
      expect(deployRoleFromWeaponType(wt)).toBe('melee');
    }
  });

  it('defaults an unarmed / unclassified unit to melee (front line)', () => {
    expect(deployRoleFromWeaponType(undefined)).toBe('melee');
  });
});

describe('S66 chunk 3 — planAiDeployment role-aware placement', () => {
  // Red zone is the two south rows; y=3 is the front (nearer Blue at y=0),
  // y=4 the protected rear.
  const zones = zonedConfig({ width: 2, height: 5, blueRows: [0], redRows: [3, 4] });

  it('lands melee on the forward row and ranged/casters on the rear row', () => {
    const units = [
      deployable('knight', 60, 'knight', 'melee'),
      deployable('monk', 55, 'monk', 'melee'),
      deployable('archer', 50, 'hunter', 'ranged'),
      deployable('mage', 45, 'fire_mage', 'ranged'),
    ];
    const { placements, unplaced } = planAiDeployment({ zones, team: RED, units });
    expect(unplaced).toEqual([]);
    expect(placements.get(unitId('knight'))!.position.y).toBe(3);
    expect(placements.get(unitId('monk'))!.position.y).toBe(3);
    expect(placements.get(unitId('archer'))!.position.y).toBe(4);
    expect(placements.get(unitId('mage'))!.position.y).toBe(4);
  });

  it('keeps a high-HP ranged unit behind a lower-HP melee unit (role beats HP)', () => {
    // The mage out-HPs both melee, but role places it on the rear row while
    // the squishier melee hold the front — the whole point of the split.
    const units = [
      deployable('glassMelee1', 30, 'knight', 'melee'),
      deployable('glassMelee2', 28, 'monk', 'melee'),
      deployable('tankyMage', 99, 'fire_mage', 'ranged'),
    ];
    const { placements } = planAiDeployment({ zones, team: RED, units });
    expect(placements.get(unitId('glassMelee1'))!.position.y).toBe(3);
    expect(placements.get(unitId('glassMelee2'))!.position.y).toBe(3);
    expect(placements.get(unitId('tankyMage'))!.position.y).toBe(4);
  });

  it('orders melee by descending HP at the front (tanks at the tip)', () => {
    const units = [
      deployable('big', 90, 'knight', 'melee'),
      deployable('small', 40, 'monk', 'melee'),
      deployable('archer', 50, 'hunter', 'ranged'),
    ];
    const { placements } = planAiDeployment({ zones, team: RED, units });
    // Front row holds both melee; the rear holds the archer.
    expect(placements.get(unitId('big'))!.position.y).toBe(3);
    expect(placements.get(unitId('small'))!.position.y).toBe(3);
    expect(placements.get(unitId('archer'))!.position.y).toBe(4);
    // The highest-HP melee takes the frontmost tile (rank 0 = (0,3)).
    expect(placements.get(unitId('big'))!.position).toEqual({ x: 0, y: 3, layer: 0 });
  });
});
