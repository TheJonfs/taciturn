// Foundations diagrams — SVG generators built from imported ruleset
// data, so they stay current with the game. The prose in
// content/foundations explains the concepts; these carry the numbers.

import { defaultRuleset, elementalWheel } from './data.ts';
import type { BattleMap } from '@engine/index.ts';

// Element accent colours — kept in step with styles/variant-e.css.
const ELEMENT_COLORS: Record<string, string> = {
  fire: '#9a3a22',
  earth: '#516b30',
  lightning: '#5b3a78',
  water: '#2f6173',
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The Charge Time meter — a 0→100 track with the four turn-choices
 * marked at the CT each one spends. Wait and Defend share a cost, so
 * they share a tick.
 */
export function ctMeterDiagram(): string {
  const ct = defaultRuleset().ctCosts;
  // Distinct (cost → label) marks, lightest commitment first.
  const marks: Array<{ cost: number; label: string }> = [
    { cost: ct.wait, label: ct.wait === ct.defend ? 'Wait / Defend' : 'Wait' },
    { cost: ct.moveOnly, label: 'Move only' },
    { cost: ct.actOnly, label: 'Act only' },
    { cost: ct.moveAndAct, label: 'Move + Act' },
  ];

  const x0 = 46;
  const x1 = 586;
  const span = x1 - x0;
  const baseY = 86;
  const px = (cost: number) => x0 + (cost / 100) * span;

  const ticks = marks
    .map((m, i) => {
      const x = px(m.cost);
      const labelY = i % 2 === 0 ? 40 : 26;
      const lineTop = labelY + 6;
      return `
      <line x1="${x}" y1="${lineTop}" x2="${x}" y2="${baseY}" stroke="#6e2b2b" stroke-width="1" />
      <circle cx="${x}" cy="${baseY}" r="3.4" fill="#6e2b2b" />
      <text x="${x}" y="${labelY}" text-anchor="middle" class="d-label">${m.label}</text>
      <text x="${x}" y="${baseY + 22}" text-anchor="middle" class="d-num">${m.cost}</text>`;
    })
    .join('');

  return `
  <svg viewBox="0 0 632 120" class="diagram diagram--ct" role="img"
       aria-label="Charge Time meter: the CT each turn-choice spends">
    <defs>
      <linearGradient id="ct-track" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#e7d9ba" />
        <stop offset="1" stop-color="#6e2b2b" stop-opacity="0.55" />
      </linearGradient>
    </defs>
    <rect x="${x0}" y="${baseY - 7}" width="${span}" height="14" rx="2"
          fill="url(#ct-track)" stroke="#6e2b2b" stroke-width="0.8" />
    <text x="${x0}" y="${baseY + 22}" text-anchor="middle" class="d-num">0</text>
    <text x="${x0 - 8}" y="${baseY + 4}" text-anchor="end" class="d-axis">CT</text>
    ${ticks}
  </svg>`;
}

/**
 * Top-down render of a battle map — each tile coloured by elevation
 * (water blues for elev 0–1, earthy tans grading darker as the land
 * rises), with a translucent overlay on the team deployment zones.
 * The grid, the colours, and the zones are all read from the map; if
 * the map changes, the render changes.
 */
export function mapDiagram(map: BattleMap): string {
  const tile = 26;
  const margin = 22;
  const w = map.width * tile;
  const h = map.height * tile;
  const totalW = w + margin * 2;
  const totalH = h + margin * 2;

  const tileColor = (t: { elevation: number; terrain?: unknown }): string => {
    // Rampart (S47, Stonebridge keep walls) reads as stone, not as
    // another elevation tier — distinct from natural ground at the same
    // height so the keep's architecture is visible at a glance.
    if (String(t.terrain) === 'rampart') return '#7d756a';
    const elev = t.elevation;
    if (elev === 0) return '#234a55';
    if (elev === 1) return '#5a8c95';
    // Land elevations 2–9 grade lightest → darkest with rising ground.
    const land = [
      '#c9b88a', // 2 — base
      '#bba775', // 3
      '#ad9760', // 4
      '#9e864c', // 5
      '#8e7639', // 6
      '#7e6629', // 7
      '#6c581d', // 8
      '#594814', // 9
    ];
    const i = Math.max(0, Math.min(land.length - 1, elev - 2));
    return land[i] ?? land[0]!;
  };

  const zoneFill = (zone: string | undefined): string | undefined => {
    if (zone === 'team_a') return 'rgba(60, 90, 130, 0.34)';
    if (zone === 'team_b') return 'rgba(150, 60, 60, 0.34)';
    return undefined;
  };

  // Tiles
  const tiles: string[] = [];
  for (const t of map.tiles) {
    const x = margin + t.x * tile;
    const y = margin + t.y * tile;
    tiles.push(
      `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" fill="${tileColor(t)}" stroke="#3a3024" stroke-width="0.4" stroke-opacity="0.4" />`,
    );
    const zf = zoneFill(t.deploymentZone as string | undefined);
    if (zf) {
      tiles.push(
        `<rect x="${x}" y="${y}" width="${tile}" height="${tile}" fill="${zf}" />`,
      );
    }
  }

  // Coordinate labels along top and left edges
  const xLabels: string[] = [];
  for (let x = 0; x < map.width; x++) {
    const cx = margin + x * tile + tile / 2;
    xLabels.push(
      `<text x="${cx}" y="${margin - 6}" text-anchor="middle" class="d-coord">${x}</text>`,
    );
  }
  const yLabels: string[] = [];
  for (let y = 0; y < map.height; y++) {
    const cy = margin + y * tile + tile / 2 + 3;
    yLabels.push(
      `<text x="${margin - 6}" y="${cy}" text-anchor="end" class="d-coord">${y}</text>`,
    );
  }

  // North marker (engine y=0 is top of grid; Blue zone is at y=0–2,
  // so Blue is "north" by canvas convention).
  const north = `
    <g class="d-north">
      <text x="${margin / 2 + 2}" y="${margin / 2 + 4}" class="d-coord">N</text>
      <path d="M ${margin / 2 + 11} ${margin / 2 - 1} l 3 8 l -3 -2 l -3 2 z"
            fill="#6e2b2b" />
    </g>`;

  // Outer frame around the grid
  const frame = `<rect x="${margin}" y="${margin}" width="${w}" height="${h}"
    fill="none" stroke="#2b2620" stroke-width="1.4" />`;

  return `
  <svg viewBox="0 0 ${totalW} ${totalH}" class="diagram diagram--map" role="img"
       aria-label="Battlefield map: a ${map.width}×${map.height} grid; team deployment zones tinted blue (north) and red (south)">
    ${tiles.join('')}
    ${frame}
    ${xLabels.join('')}
    ${yLabels.join('')}
    ${north}
  </svg>`;
}

/**
 * The elemental wheel — four discs on a directed ring. The ring runs
 * the "beats" cycle: each element strikes heavy against the next one
 * round, and yields to the one before it.
 */
export function elementalWheelDiagram(): string {
  const spokes = elementalWheel();
  const cx = 170;
  const cy = 170;
  const ringR = 110;
  const discR = 42;

  // Discs at the four array positions, clockwise from the top.
  const discs = spokes
    .map((spoke, i) => {
      const angle = (i / spokes.length) * 2 * Math.PI; // 0 = top, clockwise
      const x = cx + ringR * Math.sin(angle);
      const y = cy - ringR * Math.cos(angle);
      const color = ELEMENT_COLORS[spoke.element] ?? '#2b2620';
      return `
      <circle cx="${x}" cy="${y}" r="${discR}" fill="${color}" />
      <circle cx="${x}" cy="${y}" r="${discR}" fill="none" stroke="#2b2620" stroke-width="1" stroke-opacity="0.4" />
      <text x="${x}" y="${y - 4}" text-anchor="middle" class="d-elem">${titleCase(spoke.element)}</text>
      <text x="${x}" y="${y + 11}" text-anchor="middle" class="d-elem-class">${spoke.className}</text>`;
    })
    .join('');

  // Directional arrowheads at the midpoints between discs (clockwise).
  const arrows = spokes
    .map((_, i) => {
      const midAngle = ((i + 0.5) / spokes.length) * 2 * Math.PI;
      const x = cx + ringR * Math.sin(midAngle);
      const y = cy - ringR * Math.cos(midAngle);
      const deg = (midAngle * 180) / Math.PI; // triangle base points +x → rotate by deg
      return `
      <path d="M-7,-6 L9,0 L-7,6 Z" fill="#6e2b2b"
            transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${deg.toFixed(1)})" />`;
    })
    .join('');

  return `
  <svg viewBox="0 0 340 340" class="diagram diagram--wheel" role="img"
       aria-label="The elemental wheel: each discipline strikes heavy against the next round the ring">
    <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none"
            stroke="#6e2b2b" stroke-width="1.4" stroke-opacity="0.55" />
    ${arrows}
    ${discs}
  </svg>`;
}
