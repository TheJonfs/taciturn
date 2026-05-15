// Variant D — The Compiled Notes.
//
// The conceit, flipped: not a published handbook but a diligent cadet's
// compilation of a scattered instructor's lecture notes. Two voices —
// the student's tidy "fair copy" (EB Garamond) and the professor's
// margin scribbles (Caveat, in correcting-ink red and a faded blue).
// The portrait is pasted in askew; the stat block is jotted then boxed.
// Palette: note-paper, graphite, correcting red, faded blue.

import type { SpreadContext } from '../build/spread-context.ts';
import type { AbilityFacts } from '../build/ability-format.ts';
import { renderProse } from '../build/markdown.ts';
import { esc, join } from './html.ts';

function factsLine(f: AbilityFacts): string {
  const parts: string[] = [];
  if (f.kind === 'active') {
    if (f.mpCost !== undefined && f.mpCost > 0) parts.push(`${f.mpCost} MP`);
    if (f.range) parts.push(f.range);
    for (const effect of f.effects) parts.push(effect);
    if (f.rollsToHit) parts.push('to-hit');
  } else if (f.trigger) {
    parts.push(f.trigger);
  }
  return parts.join(' · ');
}

function statBox(ctx: SpreadContext): string {
  const { stats, cls } = ctx;
  const ev = cls.evasion;
  const lines: Array<[string, string]> = [
    ['HP', String(stats.maxHpBase)],
    ['MP', String(stats.maxMpBase)],
    ['PA', String(stats.pa)],
    ['MA', String(stats.ma)],
    ['Speed', String(stats.spd)],
    ['Move', String(cls.movement.moveRange)],
    ['Jump', String(cls.movement.jump)],
    ['Evasion (F/S/B)', `${ev.front}/${ev.side}/${ev.back}`],
    ['Resistances', 'none'],
  ];
  return `
    <div class="v-d__statbox">
      <p class="v-d__statbox-label">baseline stats &mdash; L25</p>
      <dl class="v-d__statlines">
        ${join(
          lines.map(
            ([label, value]) =>
              `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`,
          ),
        )}
      </dl>
    </div>`;
}

function abilityLine(ctx: SpreadContext, id: string, name: string): string {
  const f = ctx.facts.get(id);
  if (!f) return '';
  const note = ctx.prose.abilityNotes[id]?.compact ?? '';
  return `
    <li class="v-d__ability">
      <span class="v-d__ability-name">${esc(name)}</span>
      <span class="v-d__ability-facts">${esc(factsLine(f))}</span>
      <span class="v-d__ability-note">${esc(note)}</span>
    </li>`;
}

function marginNote(text: string, tone: 'red' | 'blue'): string {
  return `<p class="v-d__margin v-d__margin--${tone}">${esc(text)}</p>`;
}

export function variantD(ctx: SpreadContext): string {
  const { prose, abilities } = ctx;
  const margins = prose.marginalia ?? [];

  const actives = join(
    abilities.actives.map((a) => abilityLine(ctx, a.id, a.name)),
  );
  const passives = join(
    abilities.passives.map((p) => abilityLine(ctx, p.id, p.name)),
  );

  return `
    <section class="spread v-d">
      <div class="spread__verso v-d__verso">
        <p class="v-d__runner">Variant D — The Compiled Notes</p>
        <header class="v-d__head">
          <h1 class="v-d__title">Knight</h1>
          <p class="v-d__subtitle">specialization notes &mdash; compiled from the lectures</p>
        </header>

        <div class="v-d__toprow">
          <figure class="v-d__pasted">
            <img src="${esc(ctx.portraitUrl)}" alt="The Knight" />
            <figcaption>fig. 1 &mdash; the Knight, full kit</figcaption>
          </figure>
          <div class="v-d__topright">
            ${statBox(ctx)}
            ${margins[0] !== undefined ? marginNote(margins[0], 'red') : ''}
          </div>
        </div>

        <div class="v-d__faircopy">
          ${renderProse(prose.brief)}
        </div>
        ${margins[1] !== undefined ? marginNote(margins[1], 'blue') : ''}
      </div>

      <div class="spread__recto v-d__recto">
        <div class="v-d__column">
          <h2 class="v-d__rep-head">The Repertoire</h2>
          <p class="v-d__grouplabel">active skills</p>
          <ul class="v-d__abilities">${actives}</ul>
          <p class="v-d__grouplabel">passive bearing</p>
          <ul class="v-d__abilities">${passives}</ul>

          <div class="v-d__strategy">
            <h3 class="v-d__strategy-head">&mdash; and the whole of it</h3>
            ${renderProse(prose.strategy)}
          </div>
        </div>
        <aside class="v-d__rail">
          <div class="v-d__seal">${ctx.sealSvg}</div>
          ${join(margins.slice(2).map((m, i) => marginNote(m, i % 2 === 0 ? 'red' : 'blue')))}
        </aside>
      </div>
    </section>`;
}
