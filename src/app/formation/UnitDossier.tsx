// UnitDossier — the per-unit progression screen (TABA M2 UI, View 2).
//
// Header + tabbed body. The header is the spine of the three-JP-quantities
// model, each in its OWN home:
//   - Class purse   = availableInClass  → the header purse ("Monk purse · 260").
//   - Class spent   = spentInClass (derived) → "X spent as Monk".
//   - Earned        = earnedInClass     → "X earned".
// XP is a SINGLE per-unit value (not mirrored per class): "xp / 100 to next".
//
// Tabs: Constellation (view trees) · Training (JP-spend) · Loadout (the M3
// merged equipment|abilities view — the old "Equipment · soon" stub tab is
// gone; gear lives IN Loadout so equipment-adjusted capacity is co-visible
// with the buckets it constrains).
// The dossier owns the progression OPS (reclassUnit, purchaseComponent)
// and hands the resulting unit up via `onChange` to persist; the parent stays a
// dumb store. Picking an open star reclasses (if not current) and drops into
// Training. A purchase that crosses a threshold ignites the newly-opened star(s)
// and toasts.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Catalog, ClassId } from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  availableInClass,
  earnedInClass,
  purchaseComponent,
  spentInClass,
  tierEntryOf,
  type CampaignUnit,
  type ComponentCatalog,
  type InventoryRecord,
  type UnlockToken,
} from '@campaign/index.ts';
import { DOMAIN_COLOR, DOMAIN_LABEL } from './roster-view-model.ts';
import { Constellation } from './Constellation.tsx';
import { Training } from './Training.tsx';
import { Customize } from './Customize.tsx';
import { FORMATION_STYLE } from './formation-style.ts';
import { resolveUnitPortrait } from '../../assets/portraits/index.ts';
import {
  effectiveUnitStats,
  projectGearStats,
  projectPassiveStats,
  unitLegality,
  type LoadoutFocus,
} from './gear-view-model.ts';
import type { EffectiveUnitStats } from '@campaign/index.ts';

// XP per level (ADR-0139). Single per-unit currency, independent of JP.
const XP_PER_LEVEL = 100;

type DossierTab = 'constellation' | 'training' | 'loadout';

export interface UnitDossierProps {
  readonly unit: CampaignUnit;
  // The whole roster + party inventory (M3): the Loadout tab's equipment
  // pickers respect cross-unit instance counts.
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly inventory: InventoryRecord;
  readonly catalog: Catalog;
  readonly onBack: () => void;
  // Persist a progression edit (reclass / purchase / equip) up to the
  // campaign owner.
  readonly onChange: (next: CampaignUnit) => void;
  readonly componentCatalog?: ComponentCatalog;
}

export function UnitDossier({
  unit,
  roster,
  inventory,
  catalog,
  onBack,
  onChange,
  componentCatalog = COMPONENT_CATALOG,
}: UnitDossierProps): ReactElement {
  const [tab, setTab] = useState<DossierTab>('constellation');
  // The class whose tree the Constellation/Training tabs are viewing — defaults
  // to the current class; a star click points it at another OPEN class (view its
  // Training without reclassing — reclass now lives on the Loadout tab).
  const [viewClassId, setViewClassId] = useState<ClassId>(unit.classId);
  const [justIgnited, setJustIgnited] = useState<ClassId | null>(null);
  const [toast, showToast] = useToast();

  // When the unit's ACTUAL class changes (a reclass committed on the Loadout
  // tab), snap the viewed class to it and toast — but not on the initial mount.
  const lastClass = useRef<ClassId>(unit.classId);
  useEffect(() => {
    if (lastClass.current === unit.classId) return;
    lastClass.current = unit.classId;
    setViewClassId(unit.classId);
    showToast(`Reclassed to ${catalog.getClass(unit.classId).name}`);
  }, [unit.classId, catalog, showToast]);

  const classDef = catalog.getClass(unit.classId);
  const entry = tierEntryOf(unit.classId);
  const col = DOMAIN_COLOR[entry.half];
  // Bespoke plot face where one exists, else the class+gender portrait; the
  // capital-letter monogram remains the final fallback.
  const sealPortrait = resolveUnitPortrait(unit.portrait, unit.classId, unit.gender);
  // M3 Stage 3: the header shows the unit's EFFECTIVE stats — equipment/
  // passive/class-composed through the real fold (`effectiveUnitStats`
  // probes the same path battle entry takes), not the class baseline.
  // An invalid loadout reads its stats as unavailable — the numbers
  // would be lies (battle entry rejects this configuration), so the
  // header says so instead (mirrors the Team Builder's fallback).
  const invalid = !unitLegality(unit, catalog).valid;
  const effective = useMemo(
    () => (invalid ? null : effectiveUnitStats(unit, catalog)),
    [invalid, unit, catalog],
  );

  // What the Loadout tab's pickers are hovering (owned here, not in the
  // tab, because the header stat row previews the pick — the Mage War
  // StatBlock behavior: projected value shown, green up / red down).
  const [loadoutFocus, setLoadoutFocus] = useState<LoadoutFocus | null>(null);
  const projected = useMemo(() => {
    if (loadoutFocus === null || effective === null) return null;
    if (loadoutFocus.kind === 'gear') {
      return projectGearStats(unit, loadoutFocus.slot, loadoutFocus.itemId, catalog);
    }
    if (loadoutFocus.kind === 'passive') {
      return projectPassiveStats(unit, loadoutFocus.bucket, loadoutFocus.abilityId, catalog);
    }
    return null; // secondary commands don't move the stat line
  }, [loadoutFocus, effective, unit, catalog]);

  const stat = (key: keyof EffectiveUnitStats): { v: number | string; tone?: 'up' | 'down' } => {
    if (effective === null) return { v: '—' };
    const current = effective[key];
    const next = projected !== null ? projected[key] : current;
    const tone = next > current ? 'up' : next < current ? 'down' : undefined;
    return tone !== undefined ? { v: next, tone } : { v: next };
  };

  const purse = availableInClass(unit, unit.classId, componentCatalog);
  const spent = spentInClass(unit, unit.classId, componentCatalog);
  const earned = earnedInClass(unit, unit.classId);

  // Star click: view that class's Training (no reclass).
  function openClassTraining(id: ClassId): void {
    setViewClassId(id);
    setJustIgnited(null);
    setTab('training');
  }

  // Leaving the Loadout tab clears any lingering hover projection so the
  // header returns to the unit's real numbers.
  function switchTab(next: DossierTab): void {
    setLoadoutFocus(null);
    setTab(next);
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
            {sealPortrait !== null ? (
              <img className="tf-face" src={sealPortrait} alt="" />
            ) : (
              unit.name.trim().charAt(0).toUpperCase() || '?'
            )}
          </div>
          <div className="tf-doss-who">
            <div className="tf-doss-name">
              {unit.name}
              {invalid && (
                <span className="tf-doss-warn" title="Loadout invalid — fix it on the Loadout tab">
                  ⚠ loadout invalid
                </span>
              )}
            </div>
            <div className="tf-doss-sub">
              Level {unit.level} &nbsp;·&nbsp; <span style={{ color: col }}>{classDef.name}</span> &nbsp;·&nbsp;{' '}
              {DOMAIN_LABEL[entry.half]} Tier {entry.tier}
            </div>
            <div className="tf-doss-stats">
              <Stat k="hp" {...stat('maxHp')} />
              <Stat k="mp" {...stat('maxMp')} />
              <Stat k="pa" {...stat('pa')} />
              <Stat k="ma" {...stat('ma')} />
              <Stat k="spd" {...stat('spd')} />
              <Stat k="move" {...stat('moveRange')} />
              <Stat k="jump" {...stat('jump')} />
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
          <button type="button" className={`tf-tab${tab === 'constellation' ? ' on' : ''}`} onClick={() => switchTab('constellation')}>
            Constellation
          </button>
          <button type="button" className={`tf-tab${tab === 'training' ? ' on' : ''}`} onClick={() => switchTab('training')}>
            Training
          </button>
          <button type="button" className={`tf-tab${tab === 'loadout' ? ' on' : ''}`} onClick={() => switchTab('loadout')}>
            Loadout
          </button>
        </div>

        <div className="tf-panel">
          {tab === 'constellation' ? (
            <Constellation
              unit={unit}
              catalog={catalog}
              componentCatalog={componentCatalog}
              onPickClass={openClassTraining}
              justIgnited={justIgnited}
            />
          ) : tab === 'training' ? (
            <Training
              unit={unit}
              catalog={catalog}
              classId={viewClassId}
              isCurrentClass={viewClassId === unit.classId}
              onBuy={buy}
              componentCatalog={componentCatalog}
            />
          ) : (
            <Customize
              unit={unit}
              roster={roster}
              inventory={inventory}
              catalog={catalog}
              onChange={onChange}
              focus={loadoutFocus}
              onFocus={setLoadoutFocus}
              componentCatalog={componentCatalog}
            />
          )}
        </div>
      </div>
      <div className={`tf-toast${toast ? ' show' : ''}`}>{toast}</div>
    </div>
  );
}

function Stat({
  k,
  v,
  tone,
}: {
  readonly k: string;
  readonly v: number | string;
  // Hover preview tint (Mage War StatBlock): the value shown is the
  // PROJECTED one, coloured by direction.
  readonly tone?: 'up' | 'down';
}): ReactElement {
  return (
    <div className="tf-stat">
      {k}
      <b className={tone !== undefined ? `tf-stat-${tone}` : undefined}>
        {typeof v === 'number' ? v.toLocaleString() : v}
      </b>
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
