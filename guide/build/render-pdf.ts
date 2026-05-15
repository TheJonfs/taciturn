// PDF render — the final-output step.
//
// Runs after `vite build`. Serves the built handbook, drives a headless
// Chromium through the same Paged.js pagination the dev preview uses,
// then prints to PDF. Invoked by `npm run build:guide`.
//
// This script runs in Node (via tsx) and touches no game content, so it
// needs none of the @engine path aliases — only the built dist/ output.

import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import puppeteer from 'puppeteer';

const OUTPUT = fileURLToPath(new URL('../output/guide.pdf', import.meta.url));

async function main(): Promise<void> {
  const server = await preview({ preview: { port: 4180 } });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('Vite preview server did not report a local URL.');

  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    // preview-entry.ts sets this once Paged.js has finished chunking.
    await page.waitForSelector('html[data-guide-rendered="true"]', {
      timeout: 30_000,
    });
    await page.pdf({
      path: OUTPUT,
      preferCSSPageSize: true,
      printBackground: true,
    });
    console.log(`Handbook rendered: ${OUTPUT}`);
  } finally {
    await browser.close();
    await server.httpServer.close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
