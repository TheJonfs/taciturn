// ActionMenu — bottom-region menu for the player's per-turn input.
//
// Rendered in the bottom-left slot of the 4-region HUD shell. Walks
// `useTurnFlow`'s state machine via the menu buttons:
//
//   action-menu        →  Move (n) / Act / Wait / Status (disabled)
//   move-select        →  "Click a blue tile to move…"   + Cancel
//   command-set-select →  one button per active command set + Cancel
//   ability-list       →  one button per ability in the set + Cancel
//   target-select      →  "Click a highlighted target…" + Cancel
//   await-confirm      →  preview row + Confirm / Cancel
//   animation          →  "Resolving…" (no buttons)
//
// All input is keyboard-and-mouse parity:
//   - mouse: click any button.
//   - keyboard: arrow keys move focus, Enter confirms, ESC cancels.
//     ESC at action-menu opens the pause overlay (BattleView listens).
//
// The menu reads its options from `useTurnFlow`'s loadout helpers
// (`activeCommandSets`, `abilitiesFor`). It doesn't touch the engine
// directly; the hook owns all validation.

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { enumerateMathSkillTargets, projectTurnEndCt, statusTypeId, validateAction, type ActiveAbilityDefinition, type Catalog, type ConsumableDefinition, type Direction, type GameState, type ProposedAction, type Unit, type UnitId } from '@engine/index.ts';
import { abilityRoute, type TurnFlow } from './use-turn-flow.ts';
import { DetailHover } from './detail-hover.tsx';
import { formatAbilityDetail } from './detail-text.ts';

// Status-effect gates for the top-level Move / Act buttons. Read off the
// active unit's `statuses` array; the same gates fire on `onActionAttempted`
// at commit time (per the dont_move / dont_act status definitions), so
// the menu disable is a UX surface — without it, a click on Move with
// Don't Move applied enters move-select, then the engine rejects the
// commit and the UI lands in a soft-lock state. Per Session 31.5 bug 6.
const DONT_MOVE_TYPE_ID = statusTypeId('dont_move');
const DONT_ACT_TYPE_ID = statusTypeId('dont_act');

function hasDontMove(unit: Unit): boolean {
  return unit.statuses.some((s) => s.typeId === DONT_MOVE_TYPE_ID);
}

function hasDontAct(unit: Unit): boolean {
  return unit.statuses.some((s) => s.typeId === DONT_ACT_TYPE_ID);
}

export interface ActionMenuProps {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
  // Game state, surfaced to the menu for end-CT projection. Pulled in
  // alongside `turnFlow` rather than wedged into the hook so the engine
  // forecast helpers stay one-call-from-the-menu.
  readonly engineState: GameState | null;
  // Open the unit-detail panel for a given unit. Wired in by BattleView.
  readonly onOpenUnitDetail?: ((unitId: import('@engine/index.ts').UnitId) => void) | undefined;
}

export function ActionMenu({ turnFlow, catalog, engineState, onOpenUnitDetail }: ActionMenuProps): ReactElement {
  const { state, isOurTurn, activeUnit } = turnFlow;

  if (!isOurTurn || activeUnit === null) {
    return (
      <Panel header="Action Menu">
        <StatusLine>Opponent&apos;s turn</StatusLine>
      </Panel>
    );
  }

  switch (state.kind) {
    case 'idle':
      return (
        <Panel header="Action Menu">
          <StatusLine>Waiting…</StatusLine>
        </Panel>
      );

    case 'action-menu':
      return <TopLevel turnFlow={turnFlow} catalog={catalog} engineState={engineState} onOpenUnitDetail={onOpenUnitDetail} />;

    case 'move-select':
      return (
        <Panel header="Move">
          <StatusLine>Click a blue tile to move</StatusLine>
          <CancelButton onClick={turnFlow.cancel} />
        </Panel>
      );

    case 'move-await-confirm':
      return (
        <Panel header="Confirm Move">
          <StatusLine>
            Move to ({state.destination.x}, {state.destination.y})?
          </StatusLine>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button
              label="Confirm"
              disabled={false}
              onClick={() => turnFlow.confirmAccept()}
              variant="primary"
            />
            <Button label="Cancel" disabled={false} onClick={turnFlow.cancel} variant="secondary" />
          </div>
        </Panel>
      );

    case 'command-set-select':
      return <CommandSetPicker turnFlow={turnFlow} catalog={catalog} />;

    case 'ability-list':
      return <AbilityListPicker turnFlow={turnFlow} catalog={catalog} commandSetId={state.commandSetId} />;

    case 'target-select': {
      const ability = catalog.getAbility(state.abilityId);
      const label = ability.kind === 'active' ? ability.name : String(state.abilityId);
      // unit_or_tile abilities (post-S38) expose a tile-pin toggle so
      // the player can either follow the unit (default) or pin the
      // tile. T toggles in keyboard.
      const isUnitOrTile = ability.kind === 'active' && ability.targeting.kind === 'unit_or_tile';
      const hint = isUnitOrTile
        ? state.tileMode
          ? 'Click a tile to pin the location'
          : 'Click a unit to target them'
        : 'Click a highlighted target';
      return (
        <Panel header={`Target — ${label}`}>
          <StatusLine>{hint}</StatusLine>
          {isUnitOrTile ? (
            <TileModeToggle
              tileMode={state.tileMode}
              onToggle={turnFlow.toggleTileMode}
            />
          ) : null}
          <CancelButton onClick={turnFlow.cancel} />
        </Panel>
      );
    }

    case 'await-confirm':
      return <ConfirmRow turnFlow={turnFlow} catalog={catalog} />;

    case 'compound-item-select':
      return <CompoundItemPicker turnFlow={turnFlow} catalog={catalog} />;

    case 'throw-item-item-select':
      return (
        <ThrowItemItemPicker
          turnFlow={turnFlow}
          catalog={catalog}
          engineState={engineState}
          targetUnitId={state.targetUnitId}
        />
      );

    case 'math-skill-target-select':
      return (
        <MathSkillPicker
          turnFlow={turnFlow}
          catalog={catalog}
          state={state}
          engineState={engineState}
        />
      );

    case 'tile-set-target-select': {
      // Session 55: Barrier line picker. Two-phase click-far-end UX — the
      // hint switches once the anchor is placed. Cancel backs out one stage
      // (extent → re-pick anchor; anchor → leave the picker).
      const ability = catalog.getAbility(state.abilityId);
      const label = ability.kind === 'active' ? ability.name : String(state.abilityId);
      const hint =
        state.anchor === null
          ? 'Click a highlighted tile to anchor the line'
          : 'Click a highlighted tile to set the far end (3–5 tiles)';
      return (
        <Panel header={`Target — ${label}`}>
          <StatusLine>{hint}</StatusLine>
          <CancelButton onClick={turnFlow.cancel} />
        </Panel>
      );
    }

    case 'grapple-throw-target-select': {
      // Session 76: Bear's Heave. Two-phase pick — grab a unit, then place it.
      // The hint switches once the throwee is chosen; cancel backs out one
      // stage (destination → re-pick throwee; throwee → leave the picker).
      const ability = catalog.getAbility(state.abilityId);
      const label = ability.kind === 'active' ? ability.name : String(state.abilityId);
      const hint =
        state.throweeId === null
          ? 'Click a highlighted unit to grab'
          : 'Click a highlighted tile to throw them to';
      return (
        <Panel header={`Target — ${label}`}>
          <StatusLine>{hint}</StatusLine>
          <CancelButton onClick={turnFlow.cancel} />
        </Panel>
      );
    }

    case 'wait-confirm':
      return <WaitConfirm turnFlow={turnFlow} />;

    case 'animation':
      return (
        <Panel header="Action Menu">
          <StatusLine>Resolving…</StatusLine>
        </Panel>
      );
  }
}

// Cardinal-direction facing picker shown after the player clicks End
// turn. Per design doc WAIT-CONFIRM. Defaults to the unit's current
// facing; click any of the four cardinals to commit. ESC / Cancel
// returns to the action menu.
//
// Session 26.5 (item #6): keyboard input. Arrow keys preview a pending
// facing (visual highlight follows the selection); Enter commits with
// the pending facing. The Escape key already cancels via BattleView's
// top-level handler.
function WaitConfirm({ turnFlow }: { readonly turnFlow: TurnFlow }): ReactElement {
  const currentFacing = turnFlow.activeUnit?.facing ?? 'N';
  const [pendingFacing, setPendingFacing] = useState<Direction>(currentFacing);
  const directions: ReadonlyArray<{ readonly dir: Direction; readonly label: string }> = [
    { dir: 'N', label: 'North ↑' },
    { dir: 'E', label: 'East →' },
    { dir: 'S', label: 'South ↓' },
    { dir: 'W', label: 'West ←' },
  ];

  // Capture-phase keyboard handler so the WAIT-CONFIRM panel reads
  // arrows / Enter without interfering with other surfaces. Mirrors
  // the pattern used in `charged-action-detail-panel.tsx` for ESC.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      let next: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp':
          next = 'N';
          break;
        case 'ArrowRight':
          next = 'E';
          break;
        case 'ArrowDown':
          next = 'S';
          break;
        case 'ArrowLeft':
          next = 'W';
          break;
        case 'Enter':
          e.preventDefault();
          e.stopPropagation();
          turnFlow.submitWait(pendingFacing);
          return;
        default:
          return;
      }
      if (next !== null) {
        e.preventDefault();
        e.stopPropagation();
        setPendingFacing(next);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [turnFlow, pendingFacing]);

  return (
    <Panel header="End turn — pick facing">
      <StatusLine>Arrow keys + Enter, or click a direction</StatusLine>
      {directions.map((d) => (
        <Button
          key={d.dir}
          label={
            d.dir === pendingFacing
              ? `${d.label}${d.dir === currentFacing ? ' (current)' : ''}`
              : d.label
          }
          disabled={false}
          onClick={() => turnFlow.submitWait(d.dir)}
          variant={d.dir === pendingFacing ? 'primary' : 'secondary'}
        />
      ))}
      <CancelButton onClick={turnFlow.cancel} />
    </Panel>
  );
}

// ---- subcomponents ----

function TopLevel(props: {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
  readonly engineState: GameState | null;
  readonly onOpenUnitDetail?: ((unitId: import('@engine/index.ts').UnitId) => void) | undefined;
}): ReactElement {
  const { turnFlow, catalog, engineState, onOpenUnitDetail } = props;
  const { movesAvailable, actsAvailable, waitDisabled, activeUnit } = turnFlow;

  // Move/Act show the CT-cost the action would contribute to the
  // turn's end-cost deduction. Wait/End-turn shows the projected
  // leftover CT given current consumption. Per the post-MVP designer
  // call (2026-05-10): "Move and Act show costs in CT; End-turn shows
  // leftover CT after ending now." Differences vs. the prior framing:
  //   - Move alone shows the moveOnly cost (50 by default), not the
  //     diff-from-baseline-wait (30).
  //   - Move after Act shows the increment to moveAndAct (typically
  //     50, since moveAndAct - actOnly = 30 in default tuning, but the
  //     compute is generic to the ruleset).
  //   - End-turn dynamically decrements as the player commits actions.
  let moveCost: number | null = null;
  let actCost: number | null = null;
  let waitLeftover: number | null = null;
  if (engineState !== null && activeUnit !== null) {
    // Leftover CT at end-of-turn given what's already been consumed.
    const leftoverNow = projectTurnEndCt({
      state: engineState,
      catalog,
      unit: activeUnit,
      plannedNext: 'wait',
    });
    // Leftover CT if Move were committed in addition to existing consumed.
    const leftoverIfMove = projectTurnEndCt({
      state: engineState,
      catalog,
      unit: activeUnit,
      plannedNext: 'move',
    });
    const leftoverIfAct = projectTurnEndCt({
      state: engineState,
      catalog,
      unit: activeUnit,
      plannedNext: 'act',
    });
    // Cost-of-doing-this-action = (current unit CT) − (leftover if this
    // action committed and we end). For the no-action case this would
    // be the wait cost; for Move + end it's the moveOnly cost. Showing
    // this absolute number matches the player's mental model that
    // "Move costs 50 CT" means "your CT drops by 50 if Move is the
    // only action this turn."
    moveCost = Math.max(0, activeUnit.ct - leftoverIfMove);
    actCost = Math.max(0, activeUnit.ct - leftoverIfAct);
    waitLeftover = leftoverNow;
  }
  const fmtCost = (n: number | null): string => (n === null ? '' : ` · ${n} CT`);
  const fmtLeftover = (n: number | null): string => (n === null ? '' : ` · CT after: ${n}`);

  // Top-level menu is Move / Act / End turn / Status. Per session 25:
  // Attack appears as a peer of the command sets inside the Act picker,
  // not as its own top-level button. The Act button is enabled when
  // there's Act budget AND the unit has at least one picker entry
  // (free Attack and/or a command set).
  const { actEntries } = turnFlow;
  const actSurfaceHasContent = actEntries.length > 0;
  // Status-driven gates per Session 31.5 bug 6. Active-unit may be null
  // pre-render; the outer component guarantees it's set by the time the
  // menu paints, but the optional read keeps the type narrow.
  const dontMove = activeUnit !== null && hasDontMove(activeUnit);
  const dontAct = activeUnit !== null && hasDontAct(activeUnit);

  return (
    <Panel header="Action Menu">
      <Button
        label={`Move (${movesAvailable})${fmtCost(moveCost)}`}
        disabled={movesAvailable <= 0 || dontMove}
        onClick={() => turnFlow.dispatch({ kind: 'pickMove' })}
      />
      <Button
        label={`Act (${actsAvailable})${fmtCost(actCost)}`}
        disabled={actsAvailable <= 0 || !actSurfaceHasContent || dontAct}
        onClick={() => turnFlow.dispatch({ kind: 'pickAct', entries: actEntries })}
      />
      <Button
        label={`End turn${fmtLeftover(waitLeftover)}`}
        disabled={waitDisabled}
        onClick={() => turnFlow.dispatch({ kind: 'pickWait' })}
      />
      <Button
        label="Status"
        disabled={onOpenUnitDetail === undefined || activeUnit === null}
        onClick={() => {
          if (onOpenUnitDetail !== undefined && activeUnit !== null) {
            onOpenUnitDetail(activeUnit.id);
          }
        }}
      />
    </Panel>
  );
}

function CommandSetPicker({ turnFlow, catalog }: { readonly turnFlow: TurnFlow; readonly catalog: Catalog }): ReactElement {
  // Renders the Act picker — free abilities (Attack) and equipped
  // command sets as peers. Per session 25: a Knight with Battle Skill
  // sees "Attack, Battle Skill"; a Fire Mage with Lightning Magic
  // backup would see "Attack, Fire Magic, Lightning Magic".
  return (
    <Panel header="Choose Act">
      {turnFlow.actEntries.map((entry) => {
        if (entry.kind === 'free_ability') {
          const ability = catalog.hasAbility(entry.abilityId) ? catalog.getAbility(entry.abilityId) : null;
          const label = ability?.name ?? String(entry.abilityId);
          return (
            <Button
              key={`free:${String(entry.abilityId)}`}
              label={label}
              disabled={false}
              onClick={() => {
                const route = abilityRoute(entry.abilityId, catalog);
                turnFlow.dispatch({
                  kind: 'pickFreeAbility',
                  abilityId: entry.abilityId,
                  ...(route !== undefined ? { route } : {}),
                });
              }}
            />
          );
        }
        const cs = catalog.hasCommandSet(entry.commandSetId) ? catalog.getCommandSet(entry.commandSetId) : null;
        const label = cs?.name ?? String(entry.commandSetId);
        return (
          <Button
            key={`set:${String(entry.commandSetId)}`}
            label={label}
            disabled={false}
            onClick={() => turnFlow.dispatch({ kind: 'pickCommandSet', commandSetId: entry.commandSetId })}
          />
        );
      })}
      <CancelButton onClick={turnFlow.cancel} />
    </Panel>
  );
}

function AbilityListPicker(props: {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
  readonly commandSetId: import('@engine/index.ts').CommandSetId;
}): ReactElement {
  const { turnFlow, catalog, commandSetId } = props;
  const csName = catalog.hasCommandSet(commandSetId) ? catalog.getCommandSet(commandSetId).name : String(commandSetId);
  const abilities = turnFlow.abilitiesFor(commandSetId) ?? [];

  return (
    <Panel header={`Ability — ${csName}`}>
      {abilities.length === 0 && <StatusLine>(no active abilities)</StatusLine>}
      {abilities.map((entry) => (
        <AbilityButton
          key={String(entry.ability.id)}
          ability={entry.ability}
          catalog={catalog}
          mpCost={entry.effectiveMpCost}
          actionSpeed={entry.effectiveActionSpeed}
          disabled={entry.disabled}
          reason={entry.disableReason}
          onClick={() => {
            const route = abilityRoute(entry.ability.id, catalog);
            turnFlow.dispatch({
              kind: 'pickAbility',
              abilityId: entry.ability.id,
              ...(route !== undefined ? { route } : {}),
            });
          }}
        />
      ))}
      <CancelButton onClick={turnFlow.cancel} />
    </Panel>
  );
}

function AbilityButton(props: {
  readonly ability: ActiveAbilityDefinition;
  readonly catalog: Catalog;
  readonly mpCost: number;
  readonly actionSpeed: number;
  readonly disabled: boolean;
  readonly reason: string | null;
  readonly onClick: () => void;
}): ReactElement {
  const { ability, catalog, mpCost, actionSpeed, disabled, reason, onClick } = props;
  // Per Session 28: suppress the MP-cost line when free. Per Session 29:
  // display the *effective* values (post-`modifyMpCost` /
  // `modifyActionSpeed`) precomputed by `AbilityListPicker` so equipment
  // and status modifiers are visible to the player before commit.
  const parts: string[] = [];
  if (mpCost > 0) parts.push(`MP ${mpCost}`);
  if (actionSpeed > 0) parts.push(`charge ${actionSpeed}`);
  const subline = parts.join(' · ');
  const detail = formatAbilityDetail(ability, catalog);
  return (
    <DetailHover content={detail} style={{ display: 'block' }}>
      <button
        type="button"
        style={{
          ...buttonBaseStyle,
          ...buttonPrimaryStyle,
          ...(disabled ? buttonDisabledStyle : null),
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 2,
          width: '100%',
        }}
        onClick={disabled ? noop : onClick}
        disabled={disabled}
        title={reason ?? undefined}
      >
        <span style={{ fontWeight: 500 }}>{ability.name}</span>
        {subline.length > 0 && (
          <span style={{ fontSize: 11, opacity: 0.7 }}>{subline}</span>
        )}
        {disabled && reason !== null && (
          <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>{reason}</span>
        )}
      </button>
    </DetailHover>
  );
}

// Math Skill picker (Session 49). Renders the two-step picker:
// parameter row (CT / Height / Level / HP) then value row (Prime / 3 /
// 4 / 5), with a Cast button gated on both picks being non-null. A
// "Hits: N" chip shows the matched-unit count as the player toggles
// pairs — paired with the renderer's matched-unit highlights (painted
// in `use-turn-flow`'s highlights effect).
function MathSkillPicker({
  turnFlow,
  catalog,
  state,
  engineState,
}: {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
  readonly state: Extract<TurnFlow['state'], { kind: 'math-skill-target-select' }>;
  readonly engineState: GameState | null;
}): ReactElement {
  const ability = catalog.getAbility(state.abilityId);
  const label = ability.kind === 'active' ? ability.name : String(state.abilityId);

  const parameters: ReadonlyArray<{ id: 'ct' | 'height' | 'level' | 'current_hp'; label: string }> = [
    { id: 'ct', label: 'CT' },
    { id: 'height', label: 'Height' },
    { id: 'level', label: 'Level' },
    { id: 'current_hp', label: 'HP' },
  ];
  const values: ReadonlyArray<{ id: 'prime' | 3 | 4 | 5; label: string }> = [
    { id: 'prime', label: 'Prime' },
    { id: 3, label: '×3' },
    { id: 4, label: '×4' },
    { id: 5, label: '×5' },
  ];

  // Hit counter — recompute the matched set on every render when both
  // picks are non-null. Lightweight (single linear pass over units);
  // memoization is unnecessary for the panel's refresh cadence.
  let hits = 0;
  let alliesHit = 0;
  let enemiesHit = 0;
  if (state.parameter !== null && state.value !== null && engineState !== null && turnFlow.activeUnit !== null) {
    const matched = enumerateMathSkillTargets(engineState, state.parameter, state.value);
    hits = matched.length;
    const myTeam = turnFlow.activeUnit.team;
    for (const u of matched) {
      if (u.team === myTeam) alliesHit++;
      else enemiesHit++;
    }
  }

  const canCast = state.parameter !== null && state.value !== null;

  return (
    <Panel header={`Math Skill — ${label}`}>
      <StatusLine>Pick a parameter, then a value</StatusLine>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {parameters.map((p) => (
          <Button
            key={p.id}
            label={p.label}
            disabled={false}
            onClick={() => turnFlow.pickMathSkillParameter(p.id)}
            variant={state.parameter === p.id ? 'primary' : 'secondary'}
          />
        ))}
      </div>
      {state.parameter !== null && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {values.map((v) => (
            <Button
              key={String(v.id)}
              label={v.label}
              disabled={false}
              onClick={() => turnFlow.pickMathSkillValue(v.id)}
              variant={state.value === v.id ? 'primary' : 'secondary'}
            />
          ))}
        </div>
      )}
      {canCast && (
        <StatusLine>
          Hits: {hits} ({alliesHit} ally{alliesHit === 1 ? '' : 'ies'}, {enemiesHit} enem
          {enemiesHit === 1 ? 'y' : 'ies'})
        </StatusLine>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <Button
          label="Cast"
          disabled={!canCast}
          onClick={() => {
            if (!canCast || turnFlow.activeUnit === null) return;
            const action: ProposedAction = {
              type: 'use_ability',
              source: 'player',
              actorId: turnFlow.activeUnit.id,
              payload: {
                abilityId: state.abilityId,
                target: {
                  kind: 'math_skill',
                  parameter: state.parameter!,
                  value: state.value!,
                },
              },
            };
            turnFlow.submitTargetedAction(action);
          }}
          variant="primary"
        />
        <Button label="Cancel" disabled={false} onClick={turnFlow.cancel} variant="secondary" />
      </div>
    </Panel>
  );
}

function ConfirmRow({ turnFlow, catalog }: { readonly turnFlow: TurnFlow; readonly catalog: Catalog }): ReactElement {
  const state = turnFlow.state;
  if (state.kind !== 'await-confirm') return <Panel header="Confirm" />;
  const ability = catalog.getAbility(state.abilityId);
  const label = ability.kind === 'active' ? ability.name : String(state.abilityId);
  return (
    <Panel header={`Confirm — ${label}`}>
      <StatusLine>Commit this action?</StatusLine>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button label="Confirm" disabled={false} onClick={() => turnFlow.confirmAccept()} variant="primary" />
        <Button label="Cancel" disabled={false} onClick={turnFlow.cancel} variant="secondary" />
      </div>
    </Panel>
  );
}

// ---- primitives ----

function Panel({ header, children }: { readonly header: string; readonly children?: React.ReactNode }): ReactElement {
  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>{header}</div>
      {children}
    </div>
  );
}

function StatusLine({ children }: { readonly children: React.ReactNode }): ReactElement {
  return <div style={statusLineStyle}>{children}</div>;
}

function CancelButton({ onClick }: { readonly onClick: () => void }): ReactElement {
  return <Button label="Cancel (ESC)" disabled={false} onClick={onClick} variant="secondary" />;
}

// Tile-pin toggle button — shown during target-select for `unit_or_tile`
// abilities. When on, clicks pin to the tile (spell lands at the
// location regardless of who occupies it at resolution time). When off
// (default), clicks pin to the unit (FFT-canonical follow). 'T' on
// keyboard mirrors the click. Per the post-S38 unit_or_tile change.
function TileModeToggle({
  tileMode,
  onToggle,
}: {
  readonly tileMode: boolean;
  readonly onToggle: () => void;
}): ReactElement {
  // Keyboard parity: T flips the mode while the toggle is mounted.
  // Uses `addEventListener` rather than React's onKeyDown so the focus
  // doesn't have to be on the button — the player can press T at any
  // point during target-select. ESC cancellation already lives at the
  // BattleView level; this listener is scoped to the toggle's lifetime.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 't' || e.key === 'T') {
        if (e.repeat) return;
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onToggle]);
  const label = tileMode ? '⛬ Pinned to tile (T)' : '◉ Pinned to unit (T)';
  return <Button label={label} disabled={false} onClick={onToggle} variant="secondary" />;
}

function Button(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly variant?: 'primary' | 'secondary';
  readonly title?: string;
}): ReactElement {
  const { label, onClick, disabled, variant = 'primary', title } = props;
  const style: CSSProperties = {
    ...buttonBaseStyle,
    ...(variant === 'secondary' ? buttonSecondaryStyle : buttonPrimaryStyle),
    ...(disabled ? buttonDisabledStyle : null),
  };
  return (
    <button type="button" style={style} onClick={disabled ? noop : onClick} disabled={disabled} title={title}>
      {label}
    </button>
  );
}

const noop = (): void => {};

// ---- styles ----

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  height: '100%',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
};

const panelHeaderStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};

const buttonBaseStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  cursor: 'pointer',
  textAlign: 'left',
  fontSize: 13,
  fontFamily: 'inherit',
  display: 'flex',
  transition: 'background 80ms, border-color 80ms',
};

const buttonPrimaryStyle: CSSProperties = {
  background: '#2a3140',
  color: '#e7e9ee',
};

const buttonSecondaryStyle: CSSProperties = {
  background: '#26282d',
  color: '#bcc1cb',
};

const buttonDisabledStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};

const statusLineStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  fontStyle: 'italic',
};

// ============================================================
// Session 39b — Alchemist submenus
// ============================================================

// Compound's item picker. Lists every consumable in the catalog with:
//   - item name
//   - compound MP cost
//   - current stockpile count on the actor
//   - disabled when actor's MP < compoundMpCost
// Picking an item builds a `use_compound` action and submits via
// `submitItemPick` (no await-confirm — the picker itself is the
// confirmation surface).
function CompoundItemPicker({
  turnFlow,
  catalog,
}: {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
}): ReactElement {
  const actor = turnFlow.activeUnit;
  const consumables = collectConsumables(catalog);
  return (
    <Panel header="Compound — pick item">
      {consumables.length === 0 && <StatusLine>(no consumable items in catalog)</StatusLine>}
      {actor !== null && consumables.map((item) => {
        const have = actor.stockpile.get(item.id) ?? 0;
        const affordable = actor.vitals.mp >= item.compoundMpCost;
        const disabled = !affordable;
        const reason = affordable ? null : `Need ${item.compoundMpCost} MP (have ${actor.vitals.mp})`;
        return (
          <ItemPickerButton
            key={String(item.id)}
            label={item.name}
            sublineParts={[
              `MP ${item.compoundMpCost}`,
              `Have ${have}`,
            ]}
            disabled={disabled}
            reason={reason}
            onClick={() => {
              const action: ProposedAction = {
                type: 'use_compound',
                source: 'player',
                actorId: actor.id,
                payload: { itemId: item.id },
              };
              turnFlow.submitItemPick(action);
            }}
          />
        );
      })}
      <CancelButton onClick={turnFlow.cancel} />
    </Panel>
  );
}

// Throw Item's item picker. Lists every consumable the actor has at
// least one of (stockpile count > 0), each gated by whether the engine
// would accept throwing it at the chosen target — e.g. Phoenix Down only
// validates on a KO'd target, other items only on a living one. Disabled
// items show the engine's reason so the player isn't left guessing and
// can't waste a turn on a no-op throw. (S71: the per-item gate had been
// stubbed to `disabled={false}`, surfacing items the throw would reject.)
function ThrowItemItemPicker({
  turnFlow,
  catalog,
  engineState,
  targetUnitId,
}: {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
  readonly engineState: GameState | null;
  readonly targetUnitId: UnitId;
}): ReactElement {
  const actor = turnFlow.activeUnit;
  if (actor === null) return <Panel header="Throw Item" />;
  const consumables = collectConsumables(catalog).filter((item) => {
    const have = actor.stockpile.get(item.id) ?? 0;
    return have > 0;
  });
  return (
    <Panel header="Throw Item — pick item">
      {consumables.length === 0 && (
        <StatusLine>(no items in stockpile — Compound first)</StatusLine>
      )}
      {consumables.map((item) => {
        const have = actor.stockpile.get(item.id) ?? 0;
        let disabled = false;
        let reason: string | null = null;
        if (engineState !== null) {
          const v = validateAction(engineState, {
            type: 'use_throw_item',
            source: 'player',
            actorId: actor.id,
            payload: { itemId: item.id, target: { kind: 'unit', unitId: targetUnitId } },
          }, catalog);
          if (!v.valid) {
            disabled = true;
            reason = v.reason ?? null;
          }
        }
        return (
          <ItemPickerButton
            key={String(item.id)}
            label={item.name}
            sublineParts={[`Have ${have - 1} after throw`]}
            disabled={disabled}
            reason={reason}
            onClick={() => {
              const action: ProposedAction = {
                type: 'use_throw_item',
                source: 'player',
                actorId: actor.id,
                payload: {
                  itemId: item.id,
                  target: { kind: 'unit', unitId: targetUnitId },
                },
              };
              turnFlow.submitItemPick(action);
            }}
          />
        );
      })}
      <CancelButton onClick={turnFlow.cancel} />
    </Panel>
  );
}

function ItemPickerButton(props: {
  readonly label: string;
  readonly sublineParts: ReadonlyArray<string>;
  readonly disabled: boolean;
  readonly reason: string | null;
  readonly onClick: () => void;
}): ReactElement {
  const { label, sublineParts, disabled, reason, onClick } = props;
  return (
    <button
      type="button"
      style={{
        ...buttonBaseStyle,
        ...buttonPrimaryStyle,
        ...(disabled ? buttonDisabledStyle : null),
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 2,
        width: '100%',
      }}
      onClick={disabled ? noop : onClick}
      disabled={disabled}
      title={reason ?? undefined}
    >
      <span style={{ fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, opacity: 0.7 }}>{sublineParts.join(' · ')}</span>
      {disabled && reason !== null && (
        <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>{reason}</span>
      )}
    </button>
  );
}

function collectConsumables(catalog: Catalog): ReadonlyArray<ConsumableDefinition> {
  const out: ConsumableDefinition[] = [];
  for (const item of catalog.items()) {
    if (item.kind === 'consumable') out.push(item);
  }
  return out;
}
