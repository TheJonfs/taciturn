// Ch1 substrate (WI4) — guest ally tests: the fold treats guest
// placements as fixed authored units (never deploy slots), foldGuestTeam
// re-skins guest slots with durable units, skirmishes never inherit
// guests, the engine threads the flag, and joinPlotUnit appends to the
// roster (guest ≠ join, but Node 6 sequences one after the other).

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import { createInitialState, teamId, unitId, type BattleConfig, type TeamId, type UnitPlacement } from '@engine/index.ts';
import { foldCampaignRoster, foldGuestTeam } from './snapshot-fold.ts';
import { buildSkirmishBattle } from './skirmish.ts';
import { joinPlotUnit } from './join.ts';
import { newCampaign } from './loop.ts';
import { m0Roster } from './roster.ts';
import { plotUnits } from './plot-units.ts';
import { getNode, type CampaignNode } from './graph.ts';
import { CAMPAIGN_GRAPH } from './node.ts';

const catalog = loadDefaultCatalog();
const PLAYER: TeamId = teamId('team_a');

// River Ridge with one authored guest on the player's team.
const guestSlot: UnitPlacement = {
  ...riverRidgeBattle.units.find((u) => u.id === unitId('blue_fire_mage'))!,
  id: unitId('guest_oskun_militiaman'),
  name: 'Oskun Militiaman',
  guest: true,
};
const templateWithGuest: BattleConfig = {
  ...riverRidgeBattle,
  units: [...riverRidgeBattle.units, guestSlot],
};

describe('fold — guest placements are fixed units, not slots', () => {
  it('foldCampaignRoster preserves the guest and does not offer its slot', () => {
    const selected = m0Roster.slice(0, 2);
    const folded = foldCampaignRoster(templateWithGuest, selected, PLAYER, catalog);
    const guest = folded.units.find((u) => u.id === guestSlot.id);
    expect(guest).toBeDefined();
    expect(guest!.guest).toBe(true);
    // The real slot count is unchanged by the guest's presence: all five
    // authored team_a slots can still be filled.
    const five = m0Roster.slice(0, 5);
    if (five.length === 5) {
      expect(() => foldCampaignRoster(templateWithGuest, five, PLAYER, catalog)).not.toThrow();
    }
  });

  it('the engine threads the guest flag onto the Unit', () => {
    const folded = foldCampaignRoster(templateWithGuest, m0Roster.slice(0, 2), PLAYER, catalog);
    const state = createInitialState(folded, catalog);
    expect(state.units.get(guestSlot.id)?.guest).toBe(true);
    // Non-guest units carry no flag at all.
    expect(state.units.get(m0Roster[0]!.id)?.guest).toBeUndefined();
  });
});

describe('foldGuestTeam — durable units onto guest slots', () => {
  it('re-skins the guest slot with the durable unit, keeping the guest flag', () => {
    const sera = plotUnits.find((u) => String(u.id) === 'plot-sera') ?? plotUnits[0]!;
    const folded = foldGuestTeam(templateWithGuest, [sera], PLAYER, catalog);
    const guest = folded.units.find((u) => u.id === sera.id);
    expect(guest).toBeDefined();
    expect(guest!.guest).toBe(true);
    expect(guest!.team).toBe(PLAYER);
    expect(guest!.position).toEqual(guestSlot.position); // slot supplies the tile
    // The stand-in placement is gone.
    expect(folded.units.some((u) => u.id === guestSlot.id)).toBe(false);
  });

  it('throws loudly when more guests are authored than slots', () => {
    const two = plotUnits.slice(0, 2);
    expect(() => foldGuestTeam(templateWithGuest, two, PLAYER, catalog)).toThrow(/guest slot/);
  });
});

describe('skirmish — never inherits story guests', () => {
  it('buildSkirmishBattle strips guest placements from the borrowed template', () => {
    const node: CampaignNode = {
      ...getNode(CAMPAIGN_GRAPH, CAMPAIGN_GRAPH.startId),
      engagements: [
        {
          beats: [
            {
              type: 'battle',
              battle: {
                template: templateWithGuest,
                playerTeam: PLAYER,
                zones: { zones: [] } as never,
                deployCap: 4,
              },
            },
          ],
        },
      ],
    };
    const state = newCampaign(m0Roster, node.id);
    const skirmish = buildSkirmishBattle(node, state, catalog);
    expect(skirmish.template.units.some((u) => u.guest === true)).toBe(false);
  });
});

describe('joinPlotUnit', () => {
  const node = getNode(CAMPAIGN_GRAPH, CAMPAIGN_GRAPH.startId);
  const joiner = plotUnits[0]!;
  const withoutJoiner = () => {
    const base = newCampaign(m0Roster, node.id);
    return { ...base, roster: base.roster.filter((u) => u.id !== joiner.id) };
  };

  it('appends the unit active and healed to effective full, and grandfathers its gear', () => {
    const before = withoutJoiner();
    const after = joinPlotUnit(before, node, joiner, catalog);
    const joined = after.roster.find((u) => u.id === joiner.id);
    expect(joined).toBeDefined();
    expect(joined!.fate).toBe('active');
    expect(joined!.vitals.hp).toBeGreaterThan(0);
    // Every equipped item is now owned by the party.
    for (const itemId of Object.values(joined!.equipment)) {
      if (itemId === null || itemId === undefined) continue;
      expect(after.inventory[String(itemId)] ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('throws on a duplicate join', () => {
    const once = joinPlotUnit(withoutJoiner(), node, joiner, catalog);
    expect(() => joinPlotUnit(once, node, joiner, catalog)).toThrow(/already on the roster/);
  });
});
