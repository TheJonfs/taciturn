// Cartographer — the per-enemy override editor (Tier 3).
//
// Everything here edits `EnemyOverrides` through one patch callback; absent
// fields mean "framework default" and the editor always shows what that
// default currently resolves to. The kit has three modes (auto-by-level /
// JP-budget dial / explicit component picks — Chris's S98 call: dial AND
// picks, implied JP always shown). The legality echo at the bottom runs
// `composeLineupEnemyDraft` + the engine's draft-legality resolver — the
// same composition the campaign fold ships, so what reads legal here IS
// legal at battle time.

import { useMemo, type CSSProperties, type ReactElement } from 'react';
import {
  classId,
  slotIneligibilityReason,
  validateDraftUnit,
  type EquipmentSlotId,
} from '@engine/index.ts';
import { loadDefaultCatalog } from '@content/index.ts';
import type {
  EnemyLineupSlot,
  LineupEquipmentSlot,
  LineupUnlockRef,
} from '@content/battles/lineup-format.ts';
import type { EnemyOverridesPatch } from './edit.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import {
  COMPONENT_ENTRIES,
  composeLineupEnemyDraft,
  enemyJpBudget,
  lineupSlotSeed,
  tokenKey,
  unlockRefToToken,
  type UnlockToken,
} from '@campaign/index.ts';

const EQUIP_SLOTS: ReadonlyArray<LineupEquipmentSlot> = [
  'leftHand',
  'rightHand',
  'headgear',
  'armor',
  'accessory',
];

const PASSIVE_BUCKETS = ['reaction', 'support', 'movement'] as const;

let catalogSingleton: ReturnType<typeof loadDefaultCatalog> | null = null;
const catalog = (): ReturnType<typeof loadDefaultCatalog> =>
  (catalogSingleton ??= loadDefaultCatalog());

interface EnemyEditorProps {
  readonly slot: EnemyLineupSlot;
  readonly index: number;
  // The lineup's key — with `index` it derives the fold's per-slot
  // composition seed (M4), so the editor echoes EXACTLY what ships.
  readonly lineupKey: string;
  readonly onPatch: (patch: EnemyOverridesPatch | null) => void;
}

const tokenLabel = (token: UnlockToken): string => {
  const cat = catalog();
  if (token.kind === 'ability' && cat.hasAbility(token.id)) return cat.getAbility(token.id).name;
  if (token.kind === 'item' && cat.hasItem(token.id)) return cat.getItem(token.id).name;
  return `${token.kind}: ${String(token.id)}`;
};

const refFromToken = (token: UnlockToken): LineupUnlockRef => ({
  kind: token.kind,
  id: String(token.id),
});

export function EnemyEditor({ slot, index, lineupKey, onPatch }: EnemyEditorProps): ReactElement {
  const cat = catalog();
  const cls = classId(slot.classId);
  const o = slot.overrides;
  const slotSeed = lineupSlotSeed(lineupKey, index);

  const kitMode: 'auto' | 'budget' | 'explicit' =
    o?.unlocks !== undefined ? 'explicit' : o?.jpBudget !== undefined ? 'budget' : 'auto';

  // The composed draft — the EXACT build the fold ships (M4: auto/budget
  // kits now include the seeded secondary-class spillover and exported
  // passives, so the display must come from the composer, not a local
  // curriculum rebuild).
  const draft = useMemo(() => {
    try {
      return composeLineupEnemyDraft(slot, cat, slotSeed);
    } catch {
      return null;
    }
  }, [slot, cat, slotSeed]);

  // The kit the current settings resolve to (for display + as the seed
  // when switching into explicit mode).
  const effectiveKit = useMemo<ReadonlyArray<UnlockToken>>(() => {
    if (o?.unlocks !== undefined) return o.unlocks.map(unlockRefToToken);
    return draft?.unlocks ?? [];
  }, [o, draft]);

  // The secondary command set's owning class, if one is chosen — its
  // components join the explicit picker (unlocking them is what makes the
  // secondary's actives usable).
  const secondaryClass = useMemo(() => {
    if (o?.secondaryCommandSet === undefined) return null;
    return (
      cat.classes().find((c) => String(c.firstActionCommandSet) === o.secondaryCommandSet)?.id ??
      null
    );
  }, [o?.secondaryCommandSet, cat]);

  // Classes whose components the explicit picker offers: the enemy's own,
  // an explicitly chosen secondary's, and any class already present in the
  // effective kit (the M4 auto-pair spillover — its tokens must stay
  // visible/uncheckable rather than silently hidden).
  const kitClasses = useMemo(() => {
    const set = new Set<string>([String(cls)]);
    if (secondaryClass !== null) set.add(String(secondaryClass));
    for (const token of effectiveKit) {
      const meta = COMPONENT_ENTRIES.find((m) => tokenKey(m.token) === tokenKey(token));
      if (meta !== undefined) set.add(String(meta.nativeClass));
    }
    return set;
  }, [cls, secondaryClass, effectiveKit]);

  const pickerComponents = useMemo(
    () =>
      COMPONENT_ENTRIES.filter(
        (meta) => meta.restrictedToUnit === undefined && kitClasses.has(String(meta.nativeClass)),
      ),
    [kitClasses],
  );

  const checkedKeys = useMemo(() => new Set(effectiveKit.map(tokenKey)), [effectiveKit]);
  const impliedJp = useMemo(
    () =>
      COMPONENT_ENTRIES.filter((meta) => checkedKeys.has(tokenKey(meta.token))).reduce(
        (sum, meta) => sum + meta.cost,
        0,
      ),
    [checkedKeys],
  );

  // Live legality echo — the exact composition the fold ships.
  const legality = useMemo(() => {
    if (draft === null) return null;
    try {
      return validateDraftUnit(
        { classId: cls, loadout: draft.loadout, equipment: draft.equipment },
        cat,
        riverRidgeBattle.rulesetId,
      );
    } catch {
      return null;
    }
  }, [draft, cls, cat]);

  const toggleComponent = (token: UnlockToken): void => {
    const refs = effectiveKit.map(refFromToken);
    const key = tokenKey(token);
    const next = checkedKeys.has(key)
      ? refs.filter((r) => tokenKey(unlockRefToToken(r)) !== key)
      : [...refs, refFromToken(token)];
    onPatch({ unlocks: next, jpBudget: undefined });
  };

  const passiveOptions = useMemo(
    () =>
      pickerComponents
        .filter(
          (meta) =>
            meta.token.kind === 'ability' &&
            cat.hasAbility(meta.token.id) &&
            cat.getAbility(meta.token.id).kind === 'passive',
        )
        .map((meta) => ({ id: String(meta.token.id), name: tokenLabel(meta.token) })),
    [pickerComponents, cat],
  );

  const setPassives = (bucket: (typeof PASSIVE_BUCKETS)[number], ids: string[]): void => {
    const next = {
      ...(o?.passives ?? {}),
      [bucket]: ids,
    };
    const allEmpty = PASSIVE_BUCKETS.every((b) => (next[b]?.length ?? 0) === 0);
    onPatch({ passives: allEmpty ? undefined : next });
  };

  const gearIsCustom = o?.equipment !== undefined;
  const setGear = (slotId: LineupEquipmentSlot, id: string): void => {
    const next: Record<string, string> = { ...(o?.equipment ?? {}) };
    if (id === '') delete next[slotId];
    else next[slotId] = id;
    onPatch({ equipment: next });
  };

  const itemOptionsFor = (slotId: LineupEquipmentSlot): ReadonlyArray<{ id: string; label: string }> =>
    cat
      .items()
      .filter((item) => slotIneligibilityReason(cls, slotId as EquipmentSlotId, item, cat) === null)
      .map((item) => ({
        id: String(item.id),
        // † marks pool-managed/hidden gear (TABA uniques + exotics) — legal
        // to author, flagged because generation never hands it out and the
        // AI undervalues exotic effects (the standing S85/S89 note).
        label: `${item.name}${item.availability === 'hidden' ? ' †' : ''}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div style={editorStyle}>
      <div style={editorTitleStyle}>
        enemy {index === 0 ? '★ (lead)' : `#${index}`} — {slot.classId} L{slot.level} · overrides
        <span style={{ flex: 1 }} />
        <button type="button" style={smallButtonStyle} onClick={() => onPatch(null)}>
          reset all
        </button>
      </div>

      <div style={rowStyle}>
        <span style={labelStyle}>name</span>
        <input
          style={inputStyle}
          placeholder={cat.getClass(cls).name}
          value={o?.name ?? ''}
          onChange={(e) => onPatch({ name: e.target.value === '' ? undefined : e.target.value })}
        />
        <span style={labelStyle}>gender</span>
        <select
          style={selectStyle}
          value={o?.gender ?? ''}
          onChange={(e) =>
            onPatch({
              gender: e.target.value === '' ? undefined : (e.target.value as 'male' | 'female'),
            })
          }
        >
          <option value="">—</option>
          <option value="female">♀</option>
          <option value="male">♂</option>
        </select>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>brave</span>
        <input
          style={numStyle}
          type="number"
          min={1}
          max={100}
          placeholder="band"
          value={o?.brave ?? ''}
          onChange={(e) =>
            onPatch({ brave: e.target.value === '' ? undefined : Number(e.target.value) })
          }
        />
        <span style={labelStyle}>faith</span>
        <input
          style={numStyle}
          type="number"
          min={1}
          max={100}
          placeholder="band"
          value={o?.faith ?? ''}
          onChange={(e) =>
            onPatch({ faith: e.target.value === '' ? undefined : Number(e.target.value) })
          }
        />
      </div>

      <div style={subheadStyle}>
        kit — {impliedJp} JP{kitMode === 'auto' ? ` (auto: level × dial = ${enemyJpBudget(slot.level)})` : ''}
      </div>
      <div style={rowStyle}>
        {(['auto', 'budget', 'explicit'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            style={kitMode === mode ? activeChipStyle : chipStyle}
            onClick={() => {
              if (mode === kitMode) return;
              if (mode === 'auto') onPatch({ jpBudget: undefined, unlocks: undefined });
              else if (mode === 'budget')
                onPatch({ jpBudget: impliedJp, unlocks: undefined });
              else onPatch({ unlocks: effectiveKit.map(refFromToken), jpBudget: undefined });
            }}
          >
            {mode === 'auto' ? 'auto (level)' : mode === 'budget' ? 'JP budget' : 'explicit picks'}
          </button>
        ))}
        {kitMode === 'budget' && (
          <input
            style={numStyle}
            type="number"
            min={0}
            step={50}
            value={o?.jpBudget ?? 0}
            onChange={(e) => onPatch({ jpBudget: Math.max(0, Number(e.target.value) || 0) })}
          />
        )}
      </div>
      {kitMode === 'explicit' ? (
        <div style={componentListStyle}>
          {pickerComponents.map((meta) => {
            const key = tokenKey(meta.token);
            return (
              <label key={key} style={componentRowStyle}>
                <input
                  type="checkbox"
                  checked={checkedKeys.has(key)}
                  onChange={() => toggleComponent(meta.token)}
                />
                <span style={{ flex: 1 }}>{tokenLabel(meta.token)}</span>
                <span style={dimStyle}>
                  {String(meta.nativeClass) !== slot.classId ? `${String(meta.nativeClass)} · ` : ''}
                  {meta.cost}
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div style={dimStyle}>
          {effectiveKit.length === 0 ? 'no components at this budget' : effectiveKit.map(tokenLabel).join(', ')}
        </div>
      )}

      <div style={subheadStyle}>loadout</div>
      <div style={rowStyle}>
        <span style={labelStyle}>secondary</span>
        <select
          style={selectStyle}
          value={o?.secondaryCommandSet ?? ''}
          onChange={(e) =>
            onPatch({ secondaryCommandSet: e.target.value === '' ? undefined : e.target.value })
          }
        >
          <option value="">—</option>
          {cat
            .classes()
            .filter((c) => c.id !== cls)
            .map((c) => (
              <option key={String(c.id)} value={String(c.firstActionCommandSet)}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      {PASSIVE_BUCKETS.map((bucket) => {
        const current = o?.passives?.[bucket] ?? [];
        return (
          <div key={bucket} style={rowStyle}>
            <span style={labelStyle}>{bucket[0]!.toUpperCase()}</span>
            {current.map((id, pi) => (
              <select
                key={pi}
                style={selectStyle}
                value={id}
                onChange={(e) => {
                  const ids = [...current];
                  if (e.target.value === '') ids.splice(pi, 1);
                  else ids[pi] = e.target.value;
                  setPassives(bucket, ids);
                }}
              >
                <option value="">✕ remove</option>
                {passiveOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ))}
            <select
              style={selectStyle}
              value=""
              onChange={(e) => {
                if (e.target.value !== '') setPassives(bucket, [...current, e.target.value]);
              }}
            >
              <option value="">+ add…</option>
              {passiveOptions
                .filter((p) => !current.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
        );
      })}
      <div style={dimStyle}>class innates auto-equip on top (deduplicated)</div>

      <div style={subheadStyle}>
        equipment
        <button
          type="button"
          style={gearIsCustom ? activeChipStyle : chipStyle}
          onClick={() => onPatch({ equipment: gearIsCustom ? undefined : {} })}
        >
          {gearIsCustom ? 'custom' : 'default (generated gear)'}
        </button>
      </div>
      {gearIsCustom &&
        EQUIP_SLOTS.map((slotId) => (
          <div key={slotId} style={rowStyle}>
            <span style={labelStyle}>{slotId}</span>
            <select
              style={selectStyle}
              value={o?.equipment?.[slotId] ?? ''}
              onChange={(e) => setGear(slotId, e.target.value)}
            >
              <option value="">—</option>
              {itemOptionsFor(slotId).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      {gearIsCustom && <div style={dimStyle}>† = pool-managed gear (uniques/exotics — AI undervalues exotic effects)</div>}

      {legality !== null && (
        <div style={legality.valid ? okStyle : badStyle}>
          {legality.valid
            ? '✓ loadout + equipment legal (engine draft resolver)'
            : `✕ ${legality.invalidSlots.length + legality.bucketOverages.length + legality.twoHandedConflictHands.length + (legality.dualWielding ? 1 : 0) + legality.equipLegalityConflicts.length} legality issue(s) — see the validation strip`}
        </div>
      )}
    </div>
  );
}

// ---- styles ----

const editorStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 8,
  border: '1px solid #3a3325',
  borderRadius: 4,
  background: '#14150f',
  fontSize: 12,
};

const editorTitleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#d8b26c',
  fontSize: 12,
};

const subheadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 4,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6b707b',
};

const rowStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' };
const labelStyle: CSSProperties = { color: '#9aa0ac', fontSize: 11, minWidth: 44 };

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '3px 6px',
  fontSize: 12,
  background: '#101216',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
  fontFamily: 'inherit',
};

const numStyle: CSSProperties = { ...inputStyle, flex: 'none', width: 58 };
const selectStyle: CSSProperties = { ...inputStyle, flex: 'none', width: 'auto', maxWidth: 170 };

const chipStyle: CSSProperties = {
  padding: '3px 7px',
  fontSize: 11,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  background: '#1c1e23',
  color: '#c7ccd6',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const activeChipStyle: CSSProperties = {
  ...chipStyle,
  borderColor: '#d8b26c',
  color: '#d8b26c',
  background: 'rgba(216,178,108,.08)',
};

const smallButtonStyle: CSSProperties = chipStyle;

const componentListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  maxHeight: 180,
  overflowY: 'auto',
  padding: '4px 2px',
  border: '1px solid #2c2f36',
  borderRadius: 4,
};

const componentRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 12,
  cursor: 'pointer',
};

const dimStyle: CSSProperties = { fontSize: 11, color: '#6b707b' };
const okStyle: CSSProperties = { fontSize: 11, color: '#7fb58a' };
const badStyle: CSSProperties = { fontSize: 11, color: '#d88f8f' };
