// Cross-source hook ordering tests.
// Verifies the source-tier order (equipment < class < passive < status)
// from HOOK_SOURCE_TIER_ORDER produces correct dispatch when handlers
// from multiple kinds are active on the same unit.

import { createCatalog } from '../catalog/index.ts';
import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  loadoutOf,
  makeKnight,
  makePassive,
} from '../abilities/test-fixtures.ts';
import { passiveHook } from '../abilities/hooks.ts';
import { statusHook } from '../status/hooks.ts';
import { makeStatusInstance, makeStatusType } from '../status/test-fixtures.ts';
import { abilityId, statusTypeId } from '../types/index.ts';
import { BUCKET_MOVEMENT } from '../abilities/constants.ts';
import { collectActiveHandlers } from './collector.ts';
import { runModifyStatQuery } from './runners.ts';

describe('passive vs status hook ordering', () => {
  it('passives fire before statuses on the same hook', () => {
    const seen: string[] = [];
    const passive = makePassive({
      id: 'p',
      bucket: BUCKET_MOVEMENT,
      hooks: [
        passiveHook('modifyStatQuery', (args) => {
          seen.push('passive');
          return args.baseValue;
        }),
      ],
    });
    const status = makeStatusType({
      id: 'st',
      hooks: [
        statusHook('modifyStatQuery', (args) => {
          seen.push('status');
          return args.baseValue;
        }),
      ],
    });
    const cat = createCatalog({
      statusTypes: [status],
      abilities: [passive],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'st' })],
      loadout: loadoutOf({ passive: [[BUCKET_MOVEMENT, [abilityId('p')]]] }),
    });
    const state = makeGameState({ units: [u] });

    runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 });
    expect(seen).toEqual(['passive', 'status']);
  });

  it('passive contribution within tier is bucket order then equip order', () => {
    const a = makePassive({
      id: 'a',
      bucket: BUCKET_MOVEMENT,
      hooks: [
        passiveHook('modifyStatQuery', (args) => {
          seen.push('a');
          return args.baseValue;
        }),
      ],
    });
    const b = makePassive({
      id: 'b',
      bucket: BUCKET_MOVEMENT,
      hooks: [
        passiveHook('modifyStatQuery', (args) => {
          seen.push('b');
          return args.baseValue;
        }),
      ],
    });
    const seen: string[] = [];
    const cat = createCatalog({
      statusTypes: [],
      abilities: [a, b],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: loadoutOf({ passive: [[BUCKET_MOVEMENT, [abilityId('a'), abilityId('b')]]] }),
    });
    const state = makeGameState({ units: [u] });

    runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 });
    expect(seen).toEqual(['a', 'b']);
  });

  it('tier order is unconditional — priority is a within-tier tiebreak only', () => {
    // Confirms cross-tier ordering: even when a passive's priority is
    // higher (would fire later) than a status's, the tier rule wins.
    // This locks in the design doc's "Equipment → Class → Passive →
    // Statuses" ordering as the source of truth across tiers; priority
    // is for disambiguating sibling handlers within the same source.
    const seen: string[] = [];
    const passive = makePassive({
      id: 'p',
      bucket: BUCKET_MOVEMENT,
      hooks: [
        passiveHook(
          'modifyStatQuery',
          (args) => {
            seen.push('passive');
            return args.baseValue;
          },
          5,
        ),
      ],
    });
    const status = makeStatusType({
      id: 'st',
      hooks: [
        statusHook(
          'modifyStatQuery',
          (args) => {
            seen.push('status');
            return args.baseValue;
          },
          0,
        ),
      ],
    });
    const cat = createCatalog({
      statusTypes: [status],
      abilities: [passive],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      statuses: [makeStatusInstance({ typeId: 'st' })],
      loadout: loadoutOf({ passive: [[BUCKET_MOVEMENT, [abilityId('p')]]] }),
    });
    const state = makeGameState({ units: [u] });

    runModifyStatQuery(state, cat, { unit: u, statName: 'spd', baseValue: 10 });
    expect(seen).toEqual(['passive', 'status']);
    void statusTypeId;
  });

  it('passive handlers are collected for the right hook only', () => {
    const movePlus = makePassive({
      id: 'mp',
      bucket: BUCKET_MOVEMENT,
      hooks: [
        passiveHook('modifyStatQuery', (a) => a.baseValue),
        passiveHook('onTurnStart', () => {
          /* no-op */
        }),
      ],
    });
    const cat = createCatalog({
      statusTypes: [],
      abilities: [movePlus],
      commandSets: [],
      classes: [makeKnight()],
      items: [],
    });
    const u = makeUnit({
      id: 'u1',
      spd: 10,
      loadout: loadoutOf({ passive: [[BUCKET_MOVEMENT, [abilityId('mp')]]] }),
    });
    const state = makeGameState({ units: [u] });

    expect(collectActiveHandlers(state, u.id, cat, 'modifyStatQuery')).toHaveLength(1);
    expect(collectActiveHandlers(state, u.id, cat, 'onTurnStart')).toHaveLength(1);
    expect(collectActiveHandlers(state, u.id, cat, 'onTick')).toHaveLength(0);
  });
});
