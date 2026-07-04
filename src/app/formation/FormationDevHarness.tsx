// Formation dev harness — a standalone mount for building/verifying the M2
// Formation UI against a RICH seeded roster.
//
// Fresh campaign units carry no JP/unlocks, so the real flow shows an empty
// celestial roster until several battles are fought. This harness layers a
// hand-authored progression spread onto the real `m1Roster` (real classes,
// names, loadouts — only `earnedByClass` + `unlocks` are synthesized) so every
// card state (aura, glint, trace, crest) and every dossier state renders now.
//
// Mounted by `main.tsx` when the URL carries `?formation`. Dev-only; not part
// of the shipped campaign flow. Safe to keep — formation work keeps needing a
// populated roster to look at.

import { useMemo, useState, type ReactElement } from 'react';
import { loadDefaultCatalog } from '@content/index.ts';
import { abilityId, classId, itemId, unitId, type UnitId } from '@engine/index.ts';
import { m1Roster, type CampaignUnit, type UnlockToken } from '@campaign/index.ts';
import { RosterView } from './RosterView.tsx';

const catalog = loadDefaultCatalog();

const ab = (id: string): UnlockToken => ({ kind: 'ability', id: abilityId(id) });
const it = (id: string): UnlockToken => ({ kind: 'item', id: itemId(id) });

// Per-unit synthesized progression, applied by roster index. `earned` is the
// per-class purse; `unlocks` the purchase record (must be real priced tokens so
// the derived spend/purse reconcile). `override` marks a plot-unique cadet.
interface Seed {
  readonly earned: Readonly<Record<string, number>>;
  readonly unlocks: ReadonlyArray<UnlockToken>;
  readonly override?: ReadonlyArray<string>;
}

const SEEDS: ReadonlyArray<Seed> = [
  // Heavy monk main, dabbled elsewhere, JP waiting → bright aura + glint + long trace.
  {
    earned: { monk: 1050, knight: 450, fire_mage: 550, enchanter: 500, thief: 100 },
    unlocks: [ab('bears_heave'), ab('serpents_coil'), ab('foxfire'), ab('storm_stoop'), ab('barehanded'),
      ab('power_attack'), ab('bull_rush'), ab('fire_strike'), ab('spark'), ab('enchant_protect'), ab('steal_hp')],
  },
  // Single-class mage, fully spent → no glint, one big trace dot.
  { earned: { lightning_mage: 1300 }, unlocks: [ab('lightning_strike'), ab('magnetic_mark'), ab('static_embrace'), ab('chain_lightning'), ab('storm_caller'), ab('discharge')] },
  // Knight with a monk splash, small purse left.
  { earned: { knight: 1100, monk: 250 }, unlocks: [ab('power_attack'), ab('bull_rush'), ab('lightning_stab'), ab('counter'), ab('martial_expertise'), ab('bears_heave')] },
  // Enchanter/aethurge, fully spent.
  { earned: { enchanter: 900, lightning_mage: 300 }, unlocks: [ab('enchant_protect'), ab('enchant_shell'), ab('esuna'), ab('enchant_haste'), ab('aura_mastery'), ab('lightning_strike'), ab('magnetic_mark')] },
  // Geosage spread, medium purse.
  { earned: { earth_mage: 800, fire_mage: 400, water_mage: 300 }, unlocks: [ab('earth_strike'), ab('earth_blessing'), ab('earth_quake'), ab('fire_strike'), ab('fire_storm'), ab('water_strike'), ab('brine')] },
  // Alchemist with items, tiny purse.
  { earned: { alchemist: 600 }, unlocks: [it('potion'), it('phoenix_down'), ab('combat_focus')] },
  // Terraformer veteran, fully invested.
  { earned: { terraformer: 1000, knight: 500, earth_mage: 500 }, unlocks: [ab('pillar'), ab('pit'), ab('hill'), ab('valley'), ab('barrier'), ab('power_attack'), ab('bull_rush'), ab('bravestrider'), ab('earth_strike'), ab('earth_blessing')] },
  // Templar with a big idle purse → strong glint.
  { earned: { templar: 700, enchanter: 400 }, unlocks: [ab('jump'), ab('cure'), ab('emissary'), ab('enchant_protect')] },
];

// A couple of plot-unique cadets, appended so the crest + override states show.
const UNIQUE_SEEDS: ReadonlyArray<{ readonly name: string; readonly classId: string; readonly seed: Seed }> = [
  { name: 'Vespa', classId: 'assassin', seed: { earned: { assassin: 750 }, unlocks: [ab('blowdart'), ab('undermine'), ab('sow_doubt'), ab('shadow_stitch')], override: ['assassin'] } },
  { name: 'Ptolemy', classId: 'calculator', seed: { earned: { calculator: 700 }, unlocks: [ab('precision_fire'), ab('targeted_treatment'), { kind: 'mathParameter', id: 'height' }, { kind: 'mathValue', id: 3 }], override: ['calculator'] } },
];

function buildDemoRoster(): ReadonlyArray<CampaignUnit> {
  const base: CampaignUnit[] = m1Roster.map((u, i) => {
    const seed = SEEDS[i % SEEDS.length]!;
    return {
      ...u,
      earnedByClass: seed.earned,
      unlocks: seed.unlocks,
      ...(seed.override ? { classAccessOverride: seed.override.map((c) => classId(c)) } : {}),
    };
  });
  const uniques: CampaignUnit[] = UNIQUE_SEEDS.map((u, i) => ({
    ...m1Roster[0]!,
    id: unitId(`demo-unique-${i}`),
    name: u.name,
    classId: classId(u.classId),
    level: 20 + i,
    earnedByClass: u.seed.earned,
    unlocks: u.seed.unlocks,
    classAccessOverride: (u.seed.override ?? []).map((c) => classId(c)),
  }));
  return [...base, ...uniques];
}

export function FormationDevHarness(): ReactElement {
  const roster = useMemo(buildDemoRoster, []);
  const [opened, setOpened] = useState<UnitId | null>(null);

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <RosterView
        roster={roster}
        catalog={catalog}
        onOpenUnit={(id) => {
          setOpened(id);
          // Dossier arrives in commit 2; log the selection until then.
          // eslint-disable-next-line no-console
          console.log('[formation-harness] open dossier for', String(id));
        }}
      />
      {opened !== null ? (
        <div
          style={{
            position: 'fixed', bottom: 12, left: 12, zIndex: 20, fontFamily: 'ui-monospace, monospace',
            fontSize: 12, color: '#d8b26c', background: '#1b2247', border: '1px solid #404b80',
            borderRadius: 8, padding: '6px 12px',
          }}
        >
          opened: {String(opened)} — dossier lands in commit 2
        </div>
      ) : null}
    </div>
  );
}
