// TeamBuilderIcon — a small hand-rolled inline-SVG icon set for the
// redesigned team builder (Pass 2). No icon-library dependency; this
// follows the action-log redesign's inline-SVG precedent.
//
// Discipline (per the brief): icons are *wayfinding, redundant with the
// text label* — never a language the player must learn. Every place an
// icon appears, the name/label is right next to it. So the set stays
// small and a few families deliberately share a glyph (knight swords use
// the sword glyph; staves use the wand glyph) — the text group header
// ("Knight Swords", "Staves") carries the fine distinction.
//
// All glyphs are stroke-based on a 24×24 box and inherit `currentColor`,
// so a parent's color/opacity drives them.

import type { ReactElement } from 'react';
import type { WeaponType } from '@engine/index.ts';

export type IconName =
  // weapon families
  | 'sword'
  | 'knife'
  | 'axe'
  | 'polearm'
  | 'bow'
  | 'wand'
  // equipment slot kinds
  | 'shield'
  | 'armor'
  | 'headgear'
  | 'accessory'
  | 'hand-empty'
  // ability sections
  | 'command-set'
  | 'reaction'
  | 'support'
  | 'movement'
  // ui affordances
  | 'chevron-down'
  | 'chevron-up'
  | 'check'
  | 'search'
  | 'sort'
  | 'back';

const PATHS: Record<IconName, ReactElement> = {
  // — weapon families —
  sword: (
    <>
      <path d="M5 19l3-3M14.5 4.5L20 4l-.5 5.5-9 9-5 .5-.5-5z" />
      <path d="M9.5 14.5l-2 2" />
    </>
  ),
  knife: (
    <>
      <path d="M6 18l9-9 4-4-1 6-8 8z" />
      <path d="M6 18l-1 1" />
    </>
  ),
  axe: (
    <>
      <path d="M7 21l6-12" />
      <path d="M11 5c3-1 6 0 7 3-2 2-5 2-7 1z" />
    </>
  ),
  polearm: (
    <>
      <path d="M5 21L18 5" />
      <path d="M18 5l1-2 1 1-1 2zM16 8l3 1" />
    </>
  ),
  bow: (
    <>
      <path d="M7 3a13 13 0 0 1 0 18" />
      <path d="M7 3l13 9-13 0" />
      <path d="M4 12h13" />
    </>
  ),
  wand: (
    <>
      <path d="M5 19L17 7" />
      <path d="M16 4l1.5 1.5M20 8l-1.5-1.5M17 5.5l1.5 1.5" />
    </>
  ),
  // — slot kinds —
  shield: <path d="M12 3l7 2v6c0 4-3 7-7 9-4-2-7-5-7-9V5z" />,
  armor: (
    <>
      <path d="M8 4l4 2 4-2 3 3-3 2v9H8v-9L5 7z" />
    </>
  ),
  headgear: (
    <>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M3 14h18" />
    </>
  ),
  accessory: (
    <>
      <circle cx="12" cy="14" r="5" />
      <path d="M9 6l3-3 3 3" />
    </>
  ),
  'hand-empty': (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M7 17L17 7" />
    </>
  ),
  // — ability sections —
  'command-set': (
    <>
      <rect x="4" y="5" width="11" height="14" rx="1" />
      <path d="M9 5l6-1 5 12-3 1" />
    </>
  ),
  reaction: <path d="M20 11A8 8 0 1 0 18 17M20 6v5h-5" />,
  support: <path d="M12 3l7 2v6c0 4-3 7-7 9-4-2-7-5-7-9V5z" />,
  movement: (
    <>
      <path d="M6 20l5-14 2 8 3-3 2 9" />
    </>
  ),
  // — ui —
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  check: <path d="M5 12l5 5 9-11" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4 4" />
    </>
  ),
  sort: <path d="M7 4v16M7 20l-3-3M7 20l3-3M14 6h6M14 12h4M14 18h2" />,
  back: <path d="M14 6l-6 6 6 6" />,
};

const WEAPON_TYPE_ICON: Record<WeaponType, IconName> = {
  sword: 'sword',
  knife: 'knife',
  knight_sword: 'sword',
  axe: 'axe',
  polearm: 'polearm',
  bow: 'bow',
  wand: 'wand',
  staff: 'wand',
};

export function weaponTypeIcon(type: WeaponType | undefined): IconName {
  return (type !== undefined ? WEAPON_TYPE_ICON[type] : undefined) ?? 'sword';
}

export interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly style?: React.CSSProperties;
}

export function Icon({ name, size = 16, style }: IconProps): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}
