import { makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import { bucketId } from '../types/index.ts';
import { getCapacity } from './capacity.ts';
import {
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECOND_ACTION,
  BUCKET_SUPPORT,
} from './constants.ts';
import { makeAbilitiesCatalog } from './test-fixtures.ts';

describe('getCapacity', () => {
  const cat = makeAbilitiesCatalog({});
  const u = makeUnit({ id: 'u1', spd: 10 });
  const state = makeGameState({ units: [u] });

  it('returns the v1 baseline for First Action / Second Action (1 each)', () => {
    expect(getCapacity(state, u.id, BUCKET_FIRST_ACTION, cat)).toBe(1);
    expect(getCapacity(state, u.id, BUCKET_SECOND_ACTION, cat)).toBe(1);
  });

  it('returns the v1 baseline for Reaction / Support / Movement (3 each)', () => {
    expect(getCapacity(state, u.id, BUCKET_REACTION, cat)).toBe(3);
    expect(getCapacity(state, u.id, BUCKET_SUPPORT, cat)).toBe(3);
    expect(getCapacity(state, u.id, BUCKET_MOVEMENT, cat)).toBe(3);
  });

  it('throws on an unknown BucketId', () => {
    expect(() => getCapacity(state, u.id, bucketId('not_a_bucket'), cat)).toThrow(
      /unknown BucketId/,
    );
  });
});
