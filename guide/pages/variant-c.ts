// Variant C — The Annotated Plate.
//
// Heraldic and plate-engraved: the portrait sits centred on the verso
// as an ornately framed plate, flanked by margin annotations on the
// Knight's signature skills, above an engraved stat panel. The recto is
// "the discourse" — brief, full repertoire, counsel — set as a refined
// continuous column. Palette: warm vellum, antique brass. Type: EB
// Garamond text, Cormorant display, Cinzel small-caps labels.
//
// Note: the margin-annotation treatment is the hardest of the four to
// scale cleanly to five classes — flagged for the settle discussion.

import type { SpreadContext } from '../build/spread-context.ts';
import type { AbilityFacts } from '../build/ability-format.ts';
import { renderProse } from '../build/markdown.ts';
import { esc, join } from './html.ts';

// The signature skills the verso plate is annotated with, left / right.
const ANNOTATE_LEFT = ['counter', 'taunt'];
const ANNOTATE_RIGHT = ['stasis_sword', 'damage_reduction'];

function factsLine(f: AbilityFacts): string {
  const parts: string[] = [f.bucketLabel];
  if (f.kind === 'active') {
    if (f.mpCost !== undefined && f.mpCost > 0) parts.push(`${f.mpCost} MP`);
    if (f.range) parts.push(f.range);
    for (const effect of f.effects) parts.push(effect);
    if (f.rollsToHit) parts.push('rolls to hit');
  } else if (f.trigger) {
    parts.push(f.trigger);
  }
  return parts.join(' · ');
}

function nameOf(ctx: SpreadContext, id: string): string {
  const a =
    ctx.abilities.actives.find((x) => x.id === id) ??
    ctx.abilities.passives.find((x) => x.id === id);
  return a?.name ?? id;
}

function annotation(ctx: SpreadContext, id: string): string {
  const note = ctx.prose.abilityNotes[id]?.compact ?? '';
  return `
    <div class="v-c__note">
      <p class="v-c__note-label">${esc(nameOf(ctx, id))}</p>
      <p class="v-c__note-text">${esc(note)}</p>
    </div>`;
}

function statPanel(ctx: SpreadContext): string {
  const { stats, cls } = ctx;
  const ev = cls.evasion;
  const pairs: Array<[string, string]> = [
    ['HP', String(stats.maxHpBase)],
    ['MP', String(stats.maxMpBase)],
    ['Physical Atk', String(stats.pa)],
    ['Magical Atk', String(stats.ma)],
    ['Speed', String(stats.spd)],
    ['Move', String(cls.movement.moveRange)],
    ['Jump', String(cls.movement.jump)],
    ['Evasion', `${ev.front} / ${ev.side} / ${ev.back}`],
  ];
  return `
    <div class="v-c__statpanel">
      <p class="v-c__statcaption">Baseline &mdash; at the L25 reference</p>
      <dl class="v-c__statgrid">
        ${join(
          pairs.map(
            ([label, value]) =>
              `<div class="v-c__statcell"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`,
          ),
        )}
        <div class="v-c__statcell v-c__statcell--wide">
          <dt>Elemental resistances</dt><dd>none</dd>
        </div>
      </dl>
    </div>`;
}

function abilityEntry(ctx: SpreadContext, id: string, name: string): string {
  const f = ctx.facts.get(id);
  if (!f) return '';
  const note = ctx.prose.abilityNotes[id]?.full ?? '';
  return `
    <div class="v-c__entry">
      <p class="v-c__entry-head">
        <span class="v-c__entry-name">${esc(name)}</span>
        <span class="v-c__entry-facts">${esc(factsLine(f))}</span>
      </p>
      <p class="v-c__entry-note">${esc(note)}</p>
    </div>`;
}

export function variantC(ctx: SpreadContext): string {
  const { prose, abilities } = ctx;

  const entries = join(
    [...abilities.actives, ...abilities.passives].map((a) =>
      abilityEntry(ctx, a.id, a.name),
    ),
  );

  return `
    <section class="spread v-c">
      <div class="spread__verso v-c__verso">
        <p class="v-c__runner">Variant C — The Annotated Plate</p>
        <header class="v-c__masthead">
          <div class="v-c__seal">${ctx.sealSvg}</div>
          <h1 class="v-c__title">Knight</h1>
          <p class="v-c__tagline">${esc(prose.tagline)}</p>
        </header>

        <div class="v-c__platerow">
          <aside class="v-c__annotations v-c__annotations--left">
            ${join(ANNOTATE_LEFT.map((id) => annotation(ctx, id)))}
          </aside>
          <figure class="v-c__plate">
            <img src="${esc(ctx.portraitUrl)}" alt="The Knight" />
          </figure>
          <aside class="v-c__annotations v-c__annotations--right">
            ${join(ANNOTATE_RIGHT.map((id) => annotation(ctx, id)))}
          </aside>
        </div>

        ${statPanel(ctx)}

        <div class="v-c__brief">${renderProse(prose.brief)}</div>
      </div>

      <div class="spread__recto v-c__recto">
        <h2 class="v-c__rep-head">The Repertoire</h2>
        ${entries}

        <div class="v-c__counsel">
          <h3 class="v-c__counsel-head">The Instructor&rsquo;s Counsel</h3>
          ${renderProse(prose.strategy)}
        </div>
      </div>
    </section>`;
}
