import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { buildBaseStats } from '@content/teams/index.ts';
import {
  abilityId,
  bucketId,
  classId,
  commandSetId,
  createInitialState,
  EMPTY_UNIT_EQUIPMENT,
  teamId,
  type Loadout,
  type TeamId,
} from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { authoredEnemy } from './authored-enemy.ts';
import { foldBattle, foldEnemyTeam } from './snapshot-fold.ts';
import { m0Roster } from './roster.ts';
import { firstBattleBeat, type NodeBattle } from './sequence.ts';
import { CAMPAIGN_GRAPH } from './node.ts';
import { allNodeBeats, getNode } from './graph.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a'); // Blue
const ENEMY: TeamId = teamId('team_b'); // River Ridge's Red team

function knightLoadout(): Loadout {
  return {
    actionBuckets: { [bucketId('first_action')]: [commandSetId('battle_skill')] },
    passiveBuckets: {},
  };
}

// A deliberately-limited enemy Knight: only Power Attack + Bull Rush unlocked
// (NOT the whole Battle Skill kit).
function weakKnight(id: string, level: number) {
  return authoredEnemy({
    id,
    name: 'Rot-knight',
    classId: classId('knight'),
    level,
    loadout: knightLoadout(),
    equipment: EMPTY_UNIT_EQUIPMENT,
    unlocks: [
      { kind: 'ability', id: abilityId('power_attack') },
      { kind: 'ability', id: abilityId('bull_rush') },
    ],
  });
}

describe('authoredEnemy', () => {
  it('builds a valid enemy CampaignUnit carrying its gated kit', () => {
    const e = weakKnight('rk1', 18);
    expect(e.classId).toBe(classId('knight'));
    expect(e.level).toBe(18);
    expect(e.fate).toBe('active');
    expect(e.unlocks.map((t) => String(t.id))).toEqual(['power_attack', 'bull_rush']);
  });
});

describe('foldEnemyTeam', () => {
  const enemies = [weakKnight('rk1', 18), weakKnight('rk2', 18)];
  const folded = foldEnemyTeam(riverRidgeBattle, enemies, ENEMY, catalog);
  const enemySlots = riverRidgeBattle.units.filter((u) => u.team === ENEMY);

  it('re-skins enemy slots with curve stats at the authored level', () => {
    const p = folded.units.find((u) => u.id === enemies[0]!.id)!;
    expect(p.baseStats).toEqual(buildBaseStats(classId('knight'), 70, 70, 18));
  });

  it('stamps statsByLevel so the enemy can LEVEL mid-battle', () => {
    const p = folded.units.find((u) => u.id === enemies[0]!.id)!;
    expect(p.statsByLevel).toBeDefined();
    expect(p.statsByLevel!.length).toBeGreaterThan(0);
    // First precomputed entry is the NEXT level's stats.
    expect(p.statsByLevel![0]).toEqual(buildBaseStats(classId('knight'), 70, 70, 19));
  });

  it('GATES the enemy kit to its unlocks (partial Battle Skill)', () => {
    const p = folded.units.find((u) => u.id === enemies[0]!.id)!;
    expect(p.usableActives).toBeDefined();
    const usable = new Set(p.usableActives!.map(String));
    expect(usable.has('power_attack')).toBe(true);
    expect(usable.has('bull_rush')).toBe(true);
    // Lightning Stab is a Battle Skill ACTIVE we did NOT unlock → gated out.
    // (Counter / Martial Expertise are Knight passives in freeAbilities — always
    // present, but harmless: passives never route through use_ability.)
    expect(usable.has('lightning_stab')).toBe(false);
  });

  it('takes position/facing from the template enemy slot', () => {
    const p = folded.units.find((u) => u.id === enemies[0]!.id)!;
    expect(p.position).toEqual(enemySlots[0]!.position);
    expect(p.facing).toBe(enemySlots[0]!.facing);
  });

  it('leaves the player team and any un-reskinned enemy slots untouched', () => {
    const playerBefore = riverRidgeBattle.units.filter((u) => u.team !== ENEMY);
    const playerAfter = folded.units.filter((u) => u.team !== ENEMY);
    expect(playerAfter).toEqual(playerBefore);
    // Two specs, but River Ridge authors more enemy slots → the rest survive raw.
    const keptRaw = enemySlots.slice(2);
    for (const slot of keptRaw) {
      expect(folded.units.find((u) => u.id === slot.id)).toEqual(slot);
    }
  });

  it('produces a config that flows through createInitialState unchanged', () => {
    const state = createInitialState(folded, catalog);
    expect(state.units.get(enemies[0]!.id)).toBeDefined();
  });

  it('throws loudly when more enemy specs than the template authors slots', () => {
    const tooMany = Array.from({ length: enemySlots.length + 1 }, (_, i) => weakKnight(`x${i}`, 18));
    expect(() => foldEnemyTeam(riverRidgeBattle, tooMany, ENEMY, catalog)).toThrow(/authors only/);
  });
});

describe('foldBattle (player + enemy composition)', () => {
  const players = m0Roster.slice(0, 3);
  const beat = (enemies?: ReadonlyArray<ReturnType<typeof weakKnight>>): NodeBattle =>
    ({ template: riverRidgeBattle, playerTeam: PLAYER, enemies } as unknown as NodeBattle);

  it('folds only the player selection when no enemies are authored (backward-compat)', () => {
    const config = foldBattle(beat(), players, catalog);
    // Enemy team untouched (raw template placements).
    const enemiesAfter = config.units.filter((u) => u.team === ENEMY);
    expect(enemiesAfter).toEqual(riverRidgeBattle.units.filter((u) => u.team === ENEMY));
    // Players folded (own ids present).
    for (const p of players) expect(config.units.find((u) => u.id === p.id)).toBeDefined();
  });

  it('folds BOTH teams when enemies are authored', () => {
    const enemies = [weakKnight('rk1', 18), weakKnight('rk2', 18)];
    const config = foldBattle(beat(enemies), players, catalog);
    // Both a folded player and a folded (gated) enemy are present.
    expect(config.units.find((u) => u.id === players[0]!.id)).toBeDefined();
    const enemy = config.units.find((u) => u.id === enemies[0]!.id)!;
    expect(enemy.usableActives).toBeDefined();
    expect(enemy.statsByLevel).toBeDefined();
  });
});

describe('Zelmonia Hills — the authored Theo Renault battle (Ch1)', () => {
  const hills = getNode(CAMPAIGN_GRAPH, 'node-zelmonia-hills');
  const beat = firstBattleBeat(allNodeBeats(hills))!;

  it('authors Theo first (L4 Hunter, one-active kit) over the Cartographer-authored escort', () => {
    const enemies = beat.battle.enemies!;
    expect(enemies).toBeDefined();
    expect(String(enemies[0]!.id)).toBe('plot-theo');
    expect(enemies[0]!.level).toBe(4);
    expect(enemies[0]!.unlocks).toHaveLength(1); // pin_down only at Node 3
    // S98: the escort is the authored ZELMONIA_HILLS_LINEUP (five troops,
    // levels 3-4 as placed in the tool), not the old lineup(4, 4) stub.
    expect(enemies).toHaveLength(6);
    expect(enemies.slice(1).every((e) => e.level >= 3 && e.level <= 4)).toBe(true);
  });

  it('folds Theo onto the death-protected lead slot with a gated kit', () => {
    const config = foldBattle(beat.battle, m0Roster.slice(0, beat.battle.deployCap), catalog);
    const theo = config.units.find((u) => String(u.id) === 'plot-theo')!;
    expect(theo.deathProtected).toBe(true); // the WI1 boss flag survives the fold
    const usable = new Set(theo.usableActives!.map(String));
    expect(usable.has('pin_down')).toBe(true);
    expect(usable.has('charged_attack')).toBe(false); // rematch-only, gated out here
  });

  it('the battle authors the retreat conditions: Theo under 15% OR the field swept', () => {
    const conditions = beat.battle.template.victoryConditions;
    expect(conditions[0]).toMatchObject({
      kind: 'predicate',
      predicate: { kind: 'unit_below_hp', fraction: 0.15 },
    });
    expect(conditions.some((c) => c.kind === 'defeat_all')).toBe(true);
  });
});

describe('death-protected slots survive the enemy fold (Ch1 WI1 authoring)', () => {
  // The Ch1 boss pattern: the template variant flags an enemy PLACEMENT as
  // death-protected, and an authored enemy spec supplies who stands there.
  // The fold must carry the slot's flag onto the re-skinned placement, the
  // same way it carries `guest`.
  const firstEnemySlotId = riverRidgeBattle.units.find((u) => u.team === ENEMY)!.id;
  const protectedTemplate = {
    ...riverRidgeBattle,
    units: riverRidgeBattle.units.map((u) =>
      u.id === firstEnemySlotId ? { ...u, deathProtected: true as const } : u,
    ),
  };

  it('the re-skinned boss placement keeps deathProtected', () => {
    const folded = foldEnemyTeam(protectedTemplate, [weakKnight('boss', 10)], ENEMY, catalog);
    const boss = folded.units.find((u) => String(u.id) === 'boss')!;
    expect(boss.deathProtected).toBe(true);
    // Other re-skinned/authored slots carry no flag.
    expect(folded.units.filter((u) => u.deathProtected === true)).toHaveLength(1);
  });

  it('the engine threads the folded flag onto the Unit', () => {
    const folded = foldEnemyTeam(protectedTemplate, [weakKnight('boss', 10)], ENEMY, catalog);
    const state = createInitialState(folded, catalog);
    expect(state.units.get(folded.units.find((u) => String(u.id) === 'boss')!.id)?.deathProtected).toBe(true);
  });
});
