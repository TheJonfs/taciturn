// Variant E — The Settled Spread.
//
// The Phase 3 synthesis, generalised to every class in Phase 4:
// Variant A's bones (masthead, block-per-ability repertoire, counsel),
// Variant B's stat band — now tinted to each class's element — and
// Variant D's margin scribbles, all on a weathered filigree-framed
// page. The repertoire runs two columns to carry the Mages' fuller
// kits. Type: EB Garamond text, Cinzel display, Caveat marginalia.

import type { SpreadContext } from '../build/spread-context.ts';
import type { AbilityFacts } from '../build/ability-format.ts';
import { renderProse, renderInline } from '../build/markdown.ts';
import { esc, join } from './html.ts';

function activeFactsLine(f: AbilityFacts): string {
  // The Active Skills section is, by construction, all First Action
  // abilities; the bucket label would be redundant on every line, so
  // drop it. Passives still surface their bucket (Reaction / Support /
  // Movement) since those distinctions matter on the page.
  const parts: string[] = [];
  if (f.mpCost !== undefined && f.mpCost > 0) parts.push(`${f.mpCost} MP`);
  if (f.range) parts.push(f.range);
  if (f.chargeLabel && f.chargeLabel !== 'Instant') parts.push(f.chargeLabel);
  for (const effect of f.effects) parts.push(effect);
  if (f.rollsToHit) parts.push('rolls to hit');
  return parts.join('  ·  ');
}

function passiveFactsLine(f: AbilityFacts): string {
  const parts: string[] = [f.bucketLabel];
  if (f.trigger) parts.push(f.trigger);
  return parts.join('  ·  ');
}

function abilityBlock(ctx: SpreadContext, id: string, name: string): string {
  const f = ctx.facts.get(id);
  if (!f) return '';
  // Convention: an ability without a hand-authored note is omitted from
  // the spread entirely. The Calculator drops `attack` this way (per
  // S49: the Math Skill picker is the whole story, the universal Attack
  // is a footnote at best, and dropping it frees a "slot" on the recto
  // for the Math Skill intro). Pre-S49 every class authored a note for
  // every ability, so this branch was load-bearing for no one until now.
  const note = ctx.prose.abilityNotes[id]?.full;
  if (note === undefined) return '';
  const line = f.kind === 'active' ? activeFactsLine(f) : passiveFactsLine(f);
  return `
    <div class="v-e__ability">
      <p class="v-e__ability-head">
        <span class="v-e__ability-name">${esc(name)}</span><span
          class="v-e__ability-facts">${esc(line)}</span>
      </p>
      <p class="v-e__ability-note">${renderInline(note)}</p>
    </div>`;
}

/**
 * Optional intro block for the Active Skills column. Renders with the
 * same chrome as an ability block so it lands as a peer of the entries
 * beneath it — the Calculator's Math Skill is the originating consumer.
 * Returns the empty string when the prose declares no `commandSetIntro`,
 * so every other class is unchanged.
 */
function commandSetIntroBlock(ctx: SpreadContext): string {
  const intro = ctx.prose.commandSetIntro;
  if (intro === undefined) return '';
  const factsLine = intro.facts ?? '';
  return `
    <div class="v-e__ability v-e__ability--intro">
      <p class="v-e__ability-head">
        <span class="v-e__ability-name">${esc(intro.name)}</span><span
          class="v-e__ability-facts">${esc(factsLine)}</span>
      </p>
      <p class="v-e__ability-note">${renderInline(intro.full)}</p>
    </div>`;
}

// The horizontal stat band — tinted to the class's element in CSS.
function statBand(ctx: SpreadContext): string {
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
    <div class="v-e__statband">
      ${join(
        cells.map(
          ([label, value]) => `
        <div class="v-e__stat">
          <span class="v-e__stat-num">${esc(value)}</span>
          <span class="v-e__stat-label">${esc(label)}</span>
        </div>`,
        ),
      )}
    </div>`;
}

function marginNote(text: string, tone: 'red' | 'blue'): string {
  return `<p class="v-e__margin v-e__margin--${tone}">${esc(text)}</p>`;
}

function renderSeal(ctx: SpreadContext): string {
  if (ctx.sealPngUrl !== undefined) {
    return `<img class="v-e__seal v-e__seal--img" src="${esc(ctx.sealPngUrl)}" alt="Gariland Magic Academy seal" />`;
  }
  return `<div class="v-e__seal v-e__seal--svg">${ctx.sealSvg}</div>`;
}

export function variantE(ctx: SpreadContext): string {
  const { prose, abilities, cls, element } = ctx;
  const margins = prose.marginalia ?? [];

  const actives = commandSetIntroBlock(ctx) + join(
    abilities.actives.map((a) => abilityBlock(ctx, a.id, a.name)),
  );
  const passives = join(
    abilities.passives.map((p) => abilityBlock(ctx, p.id, p.name)),
  );

  // All the scribbles flank the portrait on the verso — they fill that
  // space and keep the recto clear for a fuller repertoire.
  const versoMargins = join(
    margins.map((m, i) => marginNote(m, i % 2 === 0 ? 'red' : 'blue')),
  );

  return `
    <section class="spread v-e v-e--${esc(element)}" id="ch-${esc(cls.id)}">
      <div class="spread__verso v-e__verso">
        <header class="v-e__masthead">
          <div class="v-e__masthead-text">
            <h1 class="v-e__title">${esc(cls.name)}</h1>
            <p class="v-e__tagline">${esc(prose.tagline)}</p>
          </div>
          ${renderSeal(ctx)}
        </header>

        <div class="v-e__platerow">
          <figure class="v-e__portrait">
            <img src="${esc(ctx.portraitUrl)}" alt="The ${esc(cls.name)}" />
          </figure>
          <aside class="v-e__margins">${versoMargins}</aside>
        </div>

        ${statBand(ctx)}

        <div class="v-e__brief">${renderProse(prose.brief)}</div>
      </div>

      <div class="spread__recto v-e__recto">
        <h2 class="v-e__section">The ${esc(cls.name)}&rsquo;s Repertoire</h2>
        <h3 class="v-e__subsection">Active Skills</h3>
        <div class="v-e__abilities">${actives}</div>
        <h3 class="v-e__subsection">Passive Bearing</h3>
        <div class="v-e__abilities">${passives}</div>

        <aside class="v-e__counsel">
          <h3 class="v-e__counsel-head">The Instructor&rsquo;s Counsel</h3>
          ${renderProse(prose.strategy)}
        </aside>
      </div>
    </section>`;
}
