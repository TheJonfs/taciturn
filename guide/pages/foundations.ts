// Foundations of Battle — the combat-theory chapter. Hand-authored
// conceptual prose, interleaved with diagrams and data callouts built
// from the imported ruleset.

import { renderProse, renderInline } from '../build/markdown.ts';
import { foundationsIntro, foundationsSections } from '../content/foundations/index.ts';
import { defaultRuleset } from '../build/data.ts';
import { ctMeterDiagram, elementalWheelDiagram } from '../build/diagrams.ts';
import { esc, join } from './html.ts';

const BUCKET_LABELS: Record<string, string> = {
  first_action: 'First Action',
  secondary_command_sets: 'Secondary',
  reaction: 'Reaction',
  support: 'Support',
  movement: 'Movement',
};

// The action-structure diagram: the five buckets and their capacities,
// straight from the ruleset.
function bucketDiagram(): string {
  const caps = defaultRuleset().bucketCapacities;
  const boxes = [...caps.entries()]
    .map(([bucket, capacity]) => {
      const label = BUCKET_LABELS[String(bucket)] ?? String(bucket);
      return `
      <div class="bucket">
        <span class="bucket__name">${esc(label)}</span>
        <span class="bucket__cap">${capacity}</span>
        <span class="bucket__cap-label">capacity</span>
      </div>`;
    })
    .join('');
  return `
    <figure class="foundations-fig foundations-fig--buckets">
      <div class="bucket-row">${boxes}</div>
      <figcaption>The five buckets of a turn, with the room each holds.</figcaption>
    </figure>`;
}

// The terrain-cost callout, from the ruleset's pathfinding defaults.
function terrainCallout(): string {
  const pf = defaultRuleset().pathfinding;
  const rows: Array<[string, number]> = [
    ['Open ground', pf.defaultStepCost],
    ...[...pf.defaultTerrainCosts.entries()].map(
      ([terrain, cost]): [string, number] => [
        terrain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        cost,
      ],
    ),
  ];
  const cells = rows
    .map(
      ([label, cost]) =>
        `<div class="terrain-cell"><span class="terrain-cell__label">${esc(label)}</span><span class="terrain-cell__cost">${cost}</span></div>`,
    )
    .join('');
  return `
    <figure class="foundations-fig foundations-fig--terrain">
      <div class="terrain-row">${cells}</div>
      <figcaption>Movement cost per tile, by terrain.</figcaption>
    </figure>`;
}

function diagramFor(key: string): string {
  switch (key) {
    case 'charge-time':
      return `
        <figure class="foundations-fig foundations-fig--ct">
          ${ctMeterDiagram()}
          <figcaption>What each turn-choice spends of the clock it has just filled.</figcaption>
        </figure>`;
    case 'actions':
      return bucketDiagram();
    case 'elements':
      return `
        <figure class="foundations-fig foundations-fig--wheel">
          ${elementalWheelDiagram()}
          <figcaption>The wheel runs one way: each discipline strikes heavy against the next, and yields to the one before.</figcaption>
        </figure>`;
    case 'terrain':
      return terrainCallout();
    default:
      return '';
  }
}

export function foundations(): string {
  const sections = foundationsSections
    .map(
      (s) => `
      <section class="foundations-section">
        <h2 class="foundations-section__title">${renderInline(s.title)}</h2>
        <div class="foundations-section__body">${renderProse(s.body)}</div>
        ${diagramFor(s.key)}
      </section>`,
    )
    .join('');

  return `
    <section class="foundations" id="ch-foundations">
      <header class="foundations__masthead">
        <h1 class="foundations__title">Foundations of Battle</h1>
        <div class="foundations__intro">${renderProse(foundationsIntro)}</div>
      </header>
      ${sections}
    </section>`;
}
