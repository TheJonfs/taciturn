// StorySceneBeatView — the story-scene beat renderer (TABA M1.5).
//
// Renders one authored `StoryScene` as click-through dialogue: a speaker
// nameplate + optional class portrait + a line of text, advanced one line at a
// time. When the last line is read, `onAdvance()` proceeds to the next beat in
// the sequence. NO in-scene choices (brief D3) — a scene is linear prose; the
// only branch is the ambient Quit escape.
//
// A presentational beat: the generic runner dispatches to this by `beat.type`
// and never switches on it (open set). Portraits reuse the existing
// class-portrait pipeline (`portraitUrlFor`) so no new art path is introduced.

import { useState, type CSSProperties, type ReactElement } from 'react';
import type { DialogueLine, StoryScene } from '@campaign/index.ts';
import { portraitUrlFor } from '../../assets/portraits/index.ts';
import type { BeatRendererProps } from './InterstitialRunner.tsx';

export function StorySceneBeatView({ beat, onAdvance, onExitToTitle }: BeatRendererProps): ReactElement {
  // Narrow the open beat union to this renderer's variant.
  if (beat.type !== 'story-scene') return <></>;
  const scene: StoryScene = beat.scene;

  const [lineIndex, setLineIndex] = useState(0);
  const line: DialogueLine | undefined = scene.lines[lineIndex];

  // Defensive: an empty scene has nothing to show — advance immediately so the
  // sequence never stalls (authoring shouldn't produce one).
  if (line === undefined) {
    onAdvance();
    return <></>;
  }

  const isLast = lineIndex >= scene.lines.length - 1;
  const advanceLine = (): void => {
    if (isLast) onAdvance();
    else setLineIndex((i) => i + 1);
  };

  const portraitUrl = line.portrait
    ? portraitUrlFor(line.portrait.classId, line.portrait.gender)
    : null;

  return (
    <div style={rootStyle}>
      {/* The whole stage advances the line on click — a familiar VN affordance. */}
      <div style={stageStyle} onClick={advanceLine} role="button" aria-label="Advance dialogue">
        {scene.title !== undefined && <div style={sceneTitleStyle}>{scene.title}</div>}

        <div style={panelStyle}>
          <div style={portraitFrameStyle}>
            {portraitUrl !== null ? (
              <img src={portraitUrl} alt={line.speaker} style={portraitImgStyle} />
            ) : (
              <div style={portraitFallbackStyle} aria-hidden="true" />
            )}
          </div>

          <div style={dialogueStyle}>
            <div style={nameplateStyle}>{line.speaker}</div>
            <p style={textStyle}>{line.text}</p>
            <div style={footerStyle}>
              <span style={progressStyle}>
                {lineIndex + 1} / {scene.lines.length}
              </span>
              <span style={advanceHintStyle}>{isLast ? 'Continue →' : 'Click to continue ▸'}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        style={quitStyle}
        onClick={(e) => {
          e.stopPropagation();
          onExitToTitle();
        }}
      >
        Quit to Title
      </button>
    </div>
  );
}

// ---- styles (shared dark shape with the other beat views) ----

const rootStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const stageStyle: CSSProperties = {
  width: 640,
  maxWidth: '92vw',
  cursor: 'pointer',
  userSelect: 'none',
};

const sceneTitleStyle: CSSProperties = {
  margin: '0 0 12px',
  fontSize: 13,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#9aa0ac',
  textAlign: 'center',
};

const panelStyle: CSSProperties = {
  display: 'flex',
  gap: 18,
  padding: 20,
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
};

const portraitFrameStyle: CSSProperties = {
  flex: '0 0 auto',
  width: 112,
  height: 112,
  borderRadius: 6,
  overflow: 'hidden',
  background: '#101216',
  border: '1px solid #2c2f36',
};

const portraitImgStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'top center',
  display: 'block',
};

const portraitFallbackStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  background: 'linear-gradient(135deg, #23262d, #16181d)',
};

const dialogueStyle: CSSProperties = { flex: '1 1 auto', display: 'flex', flexDirection: 'column' };

const nameplateStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#e0c87f',
  marginBottom: 8,
};

const textStyle: CSSProperties = {
  flex: '1 1 auto',
  margin: 0,
  fontSize: 15,
  lineHeight: 1.6,
  color: '#e7e9ee',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: 14,
};

const progressStyle: CSSProperties = { fontSize: 12, color: '#6b707b' };
const advanceHintStyle: CSSProperties = { fontSize: 13, color: '#9aa0ac' };

const quitStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  right: 16,
  padding: '6px 12px',
  fontSize: 12,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  background: '#1c1e23',
  color: '#c7ccd6',
  fontFamily: 'inherit',
  cursor: 'pointer',
};
