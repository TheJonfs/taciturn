// UnitDossier — the per-unit progression screen (TABA M2 UI, View 2).
//
// Header + tabbed body. The header is the spine of the three-JP-quantities
// model, each in its OWN home:
//   - Class purse   = availableInClass  → the header purse ("Monk purse · 260").
//   - Class spent   = spentInClass (derived) → "X spent as Monk".
//   - Earned        = earnedInClass     → "X earned".
// XP is a SINGLE per-unit value (not mirrored per class): "xp / 100 to next".
//
// Tabs: Constellation (reclass) · Training (JP-spend) · Equipment (M3,
// disabled). The dossier owns the progression OPS (reclassUnit, purchaseComponent)
// and hands the resulting unit up via `onChange` to persist; the parent stays a
// dumb store. Picking an open star reclasses (if not current) and drops into
// Training. A purchase that crosses a threshold ignites the newly-opened star(s)
// and toasts.

import { useCallback, useRef, useState, type ReactElement } from 'react';
import { buildBaseStats } from '@content/teams/index.ts';
import type { Catalog, ClassId } from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  availableInClass,
  earnedInClass,
  purchaseComponent,
  reclassUnit,
  spentInClass,
  tierEntryOf,
  type CampaignUnit,
  type ComponentCatalog,
  type UnlockToken,
} from '@campaign/index.ts';
import { DOMAIN_COLOR, DOMAIN_LABEL } from './roster-view-model.ts';
import { Constellation } from './Constellation.tsx';
import { Training } from './Training.tsx';
import { FORMATION_STYLE } from './formation-style.ts';

// XP per level (ADR-0139). Single per-unit currency, independent of JP.
const XP_PER_LEVEL = 100;

type DossierTab = 'constellation' | 'training';

export interface UnitDossierProps {
  readonly unit: CampaignUnit;
  readonly catalog: Catalog;
  readonly onBack: () => void;
  // Persist a progression edit (reclass / purchase) up to the campaign owner.
  readonly onChange: (next: CampaignUnit) => void;
  readonly componentCatalog?: ComponentCatalog;
}

export function UnitDossier({
  unit,
  catalog,
  onBack,
  onChange,
  componentCatalog = COMPONENT_CATALOG,
}: UnitDossierProps): ReactElement {
  const [tab, setTab] = useState<DossierTab>('constellation');
  const [justIgnited, setJustIgnited] = useState<ClassId | null>(null);
  const [toast, showToast] = useToast();

  const classDef = catalog.getClass(unit.classId);
  const entry = tierEntryOf(unit.classId);
  const col = DOMAIN_COLOR[entry.half];
  const stats = buildBaseStats(unit.classId, unit.brave, unit.faith, unit.level);

  const purse = availableInClass(unit, unit.classId, componentCatalog);
  const spent = spentInClass(unit, unit.classId, componentCatalog);
  const earned = earnedInClass(unit, unit.classId);

  function pickClass(id: ClassId): void {
    if (id !== unit.classId) {
      onChange(reclassUnit(unit, id, catalog));
      showToast(`Now training as ${catalog.getClass(id).name}`);
    }
    setJustIgnited(null);
    setTab('training');
  }

  function buy(token: UnlockToken): void {
    const { unit: next, ignited } = purchaseComponent(unit, token, componentCatalog);
    onChange(next);
    if (ignited.length > 0) {
      const names = ignited.map((c) => catalog.getClass(c).name).join(', ');
      setJustIgnited(ignited[0] ?? null);
      showToast(`Threshold crossed — ${names} ${ignited.length > 1 ? 'ignite' : 'ignites'}!`);
    } else {
      setJustIgnited(null);
    }
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
            <Training unit={unit} catalog={catalog} onBuy={buy} componentCatalog={componentCatalog} />
          )}
        </div>
      </div>
      <div className={`tf-toast${toast ? ' show' : ''}`}>{toast}</div>
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

// A transient toast message with an auto-clearing timer.
function useToast(): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  return [msg, show];
}
