import { applyStackingRule } from './stacking.ts';
import { makeStatusInstance, makeStatusType } from './test-fixtures.ts';

describe('applyStackingRule (no existing instance)', () => {
  it('returns a fresh "applied" outcome regardless of rule', () => {
    const type = makeStatusType({ id: 'haste', stackingRule: 'REJECT' });
    const incoming = makeStatusInstance({ typeId: 'haste', magnitude: 1.5 });
    const out = applyStackingRule(type, [], incoming);
    expect(out.result).toEqual({ kind: 'applied', instance: incoming });
    expect(out.newInstancesOfType).toEqual([incoming]);
    expect(out.lifecycle.added).toEqual([incoming]);
    expect(out.lifecycle.removed).toEqual([]);
  });
});

describe('REFRESH', () => {
  it('keeps the existing instance, resets duration, no lifecycle hooks', () => {
    const type = makeStatusType({ id: 'haste', stackingRule: 'REFRESH' });
    const existing = makeStatusInstance({
      typeId: 'haste',
      magnitude: 1.5,
      remainingDuration: 1,
    });
    const incoming = makeStatusInstance({
      typeId: 'haste',
      magnitude: 99, // ignored — REFRESH preserves existing magnitude
      remainingDuration: 9,
    });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result.kind).toBe('refreshed');
    expect(out.newInstancesOfType).toHaveLength(1);
    const refreshed = out.newInstancesOfType[0]!;
    expect(refreshed.remainingDuration).toBe(9);
    expect(refreshed.magnitude).toBe(1.5);
    expect(out.lifecycle.added).toEqual([]);
    expect(out.lifecycle.removed).toEqual([]);
  });
});

describe('REPLACE', () => {
  it('unconditionally swaps in the incoming, fires onRemove + onApply', () => {
    const type = makeStatusType({ id: 'haste', stackingRule: 'REPLACE' });
    const existing = makeStatusInstance({ typeId: 'haste', magnitude: 2 });
    const incoming = makeStatusInstance({ typeId: 'haste', magnitude: 1 });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result).toEqual({
      kind: 'replaced',
      previousInstance: existing,
      instance: incoming,
    });
    expect(out.newInstancesOfType).toEqual([incoming]);
    expect(out.lifecycle.removed).toEqual([existing]);
    expect(out.lifecycle.added).toEqual([incoming]);
  });
});

describe('REPLACE_IF_STRONGER', () => {
  it('replaces when incoming magnitude is greater', () => {
    const type = makeStatusType({ id: 'haste', stackingRule: 'REPLACE_IF_STRONGER' });
    const existing = makeStatusInstance({ typeId: 'haste', magnitude: 1.2 });
    const incoming = makeStatusInstance({ typeId: 'haste', magnitude: 1.5 });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result.kind).toBe('replaced');
    expect(out.newInstancesOfType).toEqual([incoming]);
    expect(out.lifecycle.removed).toEqual([existing]);
    expect(out.lifecycle.added).toEqual([incoming]);
  });

  it('rejects when incoming magnitude is equal or smaller', () => {
    const type = makeStatusType({ id: 'haste', stackingRule: 'REPLACE_IF_STRONGER' });
    const existing = makeStatusInstance({ typeId: 'haste', magnitude: 1.5 });
    const incoming = makeStatusInstance({ typeId: 'haste', magnitude: 1.2 });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result).toEqual({ kind: 'rejected', reason: 'stacking_rule' });
    expect(out.newInstancesOfType).toEqual([existing]);
    expect(out.lifecycle.removed).toEqual([]);
    expect(out.lifecycle.added).toEqual([]);
  });
});

describe('STACK_INDEPENDENT', () => {
  it('appends incoming as a separate instance, fires onApply on it', () => {
    const type = makeStatusType({ id: 'poison', stackingRule: 'STACK_INDEPENDENT' });
    const existing = makeStatusInstance({ typeId: 'poison', magnitude: 5 });
    const incoming = makeStatusInstance({ typeId: 'poison', magnitude: 7 });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result).toEqual({ kind: 'stacked', mode: 'independent', instance: incoming });
    expect(out.newInstancesOfType).toEqual([existing, incoming]);
    expect(out.lifecycle.removed).toEqual([]);
    expect(out.lifecycle.added).toEqual([incoming]);
  });
});

describe('STACK_ADDITIVE', () => {
  it('merges magnitudes, refreshes duration, increments stacks, no lifecycle hooks', () => {
    const type = makeStatusType({ id: 'shell', stackingRule: 'STACK_ADDITIVE' });
    const existing = makeStatusInstance({
      typeId: 'shell',
      magnitude: 0.1,
      stacks: 2,
      remainingDuration: 1,
    });
    const incoming = makeStatusInstance({
      typeId: 'shell',
      magnitude: 0.05,
      remainingDuration: 5,
    });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result.kind).toBe('stacked');
    if (out.result.kind === 'stacked') {
      expect(out.result.mode).toBe('additive');
      expect(out.result.instance.magnitude).toBeCloseTo(0.15);
      expect(out.result.instance.stacks).toBe(3);
      expect(out.result.instance.remainingDuration).toBe(5);
    }
    expect(out.lifecycle.removed).toEqual([]);
    expect(out.lifecycle.added).toEqual([]);
  });
});

describe('REJECT', () => {
  it('drops the incoming application, no state change, no lifecycle hooks', () => {
    const type = makeStatusType({ id: 'lock', stackingRule: 'REJECT' });
    const existing = makeStatusInstance({ typeId: 'lock' });
    const incoming = makeStatusInstance({ typeId: 'lock' });
    const out = applyStackingRule(type, [existing], incoming);
    expect(out.result).toEqual({ kind: 'rejected', reason: 'stacking_rule' });
    expect(out.newInstancesOfType).toEqual([existing]);
    expect(out.lifecycle.removed).toEqual([]);
    expect(out.lifecycle.added).toEqual([]);
  });
});
