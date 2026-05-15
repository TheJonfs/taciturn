// Welcome to Gariland — the handbook's opening. The title splash as a
// hero image, then the instructor's welcome letter.

import { renderProse } from '../build/markdown.ts';
import { welcomeLetter } from '../content/intro/welcome.ts';
import splashUrl from '../art/splash.png';
import { esc } from './html.ts';

export function welcome(): string {
  return `
    <section class="welcome" id="ch-welcome">
      <figure class="welcome__splash">
        <img src="${esc(splashUrl)}" alt="Mage War — Gariland Academy" />
      </figure>
      <h1 class="welcome__title">Welcome to Gariland</h1>
      <p class="welcome__salutation">${esc(welcomeLetter.salutation)}</p>
      <div class="welcome__body">${renderProse(welcomeLetter.body)}</div>
      <p class="welcome__signature">&mdash; ${esc(welcomeLetter.signature)}</p>
    </section>`;
}
