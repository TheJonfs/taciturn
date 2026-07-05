import { describe, expect, it } from 'vitest';
import { classId } from '@engine/index.ts';
import { CLASS_TIER_MAP, tierSlot, type TierSlot } from '@campaign/index.ts';
import {
  STAR_LAYOUT,
  aggregateCard,
  lockReason,
} from './constellation-layout.ts';

describe('STAR_LAYOUT', () => {
  it('has one node per class in the tier map', () => {
    expect(STAR_LAYOUT).toHaveLength(CLASS_TIER_MAP.size);
    const ids = new Set(STAR_LAYOUT.map((n) => String(n.classId)));
    for (const id of CLASS_TIER_MAP.keys()) expect(ids.has(String(id))).toBe(true);
  });

  it('places co-slot classes symmetrically around their column centre', () => {
    // Physical T1 has three classes → spread around x=180.
    const t1 = STAR_LAYOUT.filter((n) => n.slot === 'physical:1').sort((a, b) => a.x - b.x);
    expect(t1).toHaveLength(3);
    const xs = t1.map((n) => n.x);
    expect(xs[1]).toBe(180); // middle on the column centre
    expect(xs[0]! + xs[2]!).toBe(360); // symmetric
    expect(t1.every((n) => n.y === 430)).toBe(true); // Horizon row
  });

  it('puts Zenith classes above Horizon classes (smaller y = higher)', () => {
    const assassin = STAR_LAYOUT.find((n) => n.classId === classId('assassin'))!;
    const monk = STAR_LAYOUT.find((n) => n.classId === classId('monk'))!;
    expect(assassin.y).toBeLessThan(monk.y);
  });
});

describe('lockReason', () => {
  const empty = new Map<TierSlot, number>();
  const node = (slot: TierSlot) => STAR_LAYOUT.find((n) => n.slot === slot)!;

  it('names the physical-T1 shortfall for a locked physical T2', () => {
    expect(lockReason(node('physical:2'), empty)).toBe('+500 JP in Physical T1');
    const partial = new Map<TierSlot, number>([[tierSlot('physical', 1), 300]]);
    expect(lockReason(node('physical:2'), partial)).toBe('+200 JP in Physical T1');
  });

  it('names both shortfalls for a locked magical T3', () => {
    expect(lockReason(node('magical:3'), empty)).toBe('+1000 T1 · +500 T2');
    const one = new Map<TierSlot, number>([
      [tierSlot('magical', 1), 1000],
      [tierSlot('magical', 2), 200],
    ]);
    expect(lockReason(node('magical:3'), one)).toBe('+300 JP in Magical T2');
  });

  it('describes the hybrid-T2 both-halves gate', () => {
    expect(lockReason(node('hybrid:2'), empty)).toBe("need 500 in both halves' T1");
  });

  it('routes a locked T1 half through the other half T1 threshold', () => {
    expect(lockReason(node('physical:1'), empty)).toBe('+500 JP in Magical T1');
    const partial = new Map<TierSlot, number>([[tierSlot('magical', 1), 350]]);
    expect(lockReason(node('physical:1'), partial)).toBe('+150 JP in Magical T1');
  });
});

describe('aggregateCard', () => {
  it('reports both tier-slot totals and the next-threshold copy', () => {
    const spent = new Map<TierSlot, number>([
      [tierSlot('physical', 1), 300],
      [tierSlot('physical', 2), 0],
    ]);
    const card = aggregateCard('physical', spent);
    expect(card).toMatchObject({ t1: 300, t2: 0, t1Need: 1000, t2Need: 500 });
    expect(card.nextText).toBe('200 more in Tier I opens Tier II');
  });

  it('flags Tier III open when both thresholds are met', () => {
    const spent = new Map<TierSlot, number>([
      [tierSlot('magical', 1), 1000],
      [tierSlot('magical', 2), 500],
    ]);
    expect(aggregateCard('magical', spent).nextText).toBe('Tier III open — both thresholds met');
  });

  it('names the remaining T3 shortfalls past the T2 gate', () => {
    const spent = new Map<TierSlot, number>([
      [tierSlot('physical', 1), 700],
      [tierSlot('physical', 2), 200],
    ]);
    expect(aggregateCard('physical', spent).nextText).toBe('Tier III needs +300 in Tier I · +300 in Tier II');
  });
});
