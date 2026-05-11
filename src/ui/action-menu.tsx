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

import type { CSSProperties, ReactElement } from 'react';
import { projectTurnEndCt, type ActiveAbilityDefinition, type Catalog, type Direction, type GameState } from '@engine/index.ts';
import type { TurnFlow } from './use-turn-flow.ts';

export interface ActionMenuProps {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
  // Game state, surfaced to the menu for end-CT projection. Pulled in
  // alongside `turnFlow` rather than wedged into the hook so the engine
  // forecast helpers stay one-call-from-the-menu.
  readonly engineState: GameState | null;
  // Open the unit-detail panel for a given unit. Wired in by BattleView.
  readonly onOpenUnitDetail?: (unitId: import('@engine/index.ts').UnitId) => void;
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
      return (
        <Panel header={`Target — ${label}`}>
          <StatusLine>Click a highlighted target</StatusLine>
          <CancelButton onClick={turnFlow.cancel} />
        </Panel>
      );
    }

    case 'await-confirm':
      return <ConfirmRow turnFlow={turnFlow} catalog={catalog} />;

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
function WaitConfirm({ turnFlow }: { readonly turnFlow: TurnFlow }): ReactElement {
  const currentFacing = turnFlow.activeUnit?.facing ?? 'N';
  const directions: ReadonlyArray<{ readonly dir: Direction; readonly label: string }> = [
    { dir: 'N', label: 'North ↑' },
    { dir: 'E', label: 'East →' },
    { dir: 'S', label: 'South ↓' },
    { dir: 'W', label: 'West ←' },
  ];
  return (
    <Panel header="End turn — pick facing">
      <StatusLine>Choose which way to face</StatusLine>
      {directions.map((d) => (
        <Button
          key={d.dir}
          label={d.dir === currentFacing ? `${d.label} (current)` : d.label}
          disabled={false}
          onClick={() => turnFlow.submitWait(d.dir)}
          variant={d.dir === currentFacing ? 'primary' : 'secondary'}
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
  readonly onOpenUnitDetail?: (unitId: import('@engine/index.ts').UnitId) => void;
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

  return (
    <Panel header="Action Menu">
      <Button
        label={`Move (${movesAvailable})${fmtCost(moveCost)}`}
        disabled={movesAvailable <= 0}
        onClick={() => turnFlow.dispatch({ kind: 'pickMove' })}
      />
      <Button
        label={`Act (${actsAvailable})${fmtCost(actCost)}`}
        disabled={actsAvailable <= 0 || !actSurfaceHasContent}
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
              onClick={() => turnFlow.dispatch({ kind: 'pickFreeAbility', abilityId: entry.abilityId })}
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
          disabled={entry.disabled}
          reason={entry.disableReason}
          onClick={() => turnFlow.dispatch({ kind: 'pickAbility', abilityId: entry.ability.id })}
        />
      ))}
      <CancelButton onClick={turnFlow.cancel} />
    </Panel>
  );
}

function AbilityButton(props: {
  readonly ability: ActiveAbilityDefinition;
  readonly disabled: boolean;
  readonly reason: string | null;
  readonly onClick: () => void;
}): ReactElement {
  const { ability, disabled, reason, onClick } = props;
  const mp = ability.mpCost;
  const charge = ability.actionSpeed > 0 ? ` · charge ${ability.actionSpeed}` : '';
  const subline = `MP ${mp}${charge}`;
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
      }}
      onClick={disabled ? noop : onClick}
      disabled={disabled}
      title={reason ?? undefined}
    >
      <span style={{ fontWeight: 500 }}>{ability.name}</span>
      <span style={{ fontSize: 11, opacity: 0.7 }}>{subline}</span>
      {disabled && reason !== null && (
        <span style={{ fontSize: 10, opacity: 0.6, fontStyle: 'italic' }}>{reason}</span>
      )}
    </button>
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
