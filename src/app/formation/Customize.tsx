// Customize — the merged Loadout tab (TABA M2 UI, restructured in M3).
//
// The Team Builder's proven two-column body, celestial-skinned: EQUIPMENT
// (five inventory-driven slot pickers — GearSlots) beside ABILITIES (the
// M2 loadout curation: primary shown, secondary picked, R/S/M passives
// toggled, reclass). Equipment mutates the same capacity numbers the
// ability buckets budget against, so the two live in ONE view — "why did
// my reaction disappear" has its answer on screen (gear-UI brief D1).
//
// Density refactors that keep the merged view co-visible without a
// scroll-fest: the reclass chip-row collapses behind a "Change class"
// affordance, and the Secondary/R/S/M sections are collapsible with
// their picks + used/capacity summarized in the always-visible header.
// Edits go through the pure loadout/equipment ops and up via `onChange`.

import { useState, type ReactElement } from 'react';
import type { AbilityId, Catalog, ClassId, CommandSetId } from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  reclassableClasses,
  reclassUnit,
  tierEntryOf,
  type CampaignUnit,
  type ComponentCatalog,
  type InventoryRecord,
} from '@campaign/index.ts';
import { DOMAIN_COLOR } from './roster-view-model.ts';
import {
  bucketCapacity,
  bucketUsed,
  PASSIVE_BUCKETS,
  PASSIVE_BUCKET_LABEL,
  currentSecondary,
  equippableSecondaryCommands,
  equippablePassives,
  primaryCommand,
  setSecondaryCommand,
  togglePassive,
  type PassiveBucket,
  type PassiveOption,
  type SecondaryOption,
} from './customize-view-model.ts';
import { GearSlots } from './GearSlots.tsx';

export interface CustomizeProps {
  readonly unit: CampaignUnit;
  // The whole roster + party inventory: equipment options respect
  // cross-unit instance counts (an item equipped elsewhere isn't free).
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly inventory: InventoryRecord;
  readonly catalog: Catalog;
  readonly onChange: (next: CampaignUnit) => void;
  readonly componentCatalog?: ComponentCatalog;
}

export function Customize({
  unit,
  roster,
  inventory,
  catalog,
  onChange,
  componentCatalog = COMPONENT_CATALOG,
}: CustomizeProps): ReactElement {
  const col = DOMAIN_COLOR[tierEntryOf(unit.classId).half];
  const primary = primaryCommand(unit, catalog);
  const secondary = currentSecondary(unit);
  const secondaryOptions = equippableSecondaryCommands(unit, catalog, componentCatalog);
  const passives = equippablePassives(unit, catalog, componentCatalog);
  const [changingClass, setChangingClass] = useState(false);

  // Classes this unit can reclass INTO (excluding the current one).
  const reclassOptions = reclassableClasses(unit, componentCatalog)
    .filter((id) => id !== unit.classId)
    .map((id) => ({ id, name: catalog.getClass(id).name, color: DOMAIN_COLOR[tierEntryOf(id).half] }))
    .sort((a, b) => a.name.localeCompare(b.name));

  function pickSecondary(id: CommandSetId | null): void {
    onChange(setSecondaryCommand(unit, id));
  }
  function toggle(id: AbilityId, bucket: PassiveBucket): void {
    onChange(togglePassive(unit, id, bucket, bucketCapacity(unit, bucket, catalog), catalog));
  }
  function reclass(id: ClassId): void {
    setChangingClass(false);
    onChange(reclassUnit(unit, id, catalog, componentCatalog));
  }

  const secondaryName =
    secondary !== null && catalog.hasCommandSet(secondary)
      ? catalog.getCommandSet(secondary).name
      : 'None';

  return (
    <div className="tf-load-cols">
      <div>
        <GearSlots
          unit={unit}
          roster={roster}
          inventory={inventory}
          catalog={catalog}
          col={col}
          onChange={onChange}
        />
      </div>

      <div className="tf-compact">
        <div className="tf-load-sec" style={{ marginTop: 12 }}>
          <div className="tf-load-h">
            <h3 style={{ color: col }}>Class</h3>
            <span className="tf-load-c">primary command is class-bound</span>
          </div>
          <div className="tf-opt locked">
            <span className="tf-opt-sw" style={{ background: col }} />
            <div className="tf-opt-info">
              <div className="tf-opt-nm">
                {catalog.getClass(unit.classId).name}
                <span className="tf-opt-tag innate">current</span>
              </div>
              <div className="tf-opt-fx">Primary command: {primary.name}</div>
            </div>
            {reclassOptions.length > 0 && (
              <button
                type="button"
                className="tf-class-btn"
                onClick={() => setChangingClass((v) => !v)}
              >
                {changingClass ? 'Keep class' : 'Change class'}
              </button>
            )}
          </div>
          {changingClass && (
            <div className="tf-class-row">
              {reclassOptions.map((c) => (
                <button
                  key={String(c.id)}
                  type="button"
                  className="tf-class-chip"
                  style={{ ['--cc' as string]: c.color }}
                  onClick={() => reclass(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {reclassOptions.length === 0 && (
            <div className="tf-load-empty">No other classes open yet — invest JP to unlock reclass options.</div>
          )}
        </div>

        <CollapsibleSection
          col={col}
          title="Secondary Command"
          meta={`${secondary ? '1' : '0'} / ${bucketCapacity(unit, 'secondary_command_sets', catalog)}`}
          summary={secondaryName}
        >
          <SecondaryRow
            selected={secondary === null}
            onClick={() => pickSecondary(null)}
            swatch="#3d456e"
            name="None"
            meta="no secondary command"
          />
          {secondaryOptions.length === 0 ? (
            <div className="tf-load-empty">Train an active in another class to unlock a secondary command.</div>
          ) : (
            secondaryOptions.map((opt) => (
              <SecondaryOptionRow
                key={String(opt.commandSetId)}
                opt={opt}
                selected={secondary === opt.commandSetId}
                onClick={() => pickSecondary(opt.commandSetId)}
              />
            ))
          )}
        </CollapsibleSection>

        {PASSIVE_BUCKETS.map((bucket) => (
          <PassiveSection
            key={bucket}
            bucket={bucket}
            col={col}
            options={passives[bucket]}
            used={bucketUsed(unit, bucket, catalog)}
            capacity={bucketCapacity(unit, bucket, catalog)}
            equippedNames={passives[bucket].filter((o) => o.equipped).map((o) => o.name)}
            onToggle={(id) => toggle(id, bucket)}
          />
        ))}
      </div>
    </div>
  );
}

// A section whose header (title · used/capacity · current picks) stays
// visible while the option rows collapse away — the density refactor
// that keeps equipment consequences and ability budgets co-visible.
function CollapsibleSection({
  col,
  title,
  meta,
  summary,
  defaultOpen = false,
  children,
}: {
  readonly col: string;
  readonly title: string;
  readonly meta: string;
  readonly summary: string;
  readonly defaultOpen?: boolean;
  readonly children: React.ReactNode;
}): ReactElement {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="tf-load-sec">
      <div
        className="tf-load-h click"
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        <h3 style={{ color: col }}>
          <span className={`tf-chev${open ? ' open' : ''}`}>▸</span> {title}
        </h3>
        <span className="tf-load-c">{meta}</span>
        {!open && <span className="tf-load-sum">{summary}</span>}
      </div>
      {open && children}
    </div>
  );
}

function SecondaryOptionRow({
  opt,
  selected,
  onClick,
}: {
  readonly opt: SecondaryOption;
  readonly selected: boolean;
  readonly onClick: () => void;
}): ReactElement {
  return (
    <SecondaryRow
      selected={selected}
      onClick={onClick}
      swatch={opt.color}
      name={opt.commandName}
      meta={`${opt.className} · ${opt.domain}`}
    />
  );
}

function SecondaryRow({
  selected,
  onClick,
  swatch,
  name,
  meta,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly swatch: string;
  readonly name: string;
  readonly meta: string;
}): ReactElement {
  return (
    <button type="button" className={`tf-opt pick${selected ? ' on' : ''}`} onClick={onClick}>
      <span className="tf-opt-sw" style={{ background: swatch }} />
      <div className="tf-opt-info">
        <div className="tf-opt-nm">{name}</div>
        <div className="tf-opt-fx">{meta}</div>
      </div>
      <span className="tf-opt-check">{selected ? '✓' : ''}</span>
    </button>
  );
}

function PassiveSection({
  bucket,
  col,
  options,
  used,
  capacity,
  equippedNames,
  onToggle,
}: {
  readonly bucket: PassiveBucket;
  readonly col: string;
  readonly options: ReadonlyArray<PassiveOption>;
  readonly used: number;
  readonly capacity: number;
  readonly equippedNames: ReadonlyArray<string>;
  readonly onToggle: (id: AbilityId) => void;
}): ReactElement {
  const remaining = capacity - used;
  return (
    <CollapsibleSection
      col={col}
      title={PASSIVE_BUCKET_LABEL[bucket]}
      meta={`${used} / ${capacity} slots`}
      summary={equippedNames.length > 0 ? equippedNames.join(' · ') : '—'}
    >
      {options.length === 0 ? (
        <div className="tf-load-empty">No {PASSIVE_BUCKET_LABEL[bucket].toLowerCase()} passives available yet.</div>
      ) : (
        options.map((opt) => (
          <PassiveRow
            key={String(opt.abilityId)}
            opt={opt}
            disabled={!opt.equipped && opt.cost > remaining}
            onToggle={() => onToggle(opt.abilityId)}
          />
        ))
      )}
    </CollapsibleSection>
  );
}

function PassiveRow({
  opt,
  disabled,
  onToggle,
}: {
  readonly opt: PassiveOption;
  readonly disabled: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`tf-opt pick${opt.equipped ? ' on' : ''}${disabled ? ' dis' : ''}`}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
    >
      <span className="tf-opt-check lead">{opt.equipped ? '✓' : ''}</span>
      <div className="tf-opt-info">
        <div className="tf-opt-nm">
          {opt.name}
          {opt.innate ? <span className="tf-opt-tag innate">innate</span> : <span className="tf-opt-tag exported">exported</span>}
        </div>
        <div className="tf-opt-fx">
          {opt.effect}
          {opt.condition ? <span className="tf-cond"> · needs {opt.condition}</span> : null}
        </div>
      </div>
      <span className="tf-opt-cost">{opt.cost === 0 ? 'free' : `${opt.cost} slot${opt.cost === 1 ? '' : 's'}`}</span>
    </button>
  );
}
