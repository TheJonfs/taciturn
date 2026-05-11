// Renderer constants. Centralized so a single edit re-tunes the visual
// feel; nothing on the renderer reaches past these for dimensions or
// timings. v1 only — colors are flat fills until texture authoring lands.

import { teamId, type TeamId } from '@engine/index.ts';

// Pixel size of one tile on the world plane (orthographic top-down).
export const TILE_SIZE = 48;

// Half-step inset for drawing inside a tile cell so the unit and tile
// don't share borders.
export const TILE_INSET = 4;

// Solid background fill (renderer's clear color).
export const BACKGROUND_COLOR = 0x14171c;

// Terrain palette. v1 ships only `'ground'`; new terrains added by
// content extend this map (default fallback is a debug magenta so a
// missing entry is loud).
export const TERRAIN_COLORS: Readonly<Record<string, number>> = {
  ground: 0x4a5b3c,
  water: 0x274c70,
  wall: 0x3b3c41,
};

export const TERRAIN_FALLBACK_COLOR = 0xff00ff;

// Outline color for tiles. A subtle grid line so units are easier to
// place visually.
export const TILE_OUTLINE_COLOR = 0x000000;
export const TILE_OUTLINE_ALPHA = 0.18;

// Portrait restructure (session 26.5 / item #2). Replaces the prior
// inscribed-circle layout (colored body + team ring at body edge) with
// a black-square portrait backdrop + colored team ring as a rounded-
// square frame *outside* the portrait. Resolves the corner-overflow
// clipping issue flagged in session 24.5's handoff.
export const PORTRAIT_BG_COLOR = 0x000000;
export const PORTRAIT_FRAME_WIDTH = 3;
// Frame corner radius for the rounded-square team ring. Chris's call:
// rounded-square — softer than a perfect square, more "framed picture"
// than a circle.
export const PORTRAIT_FRAME_CORNER = 4;

// Team colors for the unit layer. Hardcoded by id rather than read from
// data — `Team` doesn't carry visual style today, and shoehorning it in
// would mix UI concerns into engine types. The renderer owns visuals.
export const TEAM_COLORS: ReadonlyMap<TeamId, number> = new Map([
  [teamId('team_a'), 0x4a90e2], // blue
  [teamId('team_b'), 0xd0533d], // red
]);
export const TEAM_COLOR_FALLBACK = 0xaaaaaa;

// KO'd units render as a flat gray circle.
export const KO_COLOR = 0x55585d;

// Outline + facing-tick details on unit sprites.
export const UNIT_OUTLINE_COLOR = 0x000000;
export const UNIT_OUTLINE_ALPHA = 0.6;
export const FACING_TICK_COLOR = 0xf6e5a8;
export const FACING_TICK_LENGTH = 0.55; // fraction of unit radius

// HP bar (small under-circle bar). Just enough so visible HP loss
// reads while damage numbers are pending UI work.
//
// Three-tier color coding per session 24.5 designer call:
//   HP > 75%        → green
//   33% < HP ≤ 75%  → yellow
//   HP ≤ 33%        → red
export const HP_BAR_BG = 0x000000;
export const HP_BAR_FG = 0x6dc66d;       // green (HP > 75%)
export const HP_BAR_FG_MID = 0xe6c757;   // yellow (33% < HP ≤ 75%)
export const HP_BAR_FG_LOW = 0xd0533d;   // red (HP ≤ 33%)
export const HP_BAR_HIGH_THRESHOLD = 0.75;
export const HP_BAR_LOW_THRESHOLD = 0.33;

// MP bar (slim, sits below the HP bar). Blue to distinguish from HP.
// No "low MP" threshold — MP draining isn't the same kind of event as
// being near-death.
export const MP_BAR_FG = 0x4a90e2;

// Status-badge palette. Placeholders — final iconography is later.
// Polarity-coded fills with a glyph letter; stack count badge in the
// corner for stacking statuses (Burn especially).
export const STATUS_BADGE_BG_NEGATIVE = 0xa83838;
export const STATUS_BADGE_BG_POSITIVE = 0x6dc66d;
export const STATUS_BADGE_BG_NEUTRAL = 0xa6a892;
export const STATUS_BADGE_TEXT = 0x14171c;
export const STATUS_BADGE_STACK_BG = 0x14171c;
export const STATUS_BADGE_STACK_TEXT = 0xf6e5a8;

// KO'd unit transparency. Per the design doc, KO'd units stay on the
// map as grayed/translucent tokens (revival mechanics + 3-turn
// permadeath timer + tactical visibility). v1 also draws an "X"
// overlay across the unit body so the KO reads more clearly than
// translucency alone (per playtest feedback 2026-05-10).
export const KO_ALPHA = 0.4;

// Cross-out X drawn over a KO'd unit so the "this unit is down"
// signal reads at a glance.
export const KO_X_COLOR = 0xe67865;
export const KO_X_WIDTH = 3;
export const KO_X_ALPHA = 0.9;

// Active-unit highlight ring color.
export const ACTIVE_HIGHLIGHT_COLOR = 0xf6e5a8;

// Hover-counterpart ring color — draws around a unit when the player
// hovers an action log row referencing them. Bright cyan so it pops
// against both team colors without competing with the gold active ring.
export const COUNTERPART_RING_COLOR = 0x9adfff;

// Tile-overlay highlight palette (HighlightLayer). One color per UI
// selection kind.
//
// Session 26.5 polish: brighter / more saturated fills than the prior
// muted palette, paired with a stroked outline on each highlighted tile
// (HIGHLIGHT_STROKE_ALPHA). The stroke gives a hard edge that reads
// against any terrain, including the new grass texture (ADR-0054) that
// previously muddied the muted-red attack highlight.
export const HIGHLIGHT_COLORS: Readonly<Record<'move' | 'attack' | 'heal' | 'aoe', number>> = {
  move: 0x4a90e2,   // blue — reachable destinations
  attack: 0xff5252, // saturated red — valid attack targets
  heal: 0x4ade80,   // saturated lime — valid heal targets
  aoe: 0xf6e5a8,    // gold — area-of-effect preview
};
export const HIGHLIGHT_ALPHA = 0.45;
// Stroke outline drawn around each highlighted tile. Higher alpha than
// the fill so the edge reads even when the fill blends with terrain.
export const HIGHLIGHT_STROKE_ALPHA = 0.9;
export const HIGHLIGHT_STROKE_WIDTH = 2;

// Overlay-channel alpha (AoE preview / hovered target). Slightly higher
// than the base channel so the overlay reads as "on top of" the legal-
// target set.
export const HIGHLIGHT_OVERLAY_ALPHA = 0.6;

// Hit flash color shown on a target when struck.
export const HIT_FLASH_COLOR = 0xffe1a0;

// Animation durations, in milliseconds. Linear tweens for v1; easing
// belongs to a polish pass.
export const MOVE_STEP_DURATION_MS = 220; // per tile of path
export const ATTACK_FLASH_DURATION_MS = 360;
// Charged-action resolves play with a longer dwell + a pre-resolve tile
// highlight so the cast reads as a discrete event (session 26.5 / item
// #5). Pre-26.5 they flashed at the regular attack duration and felt
// indistinguishable from a normal cast.
export const PRE_RESOLVE_HIGHLIGHT_MS = 400;
export const CHARGED_RESOLVE_FLASH_DURATION_MS = 720;
export const TURN_START_PAUSE_MS = 240;
export const TURN_END_PAUSE_MS = 140;
export const BATTLE_END_HOLD_MS = 600;

// Camera lerp factor per frame (0..1). Higher = snappier camera.
export const CAMERA_LERP = 0.15;
