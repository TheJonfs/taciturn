// Training-field chapter — renders one field per call.
//
// The map render is data-driven (build/diagrams.mapDiagram); the prose
// and the legend swatches are authored per field (content/training-
// fields/*.ts). The compose layer iterates `TRAINING_FIELDS` and calls
// `trainingField(entry)` once per field.

import type { BattleMap } from '@engine/index.ts';
import { mapDiagram } from '../build/diagrams.ts';
import { renderProse } from '../build/markdown.ts';
import type {
  FieldProse,
  FieldSection,
  FieldLegendSwatch,
} from '../content/training-fields/river-ridge.ts';
import { TRAINING_FIELDS } from '../build/training-fields.ts';
import { esc, join } from './html.ts';

function sectionBlock(s: FieldSection): string {
  return `
    <section class="field-section">
      <h3 class="field-section__title">${esc(s.title)}</h3>
      <div class="field-section__body">${renderProse(s.body)}</div>
    </section>`;
}

function mapLegend(swatches: ReadonlyArray<FieldLegendSwatch>): string {
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

/** Render one training-field chapter from its (prose, map) pair. */
export function trainingField(prose: FieldProse, map: BattleMap): string {
  const terrain = join(prose.terrainSections.map(sectionBlock));
  const zones = join(prose.zoneSections.map(sectionBlock));

  return `
    <section class="field" id="ch-${esc(prose.id)}">
      <header class="field__masthead">
        <p class="field__eyebrow">Training Exercise</p>
        <h1 class="field__title">${esc(prose.title)}</h1>
        <p class="field__subtitle">${esc(prose.subtitle)}</p>
      </header>

      <div class="field__intro">${renderProse(prose.intro)}</div>

      <figure class="field__map">
        ${mapDiagram(map)}
        <figcaption>The Academy&rsquo;s standing render of ${esc(prose.title)} &mdash; north at the top.</figcaption>
      </figure>

      ${mapLegend(prose.legend)}

      <h2 class="field__heading">The Terrain</h2>
      ${terrain}

      <h2 class="field__heading">The Tactical Zones</h2>
      ${zones}

      <h2 class="field__heading">Knockback &amp; the Falls</h2>
      <div class="field-prose">${renderProse(prose.knockback)}</div>

      <aside class="field__counsel">
        <h3 class="field__counsel-head">The Instructor&rsquo;s Counsel</h3>
        ${renderProse(prose.counsel)}
      </aside>
    </section>`;
}

/** Render all training fields, in handbook order. Used by composeHandbook. */
export function allTrainingFields(): string {
  return TRAINING_FIELDS.map((f) => trainingField(f.prose, f.map)).join('\n');
}
