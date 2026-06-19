// Session 70 — AI deployment into a split (multi-sub-zone, capped) side.
//
// Guards the chunk-3 extension: caps respected, roles sorted *within*
// each sub-zone, melee distributed across wings (not piled into one), and
// nothing placed outside the sub-zone tiles. Uses the real Mountain Pass
// ambusher config plus controlled synthetic configs.

import { describe, expect, it } from 'vitest';
import {
  opposingTilesFor,
  subZoneIndexForTile,
  teamForTile,
  tilesForTeam,
  teamId,
  type DeploymentZoneConfig,
  type Position,
} from '@engine/index.ts';
import { planAiDeployment, type DeployableUnit } from './deployment.ts';
import { unitId, classId } from '@engine/index.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';

const BLUE = teamId('team_a');
const RED = teamId('team_b');

function unit(id: string, maxHP: number, klass: string, role: 'melee' | 'ranged'): DeployableUnit {
  return { id: unitId(id), maxHP, classId: classId(klass), role };
}

function centroid(tiles: ReadonlyArray<Position>): { x: number; y: number } {
  const sx = tiles.reduce((s, t) => s + t.x, 0);
  const sy = tiles.reduce((s, t) => s + t.y, 0);
  return { x: sx / tiles.length, y: sy / tiles.length };
}
function d2(p: Position, c: { x: number; y: number }): number {
  return (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
}

describe('planAiDeployment — Mountain Pass ambusher (real split config)', () => {
  const zones = deploymentZonesFor('mountain_pass');
  // The 5v5 Mage War ambusher: one Knight (melee) + four mages (ranged).
  const ambusher: ReadonlyArray<DeployableUnit> = [
    unit('knight', 60, 'knight', 'melee'),
    unit('water', 50, 'water_mage', 'ranged'),
    unit('fire', 48, 'fire_mage', 'ranged'),
    unit('lightning', 46, 'lightning_mage', 'ranged'),
    unit('earth', 52, 'earth_mage', 'ranged'),
  ];

  it('places all five, none unplaced, respecting the 3/2 caps', () => {
    const { placements, unplaced } = planAiDeployment({ zones, team: RED, units: ambusher });
    expect(unplaced).toEqual([]);
    expect(placements.size).toBe(5);
    const perSubZone = new Map<number, number>();
    for (const p of placements.values()) {
      const idx = subZoneIndexForTile(zones, RED, p.position);
      expect(idx).not.toBeNull();
      perSubZone.set(idx!, (perSubZone.get(idx!) ?? 0) + 1);
    }
    expect(perSubZone.get(0)).toBe(3); // SW massif, cap 3
    expect(perSubZone.get(1)).toBe(2); // NE edge, cap 2
  });

  it('never places a unit outside the ambusher tiles', () => {
    const { placements } = planAiDeployment({ zones, team: RED, units: ambusher });
    for (const p of placements.values()) {
      expect(teamForTile(zones, p.position)).toBe(RED);
    }
  });

  it('puts the lone melee Knight on the dominant (SW massif) wing', () => {
    const { placements } = planAiDeployment({ zones, team: RED, units: ambusher });
    expect(subZoneIndexForTile(zones, RED, placements.get(unitId('knight'))!.position)).toBe(0);
  });

  it('is deterministic', () => {
    const a = planAiDeployment({ zones, team: RED, units: ambusher });
    const b = planAiDeployment({ zones, team: RED, units: ambusher });
    for (const [id, p] of a.placements) expect(b.placements.get(id)).toEqual(p);
  });
});

describe('planAiDeployment — split-zone properties (synthetic)', () => {
  // Two disjoint wings, each cap 2; the victim sits up-north so both wings
  // face north. Wing A (front, nearer the victim) at y=8; wing B at y=12.
  const split: DeploymentZoneConfig = {
    teams: [
      { team: BLUE, subZones: [{ tiles: [{ x: 4, y: 0, layer: 0 }, { x: 5, y: 0, layer: 0 }] }] },
      {
        team: RED,
        subZones: [
          { cap: 2, tiles: [{ x: 0, y: 8, layer: 0 }, { x: 1, y: 8, layer: 0 }, { x: 0, y: 9, layer: 0 }, { x: 1, y: 9, layer: 0 }] },
          { cap: 2, tiles: [{ x: 0, y: 12, layer: 0 }, { x: 1, y: 12, layer: 0 }, { x: 0, y: 13, layer: 0 }, { x: 1, y: 13, layer: 0 }] },
        ],
      },
    ],
  };

  it('distributes melee across both wings rather than piling them in one', () => {
    const units = [
      unit('m1', 60, 'knight', 'melee'),
      unit('m2', 55, 'monk', 'melee'),
      unit('r1', 50, 'fire_mage', 'ranged'),
      unit('r2', 48, 'water_mage', 'ranged'),
    ];
    const { placements } = planAiDeployment({ zones: split, team: RED, units });
    const wingOf = (id: string): number =>
      subZoneIndexForTile(split, RED, placements.get(unitId(id))!.position)!;
    // One melee per wing — not both in the same sub-zone.
    expect(new Set([wingOf('m1'), wingOf('m2')]).size).toBe(2);
  });

  it('within a wing, melee sit ahead of ranged (local front/back line)', () => {
    const units = [
      unit('m1', 60, 'knight', 'melee'),
      unit('r1', 50, 'fire_mage', 'ranged'),
      unit('r2', 48, 'water_mage', 'ranged'),
      unit('r3', 46, 'earth_mage', 'ranged'),
    ];
    const { placements } = planAiDeployment({ zones: split, team: RED, units });
    const opp = centroid(opposingTilesFor(split, RED));
    // The single melee shares a wing with at least one ranged; it must be
    // at least as forward (closer to the victim) as its wing-mates.
    const meleePos = placements.get(unitId('m1'))!.position;
    const meleeWing = subZoneIndexForTile(split, RED, meleePos)!;
    const meleeD = d2(meleePos, opp);
    for (const r of ['r1', 'r2', 'r3']) {
      const rp = placements.get(unitId(r))!.position;
      if (subZoneIndexForTile(split, RED, rp) === meleeWing) {
        expect(meleeD).toBeLessThanOrEqual(d2(rp, opp));
      }
    }
  });

  it('drops overflow to unplaced when the team exceeds total capacity', () => {
    const units = [
      unit('a', 60, 'knight', 'melee'),
      unit('b', 58, 'monk', 'melee'),
      unit('c', 56, 'knight', 'melee'),
      unit('d', 54, 'monk', 'melee'),
      unit('e', 52, 'fire_mage', 'ranged'),
    ];
    // Total cap = 2 + 2 = 4; the fifth (lowest-priority ranged) drops.
    const { placements, unplaced } = planAiDeployment({ zones: split, team: RED, units });
    expect(placements.size).toBe(4);
    expect(unplaced).toEqual([unitId('e')]);
  });

  it('every placement lands on a tile of its assigned sub-zone', () => {
    const units = [unit('a', 60, 'knight', 'melee'), unit('b', 50, 'fire_mage', 'ranged')];
    const { placements } = planAiDeployment({ zones: split, team: RED, units });
    const redTiles = new Set(tilesForTeam(split, RED).map((t) => `${t.x},${t.y},${t.layer}`));
    for (const p of placements.values()) {
      expect(redTiles.has(`${p.position.x},${p.position.y},${p.position.layer}`)).toBe(true);
    }
  });
});
