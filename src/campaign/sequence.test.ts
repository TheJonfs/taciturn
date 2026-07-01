// Pure tests for the node beat-sequence cursor helpers (M1.5 battle-as-beat).
// These prove the sequence progression the driver walks — the 3+-beat case,
// the battle-less case, and the battle-beat launch/resume boundary — without
// any React (the driver's first test, per the brief; the UI wiring is verified
// by hand).

import { describe, expect, it } from 'vitest';
import {
  battleBeats,
  firstBattleBeat,
  hasBattleAtOrAfter,
  isStandalone,
  takeStoryRun,
  type BattleBeat,
  type NodeBattle,
  type NodeBeat,
  type StorySceneBeat,
} from './sequence.ts';

// Minimal fakes — the cursor helpers inspect only `.type`, so a battle beat's
// interior is irrelevant here.
const story = (text: string): StorySceneBeat => ({
  type: 'story-scene',
  scene: { lines: [{ speaker: 'Narrator', text }] },
});
const battle = (): BattleBeat => ({ type: 'battle', battle: {} as NodeBattle });

describe('takeStoryRun', () => {
  it('takes the leading run of story beats and stops at a battle', () => {
    const beats: NodeBeat[] = [story('a'), story('b'), battle()];
    const run = takeStoryRun(beats, 0);
    expect(run.scenes).toHaveLength(2);
    expect(run.next).toBe(2);
  });

  it('returns an empty run when a battle sits at the cursor', () => {
    const beats: NodeBeat[] = [battle(), story('after')];
    const run = takeStoryRun(beats, 0);
    expect(run.scenes).toHaveLength(0);
    expect(run.next).toBe(0);
  });

  it('resumes the trailing story run after a battle beat', () => {
    // [story, battle, story] — the 3+-beat interleaving the brief calls out.
    const beats: NodeBeat[] = [story('intro'), battle(), story('aftermath')];
    expect(takeStoryRun(beats, 0)).toEqual({ scenes: [beats[0]], next: 1 });
    expect(takeStoryRun(beats, 2)).toEqual({ scenes: [beats[2]], next: 3 });
  });

  it('takes nothing at the end of the sequence', () => {
    const beats: NodeBeat[] = [story('only')];
    expect(takeStoryRun(beats, 1)).toEqual({ scenes: [], next: 1 });
  });
});

describe('battleBeats / firstBattleBeat', () => {
  it('finds every battle beat in authored order', () => {
    const beats: NodeBeat[] = [story('a'), battle(), story('b'), battle()];
    expect(battleBeats(beats)).toHaveLength(2);
    expect(firstBattleBeat(beats)).toBe(beats[1]);
  });

  it('reports no battle for a standalone story node', () => {
    const beats: NodeBeat[] = [story('a'), story('b')];
    expect(battleBeats(beats)).toHaveLength(0);
    expect(firstBattleBeat(beats)).toBeUndefined();
  });
});

describe('hasBattleAtOrAfter', () => {
  it('is true when a battle sits at or after the cursor', () => {
    const beats: NodeBeat[] = [story('intro'), battle(), story('aftermath')];
    expect(hasBattleAtOrAfter(beats, 0)).toBe(true);
    expect(hasBattleAtOrAfter(beats, 1)).toBe(true);
  });

  it('is false once every battle beat is behind the cursor', () => {
    const beats: NodeBeat[] = [story('intro'), battle(), story('aftermath')];
    // After winning the battle (cursor past index 1), no fights remain — the
    // node is battle-cleared and the driver resolves/routes.
    expect(hasBattleAtOrAfter(beats, 2)).toBe(false);
  });

  it('is false for a battle-less node', () => {
    expect(hasBattleAtOrAfter([story('a')], 0)).toBe(false);
  });
});

describe('isStandalone', () => {
  it('is true only when the node has no battle beat', () => {
    expect(isStandalone([story('a'), story('b')])).toBe(true);
    expect(isStandalone([story('a'), battle()])).toBe(false);
    expect(isStandalone([battle()])).toBe(false);
  });
});
