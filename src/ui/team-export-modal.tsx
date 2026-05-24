// TeamExportModal — paste-ready JSON output for a built team (S48).
//
// Opens from the team-builder header's "Export" button. Renders the
// team's JSON in a textarea + a "Copy to Clipboard" button + a Close
// button. The output matches `current-test-team.ts`'s thin-form shape
// so the implementer can paste it into a new template file with minimal
// translation (wrap each id literal in `classId('…')` / `itemId(…)` /
// `abilityId(…)` / `commandSetId(…)` and the rest is the same).
//
// No back-import: this is purely an export-out surface. Read-only.
//
// Modal closes on Escape and on backdrop click. The textarea is auto-
// selected on open so the player can also use the keyboard (Ctrl/Cmd+C)
// to copy the content instead of the button.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import type { BuiltTeam } from '@content/teams/index.ts';
import { exportBuiltTeamJson } from './team-export.ts';

export interface TeamExportModalProps {
  readonly team: BuiltTeam;
  readonly onClose: () => void;
}

export function TeamExportModal({ team, onClose }: TeamExportModalProps): ReactElement {
  // Compute the JSON once per (team) — the modal lives only while open,
  // and team is captured at open time. A fresh open with new state
  // remounts the modal with a new value.
  const json = useRef(exportBuiltTeamJson(team)).current;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    // Auto-select the JSON so a player can Ctrl/Cmd+C even without the
    // copy button. Mirrors common "share this" modal patterns.
    textareaRef.current?.select();
  }, []);

  useEffect(() => {
    // Escape closes — the standard modal exit affordance.
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState('copied');
      // Reset after a short window — gives the player a beat to see the
      // confirmation but doesn't lock the button into the "copied" state
      // in case they want to re-copy.
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // Permissions-denied / non-secure-context / etc. Surface the
      // failure rather than silently no-op — the textarea remains
      // selected so the player can fall back to Ctrl+C.
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  }, [json]);

  return (
    <div
      style={backdropStyle}
      onClick={(e) => {
        // Only close on direct backdrop click — clicks bubbling up from
        // the inner card shouldn't dismiss the modal mid-interaction.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>Export Team</div>
          <button type="button" style={closeButtonStyle} onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={bodyStyle}>
          <div style={instructionsStyle}>
            Copy the JSON below and paste it into a new template file at{' '}
            <code style={inlineCodeStyle}>src/content/teams/</code>. Wrap each
            id literal with its constructor —{' '}
            <code style={inlineCodeStyle}>classId('…')</code>,{' '}
            <code style={inlineCodeStyle}>itemId('…')</code>,{' '}
            <code style={inlineCodeStyle}>abilityId('…')</code>,{' '}
            <code style={inlineCodeStyle}>commandSetId('…')</code> — and the
            rest of the shape is the same as the existing templates.
          </div>
          <textarea
            ref={textareaRef}
            value={json}
            readOnly
            style={textareaStyle}
            spellCheck={false}
          />
        </div>
        <div style={footerStyle}>
          <button
            type="button"
            style={{
              ...primaryButtonStyle,
              ...(copyState === 'copied' ? primaryButtonCopiedStyle : {}),
              ...(copyState === 'error' ? primaryButtonErrorStyle : {}),
            }}
            onClick={onCopy}
          >
            {copyState === 'copied'
              ? '✓ Copied to clipboard'
              : copyState === 'error'
                ? 'Copy failed — select + Ctrl/Cmd+C'
                : 'Copy to Clipboard'}
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- styles ----

const backdropStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};

const cardStyle: CSSProperties = {
  width: 'min(720px, 92vw)',
  maxHeight: '88vh',
  background: '#14161c',
  border: '1px solid #3a3e48',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  borderBottom: '1px solid #2c2f36',
};

const titleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#cfd2da',
  fontSize: 16,
  cursor: 'pointer',
  padding: 4,
  lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  flex: '1 1 auto',
  minHeight: 0,
};

const instructionsStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
  lineHeight: 1.5,
};

const inlineCodeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 11,
  background: '#1c1e23',
  padding: '1px 5px',
  borderRadius: 3,
};

const textareaStyle: CSSProperties = {
  width: '100%',
  flex: '1 1 auto',
  minHeight: 280,
  background: '#0e0f12',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
  padding: 10,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: 11,
  lineHeight: 1.45,
  resize: 'none',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 10,
  padding: '12px 18px',
  borderTop: '1px solid #2c2f36',
};

const primaryButtonStyle: CSSProperties = {
  background: '#4a90e2',
  color: '#0e0f12',
  border: 'none',
  borderRadius: 4,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryButtonCopiedStyle: CSSProperties = {
  background: '#6dc66d',
};

const primaryButtonErrorStyle: CSSProperties = {
  background: '#e07a7a',
};

const secondaryButtonStyle: CSSProperties = {
  background: 'transparent',
  color: '#cfd2da',
  border: '1px solid #3a3e48',
  borderRadius: 4,
  padding: '8px 16px',
  fontSize: 13,
  cursor: 'pointer',
};
