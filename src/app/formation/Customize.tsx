// Customize — the Loadout tab (TABA M2 UI, dossier View 2).
//
// Curate what a unit's learned kit actually equips: the PRIMARY command (fixed
// by class — shown, not editable), a SECONDARY command (one class whose actives
// you've invested in), and the R/S/M passives (current-class passives free;
// exported ones once unlocked). Edits go through the pure loadout ops and up via
// `onChange`. Capacity is the ruleset baseline (secondary 1, R/S/M 3).

import { type ReactElement } from 'react';
import type { AbilityId, Catalog, ClassId, CommandSetId } from '@engine/index.ts';
import {
  COMPONENT_CATALOG,
  reclassableClasses,
  reclassUnit,
  tierEntryOf,
  type CampaignUnit,
  type ComponentCatalog,
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

export interface CustomizeProps {
  readonly unit: CampaignUnit;
  readonly catalog: Catalog;
  readonly onChange: (next: CampaignUnit) => void;
  readonly componentCatalog?: ComponentCatalog;
}

export function Customize({
  unit,
  catalog,
  onChange,
  componentCatalog = COMPONENT_CATALOG,
}: CustomizeProps): ReactElement {
  const col = DOMAIN_COLOR[tierEntryOf(unit.classId).half];
  const primary = primaryCommand(unit, catalog);
  const secondary = currentSecondary(unit);
  const secondaryOptions = equippableSecondaryCommands(unit, catalog, componentCatalog);
  const passives = equippablePassives(unit, catalog, componentCatalog);

  // Classes this unit can reclass INTO (excluding the current one) — the reclass
  // control that replaces the constellation's old click-to-reclass.
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
    onChange(reclassUnit(unit, id, catalog, componentCatalog));
  }

  return (
    <div>
      <div className="tf-load-sec">
        <div className="tf-load-h">
          <h3 style={{ color: col }}>Class</h3>
          <span className="tf-load-c">reclass rebinds your command &amp; frees now-illegal passives</span>
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
        </div>
        {reclassOptions.length > 0 ? (
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
        ) : (
          <div className="tf-load-empty">No other classes open yet — invest JP to unlock reclass options.</div>
        )}
      </div>

      <div className="tf-load-sec">
        <div className="tf-load-h">
          <h3 style={{ color: col }}>Secondary Command</h3>
          <span className="tf-load-c">
            {secondary ? '1' : '0'} / {bucketCapacity(unit, 'secondary_command_sets', catalog)} · a class you've trained actives in
          </span>
        </div>
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
      </div>

      {PASSIVE_BUCKETS.map((bucket) => (
        <PassiveSection
          key={bucket}
          bucket={bucket}
          col={col}
          options={passives[bucket]}
          used={bucketUsed(unit, bucket, catalog)}
          capacity={bucketCapacity(unit, bucket, catalog)}
          onToggle={(id) => toggle(id, bucket)}
        />
      ))}
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
  onToggle,
}: {
  readonly bucket: PassiveBucket;
  readonly col: string;
  readonly options: ReadonlyArray<PassiveOption>;
  readonly used: number;
  readonly capacity: number;
  readonly onToggle: (id: AbilityId) => void;
}): ReactElement {
  const remaining = capacity - used;
  return (
    <div className="tf-load-sec">
      <div className="tf-load-h">
        <h3 style={{ color: col }}>{PASSIVE_BUCKET_LABEL[bucket]}</h3>
        <span className="tf-load-c">
          {used} / {capacity} slots
        </span>
      </div>
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
    </div>
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
