// TABA campaign — snapshot-fold tests.
// The fold is the spine's entry leg: it must inject the durable unit's
// STABLE id (D-B, not the slot id), RECOMPUTE baseStats (D-A), and supply
// carried vitals EXPLICITLY clamped to the recomputed effective max (D-E).
// We fold against a real node template (River Ridge) and run the output
// through the unchanged `createInitialState` to prove it's a valid config.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { buildBaseStats } from '@content/teams/index.ts';
import { createInitialState, teamId } from '@engine/index.ts';
import type { TeamId } from '@engine/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { foldCampaignRoster } from './snapshot-fold.ts';
import { m0Roster } from './roster.ts';
import type { CampaignUnit } from './types.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a'); // River Ridge's Blue team
const playerSlots = riverRidgeBattle.units.filter((u) => u.team === PLAYER);

// A K=3 selection from the authored roster.
const selection = m0Roster.slice(0, 3);

describe('foldCampaignRoster', () => {
  it("injects each unit's OWN stable id, not the template slot id (D-B)", () => {
    const config = foldCampaignRoster(riverRidgeBattle, selection, PLAYER, catalog);
    const folded = config.units.filter((u) => u.team === PLAYER);
    expect(folded.map((u) => u.id)).toEqual(selection.map((u) => u.id));
    // And NOT the slot ids the Mage War fold would have used.
    const slotIds = new Set(playerSlots.map((s) => s.id));
    for (const u of folded) expect(slotIds.has(u.id)).toBe(false);
  });

  it('recomputes baseStats from inputs, does not persist them (D-A)', () => {
    const config = foldCampaignRoster(riverRidgeBattle, selection, PLAYER, catalog);
    for (const unit of selection) {
      const placement = config.units.find((u) => u.id === unit.id)!;
      const expected = buildBaseStats(unit.classId, unit.brave, unit.faith, unit.level);
      expect(placement.baseStats).toEqual(expected);
    }
  });

  it('takes placeholder positions from the template slots (deployment overwrites later)', () => {
    const config = foldCampaignRoster(riverRidgeBattle, selection, PLAYER, catalog);
    selection.forEach((unit, i) => {
      const placement = config.units.find((u) => u.id === unit.id)!;
      expect(placement.position).toEqual(playerSlots[i]!.position);
    });
  });

  it('leaves enemy (other-team) placements untouched — durable machinery is player-side only', () => {
    const config = foldCampaignRoster(riverRidgeBattle, selection, PLAYER, catalog);
    const enemiesBefore = riverRidgeBattle.units.filter((u) => u.team !== PLAYER);
    const enemiesAfter = config.units.filter((u) => u.team !== PLAYER);
    expect(enemiesAfter).toEqual(enemiesBefore);
  });

  it('supplies vitals EXPLICITLY and the config flows through createInitialState unchanged', () => {
    const config = foldCampaignRoster(riverRidgeBattle, selection, PLAYER, catalog);
    for (const unit of selection) {
      const placement = config.units.find((u) => u.id === unit.id)!;
      expect(placement.vitals).toBeDefined(); // D-E: explicit, not auto-filled
    }
    const state = createInitialState(config, catalog);
    // 3 player + River Ridge's 5 enemies = 8 units.
    expect(state.units.size).toBe(3 + riverRidgeBattle.units.filter((u) => u.team !== PLAYER).length);
    for (const unit of selection) expect(state.units.get(unit.id)).toBeDefined();
  });

  it('clamps carried vitals down to the recomputed effective max (over-full carry)', () => {
    // A unit carrying absurdly high vitals must be clamped to its real max.
    const overFull: CampaignUnit = { ...m0Roster[0]!, vitals: { hp: 99999, mp: 99999 } };
    const config = foldCampaignRoster(riverRidgeBattle, [overFull], PLAYER, catalog);
    const placement = config.units.find((u) => u.id === overFull.id)!;
    const state = createInitialState(config, catalog);
    const live = state.units.get(overFull.id)!;
    // Clamped: equals the unit's effective max (what it walks in at).
    expect(placement.vitals!.hp).toBe(live.vitals.hp);
    expect(placement.vitals!.hp).toBeLessThan(99999);
  });

  it("carries a WOUNDED unit's low vitals through unchanged (the attrition path)", () => {
    const wounded: CampaignUnit = { ...m0Roster[0]!, vitals: { hp: 7, mp: 1 } };
    const config = foldCampaignRoster(riverRidgeBattle, [wounded], PLAYER, catalog);
    const placement = config.units.find((u) => u.id === wounded.id)!;
    // Below max → carried verbatim (clamp is a no-op). Proves wounds CAN
    // persist; M0's heal rule lives in apply-back, not the fold.
    expect(placement.vitals).toEqual({ hp: 7, mp: 1 });
    const state = createInitialState(config, catalog);
    expect(state.units.get(wounded.id)!.vitals.hp).toBe(7);
  });

  it('throws loudly when more units are selected than the template authors slots for', () => {
    const tooMany = m0Roster.slice(0, playerSlots.length + 1);
    expect(() => foldCampaignRoster(riverRidgeBattle, tooMany, PLAYER, catalog)).toThrow(
      /authors only/,
    );
  });
});
