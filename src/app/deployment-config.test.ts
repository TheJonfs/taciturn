// Tests for the deployment → battle-config bridge and the pipeline
// integration it feeds: a complete deployment folds into the authored
// River Ridge config and flows through `createInitialState` +
// `runPreBattlePhase` unchanged. Also covers the deployment-mount map
// validation (S33's `validateMap`).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import {
  createInitialState,
  runPreBattlePhase,
  teamId,
  unitId,
  validateMap,
  type Direction,
  type TeamId,
  type WeaponType,
} from '@engine/index.ts';
import { deployRoleFromWeaponType } from '@ai/index.ts';
import { riverRidge } from '@content/maps/river-ridge.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import type { DeploymentPlacement } from '@ui/index.ts';
import {
  buildDeployedBattleConfig,
  computeAiDeploymentResult,
  type DeploymentResult,
} from './deployment-config.ts';

const BLUE: TeamId = teamId('team_a');
const RED: TeamId = teamId('team_b');

// A complete Blue deployment — every Blue unit on a distinct tile in
// the northern zone (rows 0-2, cols 5-8), each facing south. S48: now
// 5 units (Blue gains an Earth Mage in the 5v5 expansion).
const south: Direction = 'S';
function blueDeployment(): DeploymentResult {
  const at = (x: number, y: number): DeploymentPlacement => ({
    position: { x, y, layer: 0 },
    facing: south,
  });
  return {
    team: BLUE,
    placements: new Map([
      [unitId('blue_knight_n'), at(5, 0)],
      [unitId('blue_water_mage'), at(6, 0)],
      [unitId('blue_lightning_mage'), at(7, 0)],
      [unitId('blue_fire_mage'), at(8, 0)],
      [unitId('blue_earth_mage'), at(5, 1)],
    ]),
  };
}

describe('buildDeployedBattleConfig', () => {
  it('replaces the deployed team placements, keeps everything else', () => {
    const result = blueDeployment();
    const config = buildDeployedBattleConfig(riverRidgeBattle, result);

    // Teams / map / seed / victory conditions untouched.
    expect(config.teams).toBe(riverRidgeBattle.teams);
    expect(config.map).toBe(riverRidgeBattle.map);
    expect(config.masterSeed).toBe(riverRidgeBattle.masterSeed);
    expect(config.units.length).toBe(riverRidgeBattle.units.length);

    // Blue units take the deployed positions + facings.
    for (const [id, placement] of result.placements) {
      const unit = config.units.find((u) => u.id === id)!;
      expect(unit.position).toEqual(placement.position);
      expect(unit.facing).toBe(placement.facing);
    }
  });

  it('leaves the opponent team authored placements untouched', () => {
    const config = buildDeployedBattleConfig(riverRidgeBattle, blueDeployment());
    for (const authored of riverRidgeBattle.units) {
      if (authored.team !== RED) continue;
      const unit = config.units.find((u) => u.id === authored.id)!;
      expect(unit.position).toEqual(authored.position);
      expect(unit.facing).toBe(authored.facing);
    }
  });

  it('throws when a deployed-team unit has no placement in the result', () => {
    const incomplete: DeploymentResult = {
      team: BLUE,
      placements: new Map([
        [unitId('blue_knight_n'), { position: { x: 5, y: 0, layer: 0 }, facing: south }],
      ]),
    };
    expect(() => buildDeployedBattleConfig(riverRidgeBattle, incomplete)).toThrow(
      /has no placement/,
    );
  });
});

describe('computeAiDeploymentResult (S43 AI deployment bridge)', () => {
  const catalog = loadDefaultCatalog();

  it('places every unit of the AI team inside its deployment zone', () => {
    const result = computeAiDeploymentResult(riverRidgeBattle, catalog, RED);
    const redUnits = riverRidgeBattle.units.filter((u) => u.team === RED);
    expect(result.team).toBe(RED);
    expect(result.placements.size).toBe(redUnits.length);
    // Every placement lands on a Red deployment-zone tile.
    for (const placement of result.placements.values()) {
      const tile = riverRidge.tiles.find(
        (t) =>
          t.x === placement.position.x &&
          t.y === placement.position.y &&
          t.layer === placement.position.layer,
      );
      expect(tile?.deploymentZone).toBe(RED);
    }
  });

  it('produces a result that folds cleanly through buildDeployedBattleConfig', () => {
    const result = computeAiDeploymentResult(riverRidgeBattle, catalog, RED);
    const config = buildDeployedBattleConfig(riverRidgeBattle, result);
    // No throw (every Red unit has a placement) and the engine consumes it.
    const initial = createInitialState(config, catalog);
    expect(initial.units.size).toBe(10);
  });

  it('faces the deployed AI team toward the opponent (Red faces north)', () => {
    const result = computeAiDeploymentResult(riverRidgeBattle, catalog, RED);
    for (const placement of result.placements.values()) {
      expect(placement.facing).toBe('N');
    }
  });

  it('classifies roles off equipment and keeps melee ahead of ranged (S66)', () => {
    // End-to-end: the bridge derives each unit's role from its equipped
    // weapon type and planAiDeployment puts melee on the forward tiles.
    // Invariant: no ranged/caster lands strictly ahead of any melee unit
    // (forward = nearer the opposing centroid). Re-derive roles via the
    // same exported classifier so the test tracks the real wiring.
    const state = createInitialState(riverRidgeBattle, catalog);
    const opposing = riverRidge.tiles.filter((t) => t.deploymentZone != null && t.deploymentZone !== RED);
    const cx = opposing.reduce((s, t) => s + t.x, 0) / opposing.length;
    const cy = opposing.reduce((s, t) => s + t.y, 0) / opposing.length;
    const dist2 = (p: { x: number; y: number }): number => (p.x - cx) ** 2 + (p.y - cy) ** 2;

    const result = computeAiDeploymentResult(riverRidgeBattle, catalog, RED);
    const meleeDists: number[] = [];
    const rangedDists: number[] = [];
    for (const u of state.units.values()) {
      if (u.team !== RED) continue;
      let wt: WeaponType | undefined;
      for (const slot of [u.equipment.rightHand, u.equipment.leftHand]) {
        if (slot === null) continue;
        const item = catalog.getItem(slot);
        if (item.kind === 'weapon') { wt = item.weaponType; break; }
      }
      const d = dist2(result.placements.get(u.id)!.position);
      (deployRoleFromWeaponType(wt) === 'ranged' ? rangedDists : meleeDists).push(d);
    }
    // The roster must exercise both roles or the invariant is vacuous.
    expect(meleeDists.length).toBeGreaterThan(0);
    expect(rangedDists.length).toBeGreaterThan(0);
    // Every melee unit is at least as forward as every ranged unit.
    expect(Math.max(...meleeDists)).toBeLessThanOrEqual(Math.min(...rangedDists));
  });
});

describe('pipeline integration — deployment commit → initial state → pre-battle', () => {
  it('a complete deployment flows through createInitialState + runPreBattlePhase', () => {
    const catalog = loadDefaultCatalog();
    const result = blueDeployment();
    const config = buildDeployedBattleConfig(riverRidgeBattle, result);

    const initial = createInitialState(config, catalog);
    expect(initial.units.size).toBe(10);

    // Blue units sit where deployment placed them.
    for (const [id, placement] of result.placements) {
      expect(initial.units.get(id)!.position).toEqual(placement.position);
      expect(initial.units.get(id)!.facing).toBe(placement.facing);
    }

    // The orchestrator's pre-battle phase runs unchanged on the
    // deployment-derived config — equipment auto-statuses + initial-CT
    // randomization land, and the state is ready for turn 1.
    const ready = runPreBattlePhase(initial, config, catalog);
    expect(ready.units.size).toBe(10);
    // Initial-CT randomization committed: at least one unit has CT > 0
    // (the default ruleset's uniform_int{0,20} draw is per-unit).
    expect([...ready.units.values()].some((u) => u.ct > 0)).toBe(true);
    // The action log captured the pre-battle phase from sequence 0.
    expect(ready.actionLog.length).toBeGreaterThan(0);
  });
});

describe('deployment-mount map validation (validateMap)', () => {
  const registry = loadDefaultCatalog().getRuleset(
    riverRidgeBattle.rulesetId,
  ).terrain.tags;

  it("River Ridge's zones are sufficient for the 5v5 roster (S48)", () => {
    const result = validateMap(riverRidge, registry, {
      requiredZonesPerTeam: new Map([
        [BLUE, 5],
        [RED, 5],
      ]),
    });
    expect(result.ok).toBe(true);
  });

  it('a team too large for its deployment zone is caught', () => {
    // River Ridge authors 12 zone tiles per team; a 20-unit team would
    // overflow — the same check DeploymentScreen runs at mount.
    const result = validateMap(riverRidge, registry, {
      requiredZonesPerTeam: new Map([
        [BLUE, 20],
        [RED, 4],
      ]),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'insufficient_deployment_zone')).toBe(
      true,
    );
  });
});
