// DetailHover — wrapper that renders a hover-anchored tooltip with
// auto-generated mechanical details about an ability or equipment item.
// Pulls content from `detail-text.ts`'s formatters; consumer just hands
// off the catalog entry and wraps the visible row.
//
// Positioning: when hovered, the tooltip appears to the LEFT of the
// wrapped element (the unit-detail panel sits on the right side of the
// HUD, so left-side placement keeps the tooltip on-screen). Falls back
// to right-side placement if the left edge would clip.
//
// Behavior: hover-only (no click). Tooltip is `pointer-events: none`,
// so mouse interactions with the underlying row aren't blocked.

import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { DetailContent } from './detail-text.ts';

export interface DetailHoverProps {
  readonly content: DetailContent | null;
  readonly children: ReactNode;
  // When the wrapper itself should be styled inline (most loadout rows
  // are flex children, so the wrapper must not break the flex flow).
  readonly style?: CSSProperties;
}

interface AnchorRect {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

export function DetailHover({ content, children, style }: DetailHoverProps): ReactElement {
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const onEnter = useCallback(() => {
    if (content === null) return;
    const el = wrapperRef.current;
    if (el === null) return;
    const r = el.getBoundingClientRect();
    setAnchor({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
  }, [content]);

  const onLeave = useCallback(() => {
    setAnchor(null);
  }, []);

  return (
    <span
      ref={wrapperRef}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
      {anchor !== null &&
        content !== null &&
        // Portal to <body> so the tooltip escapes any ancestor stacking
        // context — particularly the unit-detail-panel's `opacity: 0.65`
        // wrapper, which would otherwise multiply the tooltip's alpha
        // down to ~0.65 even though the inline background is fully
        // opaque. The portal renders the tooltip into a sibling of <main>
        // where no ancestor introduces opacity / transform / filter, so
        // the tooltip's painted color matches its declared color.
        createPortal(<Tooltip content={content} anchor={anchor} />, document.body)}
    </span>
  );
}

function Tooltip({
  content,
  anchor,
}: {
  readonly content: DetailContent;
  readonly anchor: AnchorRect;
}): ReactElement {
  // Placement strategy:
  //   1. If there's room to the left of the anchor (≥ TOOLTIP_WIDTH +
  //      GUTTER), place left — keeps the cursor over the source row.
  //   2. Else if there's room to the right, place right.
  //   3. Else pick the side with more room and shrink to fit (clamp at
  //      MIN_WIDTH); ensures the tooltip never clips off-screen on
  //      narrow viewports.
  // Vertical: anchor.top, then clamped against the viewport bottom so
  // long content panels stay readable on short heights.
  const TOOLTIP_WIDTH = 280;
  const MIN_WIDTH = 180;
  const GUTTER = 8;
  const VIEWPORT_PAD = 6;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : TOOLTIP_WIDTH;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 600;
  const roomLeft = anchor.left - VIEWPORT_PAD;
  const roomRight = viewportW - anchor.right - VIEWPORT_PAD;

  let width = TOOLTIP_WIDTH;
  let left: number;
  if (roomLeft >= TOOLTIP_WIDTH + GUTTER) {
    left = anchor.left - TOOLTIP_WIDTH - GUTTER;
  } else if (roomRight >= TOOLTIP_WIDTH + GUTTER) {
    left = anchor.right + GUTTER;
  } else if (roomLeft >= roomRight) {
    // Shrink-to-fit on the left side.
    width = Math.max(MIN_WIDTH, roomLeft - GUTTER);
    left = anchor.left - width - GUTTER;
  } else {
    // Shrink-to-fit on the right side.
    width = Math.max(MIN_WIDTH, roomRight - GUTTER);
    left = anchor.right + GUTTER;
  }
  // Clamp left so the tooltip never starts off-screen on either edge.
  left = Math.max(VIEWPORT_PAD, Math.min(left, viewportW - width - VIEWPORT_PAD));

  // Estimate a generous content height for vertical clamping. Real layout
  // measures after mount, but for v1 we just anchor-to-top and let the
  // bottom clip if the line count overflows; clamping pulls the tooltip
  // up so the top isn't lost when the anchor sits near the bottom edge.
  const ESTIMATED_HEIGHT = 240;
  let top = anchor.top;
  if (top + ESTIMATED_HEIGHT > viewportH - VIEWPORT_PAD) {
    top = Math.max(VIEWPORT_PAD, viewportH - ESTIMATED_HEIGHT - VIEWPORT_PAD);
  }

  return (
    <div
      style={{
        ...tooltipStyle,
        left,
        top,
        width,
      }}
    >
      <div style={titleStyle}>{content.title}</div>
      {content.subtitle !== undefined && (
        <div style={subtitleStyle}>{content.subtitle}</div>
      )}
      <div style={dividerStyle} />
      {content.lines.map((line, i) => (
        <div key={i} style={lineStyle}>
          {line}
        </div>
      ))}
    </div>
  );
}

const tooltipStyle: CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  // Fully opaque so the underlying detail-panel rows don't bleed through
  // and make the tooltip text hard to read. The strong shadow + border
  // anchor the card visually against the panel beneath.
  background: '#14161c',
  border: '1px solid #3a3e48',
  borderRadius: 6,
  padding: '8px 10px',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
  zIndex: 60,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.65)',
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  marginBottom: 1,
};

const subtitleStyle: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  opacity: 0.6,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: '#2c2f36',
  margin: '6px 0',
};

const lineStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.4,
  opacity: 0.92,
  fontVariantNumeric: 'tabular-nums',
};
