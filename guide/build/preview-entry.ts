// Preview entry — the browser-side bootstrap.
//
// Composes the handbook (or a single chapter / spread, when the URL
// carries ?class=… or ?section=…), then hands it to Paged.js, which
// chunks it into pages applying the stylesheets. The same code path
// runs in the dev preview and inside headless Chromium for the PDF
// render, so the browser view matches the output.

import { Previewer } from 'pagedjs';
import {
  composeHandbook,
  composeClassSpread,
  composeSection,
  isKnownClass,
  isSectionKey,
} from './compose.ts';
import baseCssUrl from '../styles/base.css?url';
import frontMatterCssUrl from '../styles/front-matter.css?url';
import variantECssUrl from '../styles/variant-e.css?url';
import armoryCssUrl from '../styles/armory.css?url';
import welcomeCssUrl from '../styles/welcome.css?url';
import foundationsCssUrl from '../styles/foundations.css?url';
import trainingFieldCssUrl from '../styles/training-field.css?url';

const STYLESHEETS = [
  baseCssUrl,
  frontMatterCssUrl,
  variantECssUrl,
  armoryCssUrl,
  welcomeCssUrl,
  foundationsCssUrl,
  trainingFieldCssUrl,
];

function selectBody(): string {
  const params = new URLSearchParams(window.location.search);
  const classParam = params.get('class');
  if (classParam !== null && isKnownClass(classParam)) {
    return composeClassSpread(classParam);
  }
  const sectionParam = params.get('section');
  if (sectionParam !== null && isSectionKey(sectionParam)) {
    return composeSection(sectionParam);
  }
  return composeHandbook();
}

async function render(): Promise<void> {
  const body = selectBody();
  const previewer = new Previewer();
  await previewer.preview(body, STYLESHEETS, document.body);
  document.documentElement.dataset.guideRendered = 'true';
}

render().catch((err: unknown) => {
  // The handbook conceit does not extend to build failures — surface
  // them loudly and plainly (CLAUDE.md: don't catch errors silently).
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
  document.body.innerHTML = `<pre style="padding:2rem;font:13px/1.6 ui-monospace,monospace;color:#922;white-space:pre-wrap">Guide build failed:\n\n${message}</pre>`;
  throw err;
});
