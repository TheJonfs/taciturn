// Training-field chapter — River Ridge in v1, structured to extend
// to additional fields without further machinery.
//
// Map render is data-driven (build/diagrams.mapDiagram); the prose
// is hand-authored (content/training-fields/river-ridge.ts).

import { riverRidgeMap } from '../build/data.ts';
import { mapDiagram } from '../build/diagrams.ts';
import { renderProse } from '../build/markdown.ts';
import { riverRidgeProse } from '../content/training-fields/river-ridge.ts';
import type { FieldSection } from '../content/training-fields/river-ridge.ts';
import { esc, join } from './html.ts';

function sectionBlock(s: FieldSection): string {
  return `
    <section class="field-section">
      <h3 class="field-section__title">${esc(s.title)}</h3>
      <div class="field-section__body">${renderProse(s.body)}</div>
    </section>`;
}

function mapLegend(): string {
  // Six representative tiers (deep, shallow, plain, low ridge, high
  // ridge, peak). Order of swatches follows the map's elevation grade.
  const swatches: Array<[string, string]> = [
    ['#234a55', 'deep water'],
    ['#5a8c95', 'shallow water'],
    ['#c9b88a', 'plain (elev 2)'],
    ['#9e864c', 'rising ridge (5)'],
    ['#7e6629', 'central jump (7)'],
    ['#594814', 'high perch (9)'],
  ];
  const cells = swatches
    .map(
      ([color, label]) => `
      <div class="legend-cell">
        <span class="legend-cell__sw" style="background:${color}"></span>
        <span class="legend-cell__label">${esc(label)}</span>
      </div>`,
    )
    .join('');
  return `
    <div class="field-legend">
      <div class="field-legend__row">${cells}</div>
      <div class="field-legend__zones">
        <span class="zone-swatch zone-swatch--blue"></span>
        Blue deployment (north)
        <span class="zone-swatch zone-swatch--red"></span>
        Red deployment (south)
      </div>
    </div>`;
}

export function trainingField(): string {
  const p = riverRidgeProse;
  const terrain = join(p.terrainSections.map(sectionBlock));
  const zones = join(p.zoneSections.map(sectionBlock));

  return `
    <section class="field" id="ch-river-ridge">
      <header class="field__masthead">
        <p class="field__eyebrow">Training Exercise</p>
        <h1 class="field__title">${esc(p.title)}</h1>
        <p class="field__subtitle">${esc(p.subtitle)}</p>
      </header>

      <div class="field__intro">${renderProse(p.intro)}</div>

      <figure class="field__map">
        ${mapDiagram(riverRidgeMap())}
        <figcaption>The Academy&rsquo;s standing render of River Ridge — north at the top.</figcaption>
      </figure>

      ${mapLegend()}

      <h2 class="field__heading">The Terrain</h2>
      ${terrain}

      <h2 class="field__heading">The Tactical Zones</h2>
      ${zones}

      <h2 class="field__heading">Knockback &amp; the Falls</h2>
      <div class="field-prose">${renderProse(p.knockback)}</div>

      <aside class="field__counsel">
        <h3 class="field__counsel-head">The Instructor&rsquo;s Counsel</h3>
        ${renderProse(p.counsel)}
      </aside>
    </section>`;
}
