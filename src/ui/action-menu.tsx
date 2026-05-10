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
import type { ActiveAbilityDefinition, Catalog } from '@engine/index.ts';
import type { TurnFlow } from './use-turn-flow.ts';

export interface ActionMenuProps {
  readonly turnFlow: TurnFlow;
  readonly catalog: Catalog;
}

export function ActionMenu({ turnFlow, catalog }: ActionMenuProps): ReactElement {
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
      return <TopLevel turnFlow={turnFlow} />;

    case 'move-select':
      return (
        <Panel header="Move">
          <StatusLine>Click a blue tile to move</StatusLine>
          <CancelButton onClick={turnFlow.cancel} />
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

    case 'animation':
      return (
        <Panel header="Action Menu">
          <StatusLine>Resolving…</StatusLine>
        </Panel>
      );
  }
}

// ---- subcomponents ----

function TopLevel({ turnFlow }: { readonly turnFlow: TurnFlow }): ReactElement {
  const { movesAvailable, actsAvailable, waitDisabled, activeCommandSets } = turnFlow;
  return (
    <Panel header="Action Menu">
      <Button
        label={`Move (${movesAvailable})`}
        disabled={movesAvailable <= 0}
        onClick={() => turnFlow.dispatch({ kind: 'pickMove' })}
      />
      <Button
        label={`Act (${actsAvailable})`}
        disabled={actsAvailable <= 0 || activeCommandSets.length === 0}
        onClick={() => turnFlow.dispatch({ kind: 'pickAct', commandSets: activeCommandSets })}
      />
      <Button
        label="Wait"
        disabled={waitDisabled}
        onClick={() => turnFlow.submitWait()}
      />
      <Button
        label="Status"
        disabled
        onClick={noop}
        title="(Session 24)"
      />
    </Panel>
  );
}

function CommandSetPicker({ turnFlow, catalog }: { readonly turnFlow: TurnFlow; readonly catalog: Catalog }): ReactElement {
  return (
    <Panel header="Choose Command Set">
      {turnFlow.activeCommandSets.map((csId) => {
        const cs = catalog.hasCommandSet(csId) ? catalog.getCommandSet(csId) : null;
        const label = cs?.name ?? String(csId);
        return (
          <Button
            key={String(csId)}
            label={label}
            disabled={false}
            onClick={() => turnFlow.dispatch({ kind: 'pickCommandSet', commandSetId: csId })}
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
