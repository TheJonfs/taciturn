// TeamBuilderScreen — the team builder phase (Session 36 / Phase E).
//
// Sits between battle setup and deployment: Title → Battle Setup →
// Team Builder → Deployment → Battle. The player assembles a four-unit
// team (class, equipment, abilities, Brave/Faith per unit), or loads a
// bundled default, then continues to the deployment phase with a
// `BuiltTeam`.
//
// A pure-DOM screen — no Pixi renderer, unlike DeploymentScreen — so it
// needs no canvas lifecycle. The catalog is still held in a `useRef`
// one-shot for Fast Refresh stability (the S34 HMR discipline). No class
// exports in this module — Fast Refresh safe.

import {
  useRef,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import type { BuiltTeam } from '@content/teams/index.ts';
import {
  BRAVE_FAITH_MAX,
  BRAVE_FAITH_MIN,
} from '@content/teams/index.ts';
import type { Catalog } from '@engine/index.ts';
import {
  TeamBuilderAbilityPicker,
  TeamBuilderClassPicker,
  TeamBuilderDefaultLoader,
  TeamBuilderEquipmentSlots,
  TeamBuilderRoster,
  useTeamBuilder,
  type TeamBuilder,
} from '@ui/index.ts';

const BACKGROUND = '#0e0f12';

export interface TeamBuilderScreenProps {
  // Continue: the player built a valid team and clicked "Continue to
  // Deployment". The `BuiltTeam` is threaded by `App` into the
  // deployment phase.
  readonly onContinue: (team: BuiltTeam) => void;
  // Back to battle setup.
  readonly onBack: () => void;
}

export function TeamBuilderScreen({
  onContinue,
  onBack,
}: TeamBuilderScreenProps): ReactElement {
  // Catalog loaded once, held in a ref for stable identity across Fast
  // Refresh — same discipline as DeploymentScreen / BattleView.
  const catalogRef = useRef<Catalog | null>(null);
  if (catalogRef.current === null) {
    catalogRef.current = loadDefaultCatalog();
  }
  const catalog = catalogRef.current;

  const builder = useTeamBuilder({ mapTemplate: riverRidgeBattle, catalog });
  const { validity } = builder;

  const handleContinue = (): void => {
    if (!validity.valid) return;
    onContinue(builder.toBuiltTeam());
  };

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Build Your Team</div>
        <div style={headerActionsStyle}>
          <TeamBuilderDefaultLoader builder={builder} />
          <button type="button" style={secondaryButtonStyle} onClick={onBack}>
            Back to Setup
          </button>
        </div>
      </div>

      <div style={mainStyle}>
        <TeamBuilderRoster builder={builder} catalog={catalog} />
        <EditPanel builder={builder} catalog={catalog} />
      </div>

      <FooterBar builder={builder} onContinue={handleContinue} catalog={catalog} />
    </div>
  );
}

// ---- edit panel ----

function EditPanel({
  builder,
  catalog,
}: {
  builder: TeamBuilder;
  catalog: Catalog;
}): ReactElement {
  const { selectedIndex, selectedUnit, setBrave, setFaith } = builder;

  return (
    <div style={editPanelStyle}>
      <div style={editHeaderStyle}>
        Editing Unit {selectedIndex + 1}
        {selectedUnit.classId !== null &&
          ` — ${catalog.getClass(selectedUnit.classId).name}`}
      </div>

      <TeamBuilderClassPicker builder={builder} catalog={catalog} />

      <div style={braveFaithRowStyle}>
        <SliderControl
          label="Brave"
          value={selectedUnit.brave}
          onChange={(v) => setBrave(selectedIndex, v)}
        />
        <SliderControl
          label="Faith"
          value={selectedUnit.faith}
          onChange={(v) => setFaith(selectedIndex, v)}
        />
      </div>

      <div style={twoColumnStyle}>
        <TeamBuilderEquipmentSlots builder={builder} catalog={catalog} />
        <TeamBuilderAbilityPicker builder={builder} catalog={catalog} />
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <label style={sliderControlStyle}>
      <div style={sliderHeaderStyle}>
        <span style={sliderLabelStyle}>{label}</span>
        <span style={sliderValueStyle}>{value}</span>
      </div>
      <input
        type="range"
        min={BRAVE_FAITH_MIN}
        max={BRAVE_FAITH_MAX}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={sliderInputStyle}
      />
    </label>
  );
}

// ---- footer ----

function FooterBar({
  builder,
  onContinue,
  catalog,
}: {
  builder: TeamBuilder;
  onContinue: () => void;
  catalog: Catalog;
}): ReactElement {
  const messages = validationMessages(builder, catalog);
  const valid = builder.validity.valid;

  return (
    <div style={footerStyle}>
      <div style={validationAreaStyle}>
        {valid ? (
          <span style={validOkStyle}>Team is valid — ready to deploy.</span>
        ) : (
          messages.map((message, i) => (
            <span key={i} style={validationMsgStyle}>
              {message}
            </span>
          ))
        )}
      </div>
      <button
        type="button"
        style={{
          ...primaryButtonStyle,
          ...(valid ? {} : disabledButtonStyle),
        }}
        onClick={onContinue}
        disabled={!valid}
      >
        Continue to Deployment
      </button>
    </div>
  );
}

// Human-readable validity messages for the footer. Built from the
// structured `TeamValidity` predicate.
function validationMessages(builder: TeamBuilder, catalog: Catalog): string[] {
  const { validity, state } = builder;
  const messages: string[] = [];

  validity.units.forEach((unitValidity, index) => {
    const label = `Unit ${index + 1}`;
    if (!unitValidity.hasClass) {
      messages.push(`${label} needs a class.`);
      return;
    }
    if (unitValidity.invalidEquipmentSlots.length > 0) {
      messages.push(
        `${label}: ${unitValidity.invalidEquipmentSlots.join(', ')} ` +
          `cannot be used by this class.`,
      );
    }
    for (const overage of unitValidity.bucketOverages) {
      messages.push(
        `${label}: ${String(overage.bucketId)} over capacity ` +
          `(${overage.used}/${overage.capacity}).`,
      );
    }
  });

  for (const classId of validity.duplicateClassIds) {
    const name = catalog.hasClass(classId)
      ? catalog.getClass(classId).name
      : String(classId);
    messages.push(`${name} is on the team more than once — one per team.`);
  }

  for (const itemId of validity.duplicateItemIds) {
    const name = catalog.hasItem(itemId)
      ? catalog.getItem(itemId).name
      : String(itemId);
    messages.push(`${name} is equipped on more than one unit.`);
  }

  void state;
  return messages;
}

// ---- styles ----

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  background: BACKGROUND,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  borderBottom: '1px solid #2c2f36',
  flexShrink: 0,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#f6e5a8',
};

const headerActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
};

const mainStyle: CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
};

const editPanelStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 18,
  overflowY: 'auto',
};

const editHeaderStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#cfd2da',
};

const braveFaithRowStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
};

const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 20,
  alignItems: 'start',
};

const sliderControlStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
};

const sliderHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const sliderLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.55,
};

const sliderValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
};

const sliderInputStyle: CSSProperties = {
  width: '100%',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: '12px 18px',
  borderTop: '1px solid #2c2f36',
  flexShrink: 0,
};

const validationAreaStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 12,
  maxHeight: 72,
  overflowY: 'auto',
};

const validOkStyle: CSSProperties = {
  color: '#6dc66d',
};

const validationMsgStyle: CSSProperties = {
  color: '#e0a85a',
};

const buttonBaseStyle: CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
  flexShrink: 0,
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#2a3140',
  color: '#e7e9ee',
  borderColor: '#3a4150',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: '#1c1e23',
  color: '#b9bcc4',
  borderColor: '#2c2f36',
};

const disabledButtonStyle: CSSProperties = {
  opacity: 0.4,
  cursor: 'not-allowed',
};
