// Variant B — The Field Brief.
//
// Magazine-leaning, in the Nintendo-Power register: a dominant portrait
// hero with the title overlaid, a bold horizontal stat band, and a
// brisk recto of compact ability rows closing on a pulled callout.
// Palette: cool paper, House-Beoulve steel-blue, a warm rust highlight.
// Type: Spectral text, Cormorant display.

import type { SpreadContext } from '../build/spread-context.ts';
import type { AbilityFacts } from '../build/ability-format.ts';
import { renderProse } from '../build/markdown.ts';
import { esc, join } from './html.ts';

function factsLine(f: AbilityFacts): string {
  const parts: string[] = [];
  if (f.kind === 'active') {
    if (f.mpCost !== undefined && f.mpCost > 0) parts.push(`${f.mpCost} MP`);
    if (f.range) parts.push(f.range);
    if (f.chargeLabel && f.chargeLabel !== 'Instant') parts.push(f.chargeLabel);
    for (const effect of f.effects) parts.push(effect);
    if (f.rollsToHit) parts.push('to-hit roll');
  } else if (f.trigger) {
    parts.push(f.trigger);
  }
  return parts.join(' · ');
}

function statband(ctx: SpreadContext): string {
  const { stats, cls } = ctx;
  const ev = cls.evasion;
  const cells: Array<[string, string]> = [
    ['HP', String(stats.maxHpBase)],
    ['MP', String(stats.maxMpBase)],
    ['PA', String(stats.pa)],
    ['MA', String(stats.ma)],
    ['SPD', String(stats.spd)],
    ['MOVE', String(cls.movement.moveRange)],
    ['JUMP', String(cls.movement.jump)],
    ['EVA', `${ev.front}·${ev.side}·${ev.back}`],
  ];
  return `
    <div class="v-b__statband">
      ${join(
        cells.map(
          ([label, value]) => `
        <div class="v-b__stat">
          <span class="v-b__stat-num">${esc(value)}</span>
          <span class="v-b__stat-label">${esc(label)}</span>
        </div>`,
        ),
      )}
      <div class="v-b__statseal">${ctx.sealSvg}</div>
    </div>`;
}

function abilityRow(ctx: SpreadContext, id: string, name: string): string {
  const f = ctx.facts.get(id);
  if (!f) return '';
  const note = ctx.prose.abilityNotes[id]?.compact ?? '';
  return `
    <div class="v-b__ability">
      <p class="v-b__ability-line">
        <span class="v-b__ability-name">${esc(name)}</span>
        <span class="v-b__ability-facts">${esc(factsLine(f))}</span>
      </p>
      <p class="v-b__ability-note">${esc(note)}</p>
    </div>`;
}

export function variantB(ctx: SpreadContext): string {
  const { prose, abilities } = ctx;

  const actives = join(
    abilities.actives.map((a) => abilityRow(ctx, a.id, a.name)),
  );
  const passives = join(
    abilities.passives.map((p) => abilityRow(ctx, p.id, p.name)),
  );

  return `
    <section class="spread v-b">
      <div class="spread__verso v-b__verso">
        <p class="v-b__runner">Variant B — The Field Brief</p>
        <div class="v-b__hero">
          <img class="v-b__portrait" src="${esc(ctx.portraitUrl)}" alt="The Knight" />
          <div class="v-b__masthead">
            <p class="v-b__eyebrow">Specialization Brief</p>
            <h1 class="v-b__title">Knight</h1>
            <p class="v-b__tagline">${esc(prose.tagline)}</p>
          </div>
        </div>
        ${statband(ctx)}
      </div>

      <div class="spread__recto v-b__recto">
        <div class="v-b__brief">${renderProse(prose.brief)}</div>

        <div class="v-b__sectionhead">
          <h2>The Repertoire</h2>
        </div>
        <p class="v-b__grouplabel">Active Skills</p>
        ${actives}
        <p class="v-b__grouplabel">Passive Bearing</p>
        ${passives}

        <aside class="v-b__callout">
          <p class="v-b__callout-label">From the Instructor</p>
          ${renderProse(prose.strategy)}
        </aside>
      </div>
    </section>`;
}
