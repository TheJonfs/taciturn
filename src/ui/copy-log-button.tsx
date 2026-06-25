// CopyLogButton (S74) — dumps a battle's full action ledger to the
// clipboard for playtesting / debugging. Mounted in the in-battle
// ActionLogPanel header (mid-battle dumps) and on the post-battle
// ResultsScreen (final dump).
//
// Encapsulates the serialize → `navigator.clipboard.writeText` → transient
// confirmation flow, mirroring the team-export modal's copy UX. Disabled
// until there's a log to copy. Failures surface ("Copy failed") rather than
// silently no-op — the clipboard API rejects on non-secure-context /
// permissions-denied.

import { useCallback, useState, type CSSProperties, type ReactElement } from 'react';
import type { GameState } from '@engine/index.ts';
import { serializeBattleLog } from './action-log-export.ts';

type CopyState = 'idle' | 'copied' | 'error';

const baseStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  padding: '3px 9px',
  borderRadius: '4px',
  border: '1px solid #3a414c',
  background: '#222831',
  color: '#b9c2cf',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};
const copiedStyle: CSSProperties = { borderColor: '#3f7d4a', color: '#7fd18c' };
const errorStyle: CSSProperties = { borderColor: '#7d3f3f', color: '#f0635a' };
const disabledStyle: CSSProperties = { opacity: 0.45, cursor: 'default' };

export interface CopyLogButtonProps {
  readonly state: GameState | null;
  // Idle-state label; defaults to "Copy log". Lets the results screen use a
  // fuller label ("Copy battle log") where there's room.
  readonly label?: string;
  readonly style?: CSSProperties;
}

export function CopyLogButton({ state, label = 'Copy log', style }: CopyLogButtonProps): ReactElement {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const empty = state === null || state.actionLog.length === 0;

  const onCopy = useCallback(async (): Promise<void> => {
    if (state === null) return;
    try {
      await navigator.clipboard.writeText(serializeBattleLog(state));
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  }, [state]);

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={empty}
      title="Copy the full action log (header + ledger) as JSON"
      style={{
        ...baseStyle,
        ...(copyState === 'copied' ? copiedStyle : {}),
        ...(copyState === 'error' ? errorStyle : {}),
        ...(empty ? disabledStyle : {}),
        ...style,
      }}
    >
      {copyState === 'copied'
        ? '✓ Copied'
        : copyState === 'error'
          ? 'Copy failed'
          : label}
    </button>
  );
}
