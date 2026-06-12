// TeamBuilderInspector — the single context inspector below the unit
// card (Pass 2). It tracks whatever the player is hovering in the card
// body: an equipment candidate (full mechanical detail + delta vs the
// currently-equipped item) or an ability / command set (effect + how its
// cost fits the remaining budget). One box, two surfaces.
//
// Content is mechanical-only for v1 (Chris's call): the detail lines come
// from the shared `formatItemDetail` / `formatAbilityDetail` /
// `formatCommandSetDetail` (same source the in-battle panel reads), and
// the delta / budget-fit footer is computed here. Authored flavor prose
// is a later content pass.

import type { CSSProperties, ReactElement } from 'react';
import {
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
  type AbilityId,
  type BucketId,
  type Catalog,
  isEquipment,
  type CommandSetId,
  type EquipmentDefinition,
  type EquipmentSlotId,
  type ItemId,
} from '@engine/index.ts';
import {
  formatAbilityDetail,
  formatCommandSetDetail,
  formatItemDetail,
} from './detail-text.ts';
import {
  draftAbilityCost,
  draftBucketUsage,
  draftCommandSetCost,
} from './team-builder-state.ts';
import type { TeamBuilder } from './use-team-builder.ts';

// What the inspector is currently focused on — reported by the card
// body's pickers on hover, cleared on leave. Carries only identity; the
// inspector (which holds the builder + catalog) resolves detail and
// computes the delta / fit.
export type InspectorFocus =
  | { readonly kind: 'equipment'; readonly slot: EquipmentSlotId; readonly itemId: ItemId }
  | { readonly kind: 'ability'; readonly bucketId: BucketId; readonly abilityId: AbilityId }
  | { readonly kind: 'commandSet'; readonly commandSetId: CommandSetId };

export type SetInspectorFocus = (focus: InspectorFocus | null) => void;

const SLOT_LABEL: ReadonlyMap<EquipmentSlotId, string> = new Map([
  ['rightHand', 'right hand'],
  ['leftHand', 'left hand'],
  ['headgear', 'headgear'],
  ['armor', 'armor'],
  ['accessory', 'accessory'],
]);

function bucketLabel(bucketId: BucketId): string {
  if (bucketId === BUCKET_REACTION) return 'reaction';
  if (bucketId === BUCKET_SUPPORT) return 'support';
  if (bucketId === BUCKET_MOVEMENT) return 'movement';
  if (bucketId === BUCKET_SECONDARY_COMMAND_SETS) return 'command-set';
  return 'budget';
}

export interface TeamBuilderInspectorProps {
  readonly focus: InspectorFocus | null;
  readonly builder: TeamBuilder;
  readonly catalog: Catalog;
}

export function TeamBuilderInspector({
  focus,
  builder,
  catalog,
}: TeamBuilderInspectorProps): ReactElement {
  if (focus === null) {
    return (
      <div style={rootStyle}>
        <span style={hintStyle}>
          Hover an ability or a piece of equipment to inspect it here.
        </span>
      </div>
    );
  }
  if (focus.kind === 'equipment') {
    return <EquipmentInspector focus={focus} builder={builder} catalog={catalog} />;
  }
  if (focus.kind === 'ability') {
    return <AbilityInspector focus={focus} builder={builder} catalog={catalog} />;
  }
  return <CommandSetInspector focus={focus} builder={builder} catalog={catalog} />;
}

// ---- equipment ----

function EquipmentInspector({
  focus,
  builder,
  catalog,
}: {
  focus: Extract<InspectorFocus, { kind: 'equipment' }>;
  builder: TeamBuilder;
  catalog: Catalog;
}): ReactElement {
  const item = catalog.getItem(focus.itemId);
  const detail = formatItemDetail(item, catalog);
  const equippedId = builder.selectedUnit.equipment[focus.slot];
  const isEquipped = equippedId === focus.itemId;
  const equipped =
    equippedId !== null && equippedId !== focus.itemId
      ? catalog.getItem(equippedId)
      : null;
  // The picker only ever focuses equipment (its options are isEquipment-
  // filtered), and a slot can only hold equipment — so both narrow.
  const deltas = isEquipment(item)
    ? equipmentDelta(item, equipped !== null && isEquipment(equipped) ? equipped : null, focus.slot)
    : [];

  return (
    <div style={rootStyle}>
      <div style={titleRowStyle}>
        <span style={titleStyle}>{detail.title}</span>
        {detail.subtitle !== undefined && (
          <span style={tagStyle}>{detail.subtitle}</span>
        )}
        <span style={focusTagStyle}>
          {isEquipped ? 'equipped' : 'considering'} · {SLOT_LABEL.get(focus.slot)}
        </span>
      </div>
      <DetailLines lines={detail.lines} />
      {deltas.length > 0 && (
        <div style={deltaRowStyle}>
          {deltas.map((d, i) => (
            <span
              key={i}
              style={
                d.tone === 'up'
                  ? deltaUpStyle
                  : d.tone === 'down'
                    ? deltaDownStyle
                    : deltaDimStyle
              }
            >
              {d.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface DeltaChip {
  readonly text: string;
  readonly tone: 'up' | 'down' | 'dim';
}

// Concise delta vs the currently-equipped item — the salient changes,
// not a full stat diff (the detail lines above already list the item's
// stats). Weapons compare WP and range; the two-handed consequence and
// the replace/empty note apply generally.
function equipmentDelta(
  candidate: EquipmentDefinition,
  equipped: EquipmentDefinition | null,
  slot: EquipmentSlotId,
): DeltaChip[] {
  const chips: DeltaChip[] = [];

  if (candidate.kind === 'weapon') {
    if (equipped !== null && equipped.kind === 'weapon') {
      const dWp = candidate.wp - equipped.wp;
      chips.push(
        dWp === 0
          ? { text: 'WP unchanged', tone: 'dim' }
          : { text: `${dWp > 0 ? '+' : ''}${dWp} WP`, tone: dWp > 0 ? 'up' : 'down' },
      );
      const cR = candidate.range?.max ?? 1;
      const eR = equipped.range?.max ?? 1;
      if (cR !== eR) {
        chips.push({
          text: `${cR > eR ? '+' : ''}${cR - eR} range`,
          tone: cR > eR ? 'up' : 'down',
        });
      } else {
        chips.push({ text: 'range unchanged', tone: 'dim' });
      }
    } else {
      chips.push({ text: `WP ${candidate.wp}`, tone: 'dim' });
    }
    if (candidate.twoHanded === true && (slot === 'rightHand' || slot === 'leftHand')) {
      chips.push({ text: 'two-handed — empties the other hand', tone: 'dim' });
    }
  }

  chips.push(
    equipped !== null
      ? { text: `vs. equipped ${equipped.name}`, tone: 'dim' }
      : { text: 'fills an empty slot', tone: 'dim' },
  );
  return chips;
}

// ---- ability ----

function AbilityInspector({
  focus,
  builder,
  catalog,
}: {
  focus: Extract<InspectorFocus, { kind: 'ability' }>;
  builder: TeamBuilder;
  catalog: Catalog;
}): ReactElement {
  const { selectedUnit, rulesetId } = builder;
  const ability = catalog.getAbility(focus.abilityId);
  const detail = formatAbilityDetail(ability, catalog);
  const classId = selectedUnit.classId;

  const isFree =
    classId !== null && catalog.getClass(classId).freeAbilities.has(focus.abilityId);
  const isEquipped = (selectedUnit.loadout.passiveBuckets[focus.bucketId] ?? []).includes(
    focus.abilityId,
  );
  const cost = classId !== null ? draftAbilityCost(classId, focus.abilityId, catalog) : 0;
  const usage = draftBucketUsage(selectedUnit, focus.bucketId, catalog, rulesetId);
  const fit = budgetFit({ isFree, isEquipped, cost, usage, label: bucketLabel(focus.bucketId) });

  return (
    <div style={rootStyle}>
      <div style={titleRowStyle}>
        <span style={titleStyle}>{detail.title}</span>
        {detail.subtitle !== undefined && (
          <span style={tagStyle}>{detail.subtitle}</span>
        )}
      </div>
      <DetailLines lines={detail.lines} />
      <div style={fit.ok ? fitOkStyle : fitOverStyle}>{fit.text}</div>
    </div>
  );
}

function CommandSetInspector({
  focus,
  builder,
  catalog,
}: {
  focus: Extract<InspectorFocus, { kind: 'commandSet' }>;
  builder: TeamBuilder;
  catalog: Catalog;
}): ReactElement {
  const { selectedUnit, rulesetId } = builder;
  const cs = catalog.getCommandSet(focus.commandSetId);
  const detail = formatCommandSetDetail(cs, catalog);
  const isEquipped = (
    selectedUnit.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS] ?? []
  ).includes(focus.commandSetId);
  const cost = draftCommandSetCost(focus.commandSetId, catalog);
  const usage = draftBucketUsage(
    selectedUnit,
    BUCKET_SECONDARY_COMMAND_SETS,
    catalog,
    rulesetId,
  );
  const fit = budgetFit({ isFree: false, isEquipped, cost, usage, label: 'command-set' });

  return (
    <div style={rootStyle}>
      <div style={titleRowStyle}>
        <span style={titleStyle}>{detail.title}</span>
        {detail.subtitle !== undefined && (
          <span style={tagStyle}>{detail.subtitle}</span>
        )}
      </div>
      <DetailLines lines={detail.lines} />
      <div style={fit.ok ? fitOkStyle : fitOverStyle}>{fit.text}</div>
    </div>
  );
}

function budgetFit({
  isFree,
  isEquipped,
  cost,
  usage,
  label,
}: {
  isFree: boolean;
  isEquipped: boolean;
  cost: number;
  usage: { used: number; capacity: number };
  label: string;
}): { text: string; ok: boolean } {
  if (isFree) return { text: 'free with the class · always equipped', ok: true };
  if (isEquipped) {
    return { text: `equipped · costs ${cost} of ${usage.capacity} ${label} points`, ok: true };
  }
  const free = usage.capacity - usage.used;
  if (cost <= free) {
    const remaining = free - cost;
    return {
      text: `costs ${cost} · ${remaining} of ${usage.capacity} ${label} points still free`,
      ok: true,
    };
  }
  return {
    text: `costs ${cost} · over budget by ${cost - free} (${usage.used}/${usage.capacity} ${label})`,
    ok: false,
  };
}

function DetailLines({ lines }: { lines: ReadonlyArray<string> }): ReactElement {
  return (
    <div style={detailLinesStyle}>
      {lines.map((line, i) => (
        <span key={i} style={detailLineStyle}>
          {line}
        </span>
      ))}
    </div>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  minHeight: 96,
  // Pinned below the card (the card scrolls internally), so the inspector
  // stays in view on short windows.
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  justifyContent: 'center',
  background: 'rgba(22, 24, 29, 0.95)',
  border: '1px solid #2c2f36',
  borderRadius: 10,
  padding: '13px 15px',
};

const hintStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
  opacity: 0.45,
  textAlign: 'center',
};

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#f6e5a8',
};

const tagStyle: CSSProperties = {
  fontSize: 11,
  padding: '2px 7px',
  borderRadius: 4,
  background: '#23262d',
  color: '#aab0bb',
  border: '1px solid #2c2f36',
};

const focusTagStyle: CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  fontStyle: 'italic',
  opacity: 0.55,
};

const detailLinesStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2px 14px',
};

const detailLineStyle: CSSProperties = {
  fontSize: 12,
  color: '#c4c8d0',
};

const deltaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'center',
  marginTop: 1,
};

const deltaUpStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#6dc66d',
};

const deltaDownStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#e07a7a',
};

const deltaDimStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
};

const fitOkStyle: CSSProperties = {
  fontSize: 12,
  color: '#6dc66d',
};

const fitOverStyle: CSSProperties = {
  fontSize: 12,
  color: '#e07a7a',
  fontWeight: 600,
};
