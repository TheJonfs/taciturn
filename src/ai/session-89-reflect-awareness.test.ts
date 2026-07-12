// Session 89 (WI4a) — reflect-awareness: the AI fears thorn gear.
//
// Equipment reflect (Spiked Mail's `physicalReflectPercent`, Mirror
// Shield's `magicalReflectPercent`) lives in item fields, not loadout
// reaction passives — so the tag-aware reactionPenalty never saw it and
// the AI would feed thorns for free. Now `reflectCostForAttack` nets the
// expected reflected fraction (as friendly fire against the attacker) off
// the attack's score, with a clean-kill exemption mirroring the engine's
// no-posthumous-reflect gate.

import { describe, expect, it } from 'vitest';
import {
  itemId,
  teamId,
  type Position,
  type Tile,
  type Unit,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '../content/index.ts';
import { attack } from '../content/abilities/attack.ts';
import { longSword } from '../content/items/long-sword.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../engine/ct/test-fixtures.ts';
import { decideBasicAi, _basicAiInternals } from './basic.ts';

const TEAM_A = teamId('team_a');
const TEAM_B = teamId('team_b');
const TEAMS = [
  { id: TEAM_A, name: 'A', control: 'human' as const },
  { id: TEAM_B, name: 'B', control: 'ai' as const },
];

function flatMap(width: number, height: number): { width: number; height: number; tiles: Tile[] } {
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, layer: 0, elevation: 3, terrain: 'ground', properties: [] });
    }
  }
  return { width, height, tiles };
}

function knight(id: string, team: 'team_a' | 'team_b', pos: Position, opts: { thorns?: boolean; hp?: number } = {}): Unit {
  return makeUnit({
    id, team, spd: 10, pa: 8, classId: 'knight',
    maxHpBase: 80, hp: opts.hp ?? 80, position: pos,
    equipment: {
      leftHand: null,
      rightHand: longSword.id,
      headgear: null,
      armor: opts.thorns === true ? itemId('spiked_mail') : null,
      accessory: null,
    },
  });
}

describe('S89 WI4a — reflectCostForAttack / targetReflectPercent', () => {
  const cat = loadDefaultCatalog();

  it('reads Spiked Mail as 20% against a physical attack, 0% against magical tags', () => {
    const wearer = knight('w', 'team_b', { x: 2, y: 1, layer: 0 }, { thorns: true });
    expect(_basicAiInternals.targetReflectPercent(wearer, attack, cat)).toBe(20);
    const magicish = {
      ...attack,
      effects: { damage: { tags: ['magical' as const], power_coefficient: 1 } },
    };
    expect(_basicAiInternals.targetReflectPercent(wearer, magicish, cat)).toBe(0);
  });

  it('scores an attack into thorns below the same attack on a bare twin', () => {
    const actor = knight('me', 'team_a', { x: 1, y: 1, layer: 0 });
    const bare = knight('bare', 'team_b', { x: 2, y: 1, layer: 0 });
    const thorned = knight('thorn', 'team_b', { x: 1, y: 2, layer: 0 }, { thorns: true });
    const state = makeGameState({
      units: [actor, bare, thorned],
      map: flatMap(6, 6),
      teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    const sBare = _basicAiInternals.scoreSingleUnitOffensive(state, cat, actor, actor.position, bare, attack);
    const sThorn = _basicAiInternals.scoreSingleUnitOffensive(state, cat, actor, actor.position, thorned, attack);
    expect(sBare).toBeGreaterThan(sThorn);
  });

  it('a clean kill draws no thorns (engine gates posthumous reflect)', () => {
    const actor = knight('me', 'team_a', { x: 1, y: 1, layer: 0 });
    const dying = knight('thorn', 'team_b', { x: 2, y: 1, layer: 0 }, { thorns: true, hp: 3 });
    const cost = _basicAiInternals.reflectCostForAttack(
      actor, dying, attack, cat,
      // Any projection comfortably over 3 HP kills — the cost must be 0.
      50,
    );
    expect(cost).toBe(0);
  });
});

describe('S89 WI4a — decideBasicAi prefers the bare twin over the thorn-wearer', () => {
  it('attacks the unarmored target when an otherwise-equal thorned one stands beside it', () => {
    const cat = loadDefaultCatalog();
    const actor = knight('me', 'team_a', { x: 1, y: 1, layer: 0 });
    const bare = knight('bare', 'team_b', { x: 2, y: 1, layer: 0 });
    const thorned = knight('thorn', 'team_b', { x: 1, y: 2, layer: 0 }, { thorns: true });
    const state = makeGameState({
      units: [actor, bare, thorned],
      map: flatMap(6, 6),
      teams: TEAMS,
      turnState: activeTurnFor(actor.id),
    });
    const d = decideBasicAi(state, cat);
    expect(d.kind).toBe('commit');
    if (d.kind !== 'commit' || d.action.type !== 'use_ability') {
      // A Move first is acceptable only if the eventual target is the bare
      // twin; for this symmetric setup the act-in-place should win, so
      // require the direct ability commit.
      throw new Error('expected an immediate use_ability');
    }
    const t = d.action.payload.target;
    expect(t.kind).toBe('unit');
    if (t.kind === 'unit') expect(t.unitId).toEqual('bare');
  });
});
