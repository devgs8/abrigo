// Gera icons/icon{16,32,48,128}.png a partir do SVG abaixo.
//   npm i puppeteer-core   (uma vez, fora do repositorio da extensao)
//   node tools/build-icons.mjs "C:/Program Files/Google/Chrome/Application/chrome.exe"

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const exe = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const SHIELD = 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z';

// Nos tamanhos pequenos o visto some; fica so o escudo, mais grosso.
function svg(size) {
  const small = size <= 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4C6BFF"/><stop offset="1" stop-color="#7A5AF8"/>
    </linearGradient></defs>
    <rect width="24" height="24" rx="${small ? 5 : 6}" fill="url(#g)"/>
    <g transform="translate(12 12.4) scale(${small ? 0.78 : 0.72}) translate(-12 -12)">
      <path d="${SHIELD}" fill="#fff"/>
      ${small ? '' : '<path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke="#4C5FEF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'}
    </g>
  </svg>`;
}

const browser = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(join(ROOT, 'icons', `icon${size}.png`), png);
  console.log(`icons/icon${size}.png`);
}
await browser.close();
