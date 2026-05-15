// Variant A — The Institutional Manual.
//
// Restrained, classical — the register of a university course catalogue
// or a Gygax-era manual. Verso: masthead, then the portrait plate beside
// a ruled stat block, then the instructor's brief. Recto: the repertoire
// as full block-per-ability entries, closing on the instructor's counsel
// in a ruled box. Palette: aged paper, deep ink, one oxblood accent.
// Type: EB Garamond text, Cinzel display.

import type { SpreadContext } from '../build/spread-context.ts';
import type { AbilityFacts } from '../build/ability-format.ts';
import { renderProse } from '../build/markdown.ts';
import { esc, join } from './html.ts';

function activeFactsLine(f: AbilityFacts): string {
  const parts: string[] = [f.bucketLabel];
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
  const line = f.kind === 'active' ? activeFactsLine(f) : passiveFactsLine(f);
  const note = ctx.prose.abilityNotes[id]?.full ?? '';
  return `
    <div class="v-a__ability">
      <p class="v-a__ability-head">
        <span class="v-a__ability-name">${esc(name)}</span><span
          class="v-a__ability-facts">${esc(line)}</span>
      </p>
      <p class="v-a__ability-note">${esc(note)}</p>
    </div>`;
}

function statBlock(ctx: SpreadContext): string {
  const { stats, cls } = ctx;
  const ev = cls.evasion;
  const rows: Array<[string, string]> = [
    ['HP', String(stats.maxHpBase)],
    ['MP', String(stats.maxMpBase)],
    ['Physical Attack', String(stats.pa)],
    ['Magical Attack', String(stats.ma)],
    ['Speed', String(stats.spd)],
    ['Move Range', String(cls.movement.moveRange)],
    ['Jump', String(cls.movement.jump)],
    ['Evasion · F / S / B', `${ev.front} / ${ev.side} / ${ev.back}`],
    ['Resistances', '— none —'],
  ];
  return `
    <table class="v-a__stats">
      <tbody>
        ${join(
          rows.map(
            ([label, value]) =>
              `<tr><th scope="row">${esc(label)}</th><td>${esc(value)}</td></tr>`,
          ),
        )}
      </tbody>
    </table>`;
}

export function variantA(ctx: SpreadContext): string {
  const { prose, abilities } = ctx;

  const actives = join(
    abilities.actives.map((a) => abilityBlock(ctx, a.id, a.name)),
  );
  const passives = join(
    abilities.passives.map((p) => abilityBlock(ctx, p.id, p.name)),
  );

  return `
    <section class="spread v-a">
      <div class="spread__verso v-a__verso">
        <p class="v-a__runner">Variant A — The Institutional Manual</p>
        <header class="v-a__masthead">
          <h1 class="v-a__title">Knight</h1>
          <p class="v-a__tagline">${esc(prose.tagline)}</p>
        </header>

        <div class="v-a__plate">
          <figure class="v-a__portrait">
            <img src="${esc(ctx.portraitUrl)}" alt="The Knight" />
          </figure>
          <div class="v-a__statwrap">
            <h2 class="v-a__stathead">Baseline</h2>
            <p class="v-a__statnote">at the L25 reference</p>
            ${statBlock(ctx)}
            <div class="v-a__seal">${ctx.sealSvg}</div>
          </div>
        </div>

        <div class="v-a__brief">${renderProse(prose.brief)}</div>
      </div>

      <div class="spread__recto v-a__recto">
        <h2 class="v-a__section">The Knight&rsquo;s Repertoire</h2>
        <h3 class="v-a__subsection">Active Skills</h3>
        ${actives}
        <h3 class="v-a__subsection">Passive Bearing</h3>
        ${passives}

        <aside class="v-a__counsel">
          <h3 class="v-a__counsel-head">The Instructor&rsquo;s Counsel</h3>
          ${renderProse(prose.strategy)}
        </aside>
      </div>
    </section>`;
}
