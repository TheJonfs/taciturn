// UnitDossier — the per-unit progression screen (TABA M2 UI, View 2).
//
// Header + tabbed body. The header is the spine of the three-JP-quantities
// model, each in its OWN home:
//   - Class purse   = availableInClass  → the header purse ("Monk purse · 260").
//   - Class spent   = spentInClass (derived) → "X spent as Monk".
//   - Earned        = earnedInClass     → "X earned".
// XP is a SINGLE per-unit value (not mirrored per class): "xp / 100 to next".
//
// Tabs: Constellation (reclass) · Training (JP-spend — lands next) · Equipment
// (M3, disabled). Picking an open star reclasses (if not current) via the
// parent's `onReclass` and drops into Training.

import { useState, type ReactElement } from 'react';
import { buildBaseStats } from '@content/teams/index.ts';
import type { Catalog, ClassId } from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  availableInClass,
  earnedInClass,
  spentInClass,
  tierEntryOf,
  type CampaignUnit,
  type ComponentCatalog,
} from '@campaign/index.ts';
import { DOMAIN_COLOR, DOMAIN_LABEL } from './roster-view-model.ts';
import { Constellation } from './Constellation.tsx';
import { FORMATION_STYLE } from './formation-style.ts';

// XP per level (ADR-0139). Single per-unit currency, independent of JP.
const XP_PER_LEVEL = 100;

type DossierTab = 'constellation' | 'training';

export interface UnitDossierProps {
  readonly unit: CampaignUnit;
  readonly catalog: Catalog;
  readonly onBack: () => void;
  // Commit a reclass up to the campaign owner (runs `reclassUnit` + persists).
  readonly onReclass: (newClassId: ClassId) => void;
  readonly componentCatalog?: ComponentCatalog;
  readonly justIgnited?: ClassId | null;
}

export function UnitDossier({
  unit,
  catalog,
  onBack,
  onReclass,
  componentCatalog = COMPONENT_CATALOG,
  justIgnited = null,
}: UnitDossierProps): ReactElement {
  const [tab, setTab] = useState<DossierTab>('constellation');

  const classDef = catalog.getClass(unit.classId);
  const entry = tierEntryOf(unit.classId);
  const col = DOMAIN_COLOR[entry.half];
  const stats = buildBaseStats(unit.classId, unit.brave, unit.faith, unit.level);

  const purse = availableInClass(unit, unit.classId, componentCatalog);
  const spent = spentInClass(unit, unit.classId, componentCatalog);
  const earned = earnedInClass(unit, unit.classId);

  function pickClass(id: ClassId): void {
    if (id !== unit.classId) onReclass(id);
    setTab('training');
  }

  return (
    <div className="tf-root">
      <style>{FORMATION_STYLE}</style>
      <div className="tf-wrap tf-doss-wrap">
        <button type="button" className="tf-back" onClick={onBack}>
          ← Roster
        </button>

        <div className="tf-doss">
          <div className="tf-seal" style={{ color: col, borderColor: col, boxShadow: `0 0 20px -4px ${col}` }}>
            {unit.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="tf-doss-who">
            <div className="tf-doss-name">{unit.name}</div>
            <div className="tf-doss-sub">
              Level {unit.level} &nbsp;·&nbsp; <span style={{ color: col }}>{classDef.name}</span> &nbsp;·&nbsp;{' '}
              {DOMAIN_LABEL[entry.half]} Tier {entry.tier}
            </div>
            <div className="tf-doss-stats">
              <Stat k="hp" v={stats.maxHpBase} />
              <Stat k="mp" v={stats.maxMpBase} />
              <Stat k="pa" v={stats.pa} />
              <Stat k="ma" v={stats.ma} />
              <Stat k="spd" v={stats.spd} />
              <Stat k="xp→next" v={`${unit.xp % XP_PER_LEVEL} / ${XP_PER_LEVEL}`} />
            </div>
          </div>
          <div className="tf-purse">
            <div className="tf-purse-lab">{classDef.name} purse</div>
            <div className="tf-purse-val">
              {purse.toLocaleString()}
              <span className="u"> JP</span>
            </div>
            <div className="tf-purse-inv">
              {spent.toLocaleString()} spent as {classDef.name} · {earned.toLocaleString()} earned
            </div>
          </div>
        </div>

        <div className="tf-tabs">
          <button type="button" className={`tf-tab${tab === 'constellation' ? ' on' : ''}`} onClick={() => setTab('constellation')}>
            Constellation
          </button>
          <button type="button" className={`tf-tab${tab === 'training' ? ' on' : ''}`} onClick={() => setTab('training')}>
            Training
          </button>
          <button type="button" className="tf-tab dis" disabled>
            Equipment<span className="tf-tab-m">soon</span>
          </button>
        </div>

        <div className="tf-panel">
          {tab === 'constellation' ? (
            <Constellation
              unit={unit}
              catalog={catalog}
              componentCatalog={componentCatalog}
              onPickClass={pickClass}
              justIgnited={justIgnited}
            />
          ) : (
            <div className="tf-note">
              <b>Training</b> — JP-spend arrives in the next commit. This tab will list {classDef.name}'s
              unlockable components (actives, passives, and any items / math parameters), priced against
              the {purse.toLocaleString()} JP purse above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ k, v }: { readonly k: string; readonly v: number | string }): ReactElement {
  return (
    <div className="tf-stat">
      {k}
      <b>{typeof v === 'number' ? v.toLocaleString() : v}</b>
    </div>
  );
}
