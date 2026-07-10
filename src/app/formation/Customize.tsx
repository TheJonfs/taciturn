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
import { LoadoutInspector } from './LoadoutInspector.tsx';
import { legalityCauses, unitLegality, type LoadoutFocus } from './gear-view-model.ts';
import { bucketId } from '@engine/index.ts';

export interface CustomizeProps {
  readonly unit: CampaignUnit;
  // The whole roster + party inventory: equipment options respect
  // cross-unit instance counts (an item equipped elsewhere isn't free).
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly inventory: InventoryRecord;
  readonly catalog: Catalog;
  readonly onChange: (next: CampaignUnit) => void;
  // The hover focus is OWNED BY THE DOSSIER (S86): the header stat row
  // tints with the projected pick (the Mage War StatBlock behavior), so
  // the parent needs to see what's hovered; this tab reports and renders.
  readonly focus: LoadoutFocus | null;
  readonly onFocus: (focus: LoadoutFocus | null) => void;
  readonly componentCatalog?: ComponentCatalog;
}

export function Customize({
  unit,
  roster,
  inventory,
  catalog,
  onChange,
  focus,
  onFocus,
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

  // The shared draft resolver's verdict (D3 — the same check battle entry
  // enforces). Invalid states are HELD and surfaced with their causes;
  // deploy blocks elsewhere. Never auto-resolved here (D2).
  const legality = unitLegality(unit, catalog);
  const causes = legality.valid ? [] : legalityCauses(legality, unit, catalog);
  const overBuckets = new Set(legality.bucketOverages.map((o) => String(o.bucketId)));

  return (
    <div className="tf-load-cols">
      {causes.length > 0 && (
        <div className="tf-warnbar" role="alert">
          <span className="sig">⚠</span>
          <div className="bd">
            <div className="ttl">Loadout invalid — this unit cannot deploy until it&apos;s fixed</div>
            <ul>
              {causes.map((cause) => (
                <li key={cause}>{cause}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div>
        <GearSlots
          unit={unit}
          roster={roster}
          inventory={inventory}
          catalog={catalog}
          col={col}
          onChange={onChange}
          onFocus={onFocus}
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
          over={overBuckets.has('secondary_command_sets')}
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
                onHover={(on) =>
                  onFocus(on ? { kind: 'secondary', commandSetId: opt.commandSetId } : null)
                }
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
            over={overBuckets.has(bucket)}
            equippedNames={passives[bucket].filter((o) => o.equipped).map((o) => o.name)}
            onToggle={(id) => toggle(id, bucket)}
            onHover={(opt, on) =>
              onFocus(
                on
                  ? {
                      kind: 'passive',
                      bucket: bucketId(bucket),
                      abilityId: opt.abilityId,
                      equipped: opt.equipped,
                      cost: opt.cost,
                    }
                  : null,
              )
            }
          />
        ))}
      </div>

      <LoadoutInspector focus={focus} unit={unit} catalog={catalog} />
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
  over = false,
  defaultOpen = false,
  children,
}: {
  readonly col: string;
  readonly title: string;
  readonly meta: string;
  readonly summary: string;
  // Over-capacity (or otherwise in violation): the header's used/capacity
  // reads in the warning colour so the cause is visible even collapsed.
  readonly over?: boolean;
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
        <span className={`tf-load-c${over ? ' over' : ''}`}>{over ? '⚠ ' : ''}{meta}</span>
        {!open && <span className="tf-load-sum">{summary}</span>}
      </div>
      {/* Capped + inner-scrolled so a deep option list can't push the
          inspector below the fold (S86 — Chris's MacBook report). */}
      {open && <div className="tf-opt-scroll">{children}</div>}
    </div>
  );
}

function SecondaryOptionRow({
  opt,
  selected,
  onClick,
  onHover,
}: {
  readonly opt: SecondaryOption;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly onHover: (on: boolean) => void;
}): ReactElement {
  return (
    <SecondaryRow
      selected={selected}
      onClick={onClick}
      swatch={opt.color}
      name={opt.commandName}
      meta={`${opt.className} · ${opt.domain}`}
      onHover={onHover}
    />
  );
}

function SecondaryRow({
  selected,
  onClick,
  swatch,
  name,
  meta,
  onHover,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly swatch: string;
  readonly name: string;
  readonly meta: string;
  readonly onHover?: (on: boolean) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`tf-opt pick${selected ? ' on' : ''}`}
      onClick={onClick}
      onMouseEnter={onHover !== undefined ? () => onHover(true) : undefined}
      onMouseLeave={onHover !== undefined ? () => onHover(false) : undefined}
    >
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
  over,
  equippedNames,
  onToggle,
  onHover,
}: {
  readonly bucket: PassiveBucket;
  readonly col: string;
  readonly options: ReadonlyArray<PassiveOption>;
  readonly used: number;
  readonly capacity: number;
  readonly over: boolean;
  readonly equippedNames: ReadonlyArray<string>;
  readonly onToggle: (id: AbilityId) => void;
  readonly onHover: (opt: PassiveOption, on: boolean) => void;
}): ReactElement {
  const remaining = capacity - used;
  return (
    <CollapsibleSection
      col={col}
      title={PASSIVE_BUCKET_LABEL[bucket]}
      meta={`${used} / ${capacity} slots`}
      over={over}
      summary={equippedNames.length > 0 ? equippedNames.join(' · ') : '—'}
      defaultOpen={over}
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
            onHover={(on) => onHover(opt, on)}
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
  onHover,
}: {
  readonly opt: PassiveOption;
  readonly disabled: boolean;
  readonly onToggle: () => void;
  readonly onHover: (on: boolean) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className={`tf-opt pick${opt.equipped ? ' on' : ''}${disabled ? ' dis' : ''}`}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
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
