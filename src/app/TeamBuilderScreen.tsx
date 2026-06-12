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
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { loadDefaultCatalog } from '@content/index.ts';
import { riverRidgeBattle } from '@content/battles/river-ridge-battle.ts';
import type { BuiltTeam } from '@content/teams/index.ts';
import { TeamExportModal } from '@ui/team-export-modal.tsx';
import type { BattleConfig, Catalog, TeamControl } from '@engine/index.ts';
import {
  TeamBuilderDefaultLoader,
  TeamBuilderRoster,
  TeamBuilderUnitCard,
  useTeamBuilder,
  type TeamBuilder,
  type TeamBuilderState,
} from '@ui/index.ts';

const BACKGROUND = '#0e0f12';

export interface TeamBuilderScreenProps {
  // Continue: the player built a valid team and clicked the continue
  // button. The `BuiltTeam` is threaded by `App` to the next phase.
  readonly onContinue: (team: BuiltTeam) => void;
  // Back to battle setup.
  readonly onBack: () => void;
  // S47: the map template the builder builds against. Defaults to
  // riverRidgeBattle for backward compatibility with tests; `App` passes
  // the player's setup-screen selection through.
  readonly mapTemplate?: BattleConfig;
  // Which team this builder instance is assembling (S43). Drives the
  // header title; `App` runs the builder once per team in sequence.
  readonly teamLabel: string;
  // The team's chosen controller (set on the setup screen). Displayed
  // read-only here — it doesn't change what you can build (an AI team
  // gets the same full builder as a human one, per S43), only who drives
  // it in battle.
  readonly control: TeamControl;
  // Footer button label. "Continue to Team B", "Continue to Deployment",
  // etc., depending on what comes next — `App` decides.
  readonly continueLabel: string;
  // Header back-button label. "Back to Setup" for Team A, "Back to Team
  // A" for Team B (the builder runs in sequence). Defaults to "Back to
  // Setup" when omitted.
  readonly backLabel?: string;
  // Optional initial draft (S37). When the player navigates back into
  // this screen, `App` re-hydrates the draft it captured on the last
  // mutation so the in-progress build isn't lost.
  readonly initialDraft?: TeamBuilderState | null;
  // Optional change notifier (S37). The screen forwards every draft
  // mutation so `App` can keep its preserved copy current.
  readonly onDraftChange?: (draft: TeamBuilderState) => void;
}

export function TeamBuilderScreen({
  onContinue,
  onBack,
  mapTemplate = riverRidgeBattle,
  teamLabel,
  control,
  continueLabel,
  backLabel = 'Back to Setup',
  initialDraft,
  onDraftChange,
}: TeamBuilderScreenProps): ReactElement {
  // Catalog loaded once, held in a ref for stable identity across Fast
  // Refresh — same discipline as DeploymentScreen / BattleView.
  const catalogRef = useRef<Catalog | null>(null);
  if (catalogRef.current === null) {
    catalogRef.current = loadDefaultCatalog();
  }
  const catalog = catalogRef.current;

  const builder = useTeamBuilder({
    mapTemplate,
    catalog,
    initialDraft,
    onDraftChange,
  });
  const { validity } = builder;

  // S48 export modal — open via the "Export" header button. The modal
  // captures the current team's JSON form at open time; mutations in
  // the builder after opening don't update the modal until the player
  // closes and re-opens.
  const [exportOpen, setExportOpen] = useState(false);

  const handleContinue = (): void => {
    if (!validity.valid) return;
    onContinue(builder.toBuiltTeam());
  };

  // Gate the Export button on team validity — matches the "Continue"
  // button's gate so the player only ever exports a structurally-sound
  // team. (An invalid mid-build team is rarely useful to paste anywhere.)
  const canExport = validity.valid;

  return (
    <div style={rootStyle}>
      <div style={headerStyle}>
        <div style={titleGroupStyle}>
          <div style={titleStyle}>Build {teamLabel}</div>
          <span style={controlBadgeStyle}>{control === 'human' ? 'Human' : 'AI'}</span>
        </div>
        <div style={headerActionsStyle}>
          <TeamBuilderDefaultLoader builder={builder} />
          <button
            type="button"
            style={{
              ...secondaryButtonStyle,
              ...(canExport ? {} : disabledButtonStyle),
            }}
            onClick={() => canExport && setExportOpen(true)}
            disabled={!canExport}
            title={
              canExport
                ? 'Export current team as JSON'
                : 'Team must be valid to export'
            }
          >
            Export
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={onBack}>
            {backLabel}
          </button>
        </div>
      </div>

      <div style={mainStyle}>
        <TeamBuilderRoster builder={builder} catalog={catalog} />
        <div style={centerColumnStyle}>
          <div style={cardSlotStyle}>
            <TeamBuilderUnitCard builder={builder} catalog={catalog} />
            <InspectorPlaceholder />
          </div>
        </div>
      </div>

      <FooterBar
        builder={builder}
        onContinue={handleContinue}
        catalog={catalog}
        continueLabel={continueLabel}
      />

      {exportOpen && (
        <TeamExportModal
          team={builder.toBuiltTeam()}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}

// ---- inspector region ----

// The context inspector sits below the card and (in Pass 2) tracks the
// hovered equipment candidate or ability — showing full detail plus the
// delta-vs-equipped / budget-fit. Pass 1 reserves the region with a
// neutral placeholder so the layout doesn't reflow when the live
// inspector swaps in next pass.
function InspectorPlaceholder(): ReactElement {
  return (
    <div style={inspectorStyle}>
      <span style={inspectorHintStyle}>
        Hover an ability or a piece of equipment to inspect it here.
      </span>
    </div>
  );
}

// ---- footer ----

function FooterBar({
  builder,
  onContinue,
  catalog,
  continueLabel,
}: {
  builder: TeamBuilder;
  onContinue: () => void;
  catalog: Catalog;
  continueLabel: string;
}): ReactElement {
  const messages = validationMessages(builder, catalog);
  const valid = builder.validity.valid;

  return (
    <div style={footerStyle}>
      <div style={validationAreaStyle}>
        {valid ? (
          <span style={validOkStyle}>Team is valid — ready to continue.</span>
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
        {continueLabel}
      </button>
    </div>
  );
}

// Human-readable validity messages for the footer. Built from the
// structured `TeamValidity` predicate. S48: empty slots are valid-but-
// empty and produce no message; only filled slots' rule violations show.
// A single top-line message surfaces when the team has no active units
// at all (the only way the size gate fails today, since MAX_TEAM_SIZE
// matches the slot count).
function validationMessages(builder: TeamBuilder, catalog: Catalog): string[] {
  const { validity, state } = builder;
  const messages: string[] = [];

  if (validity.activeUnitCount === 0) {
    messages.push('Add at least one unit — empty teams cannot deploy.');
  }

  validity.units.forEach((unitValidity, index) => {
    // S48: an empty (classless) slot is intentionally not flagged. The
    // roster card already presents the "No class selected" placeholder
    // and clicking it lets the player fill the slot; surfacing the
    // emptiness as a validation error treats normal "team < MAX" play
    // as broken.
    if (!unitValidity.hasClass) return;
    const label = `Unit ${index + 1}`;
    if (unitValidity.invalidEquipmentSlots.length > 0) {
      messages.push(
        `${label}: ${unitValidity.invalidEquipmentSlots.join(', ')} ` +
          `cannot be used by this class.`,
      );
    }
    if (unitValidity.dualWielding) {
      messages.push(
        `${label}: only one weapon per unit — equip a shield or empty ` +
          `the off-hand.`,
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

const titleGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const titleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: '#f6e5a8',
};

const controlBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  padding: '3px 8px',
  borderRadius: 4,
  background: '#2a3140',
  color: '#cfd2da',
  border: '1px solid #3a4150',
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

// The central column holds the unit card and the inspector region. It
// scrolls independently of the lineup; the card is centered with a cap
// so it reads as a single object rather than stretching edge-to-edge
// (Chris's target: roughly 0.8 view-width, with the lineup taking the
// rest).
const centerColumnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: 'auto',
  display: 'flex',
  justifyContent: 'center',
  padding: 20,
};

const cardSlotStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  width: '100%',
  maxWidth: 960,
};

const inspectorStyle: CSSProperties = {
  minHeight: 96,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(22, 24, 29, 0.9)',
  border: '1px dashed #2c2f36',
  borderRadius: 10,
  padding: 16,
};

const inspectorHintStyle: CSSProperties = {
  fontSize: 12,
  fontStyle: 'italic',
  opacity: 0.45,
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
