// Gera as imagens da Chrome Web Store em store/images/ a partir das paginas
// reais da extensao (capturas 1280x800 em PT e EN + imagem promocional 440x280).
//   npm i puppeteer-core   (uma vez, fora da pasta da extensao)
//   node tools/store-images.mjs "C:/Program Files/Google/Chrome/Application/chrome.exe"

import puppeteer from 'puppeteer-core';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store', 'images');
const exe = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const icon = 'data:image/png;base64,' + readFileSync(join(ROOT, 'icons', 'icon128.png')).toString('base64');

const COPY = {
  pt: {
    popup:   ['Proteção num clique', 'Quase meio milhão de sites adultos bloqueados, mais apostas e redes sociais se quiser.'],
    blocked: null,
    search:  null,
    options: null,
    tile:    'Bloqueio de conteúdo adulto',
    tileSub: 'Gratuito · Sem anúncios · Privado'
  },
  en: {
    popup:   ['Protection in one click', 'Nearly half a million adult sites blocked, plus gambling and social media if you want.'],
    tile:    'Adult content blocker',
    tileSub: 'Free · No ads · Private'
  },
  es: {
    popup:   ['Protección en un clic', 'Casi medio millón de sitios para adultos bloqueados, y apuestas y redes sociales si quieres.'],
    tile:    'Bloqueo de contenido adulto',
    tileSub: 'Gratis · Sin anuncios · Privado'
  },
  fr: {
    popup:   ['Protection en un clic', 'Près d’un demi-million de sites pour adultes bloqués, et paris et réseaux sociaux si vous le souhaitez.'],
    tile:    'Bloqueur de contenu pour adultes',
    tileSub: 'Gratuit · Sans publicité · Privé'
  }
};

// Moldura de marketing: texto a esquerda, captura do popup a direita.
function frame(title, sub, shot) {
  return `<html><body style="margin:0;width:1280px;height:800px;display:flex;align-items:center;gap:72px;padding:0 96px;box-sizing:border-box;
    font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;background:radial-gradient(900px 600px at 80% 20%,#E4E8FF,#F3F5FA 70%);color:#101828">
    <div style="flex:1">
      <img src="${icon}" style="width:64px;height:64px;margin-bottom:28px">
      <div style="font-size:52px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin-bottom:20px">${title}</div>
      <div style="font-size:22px;color:#475467;line-height:1.5">${sub}</div>
    </div>
    <img src="${shot}" style="width:360px;border-radius:18px;box-shadow:0 30px 60px -20px rgba(16,24,40,.35);border:1px solid #E4E7EF">
  </body></html>`;
}

function tile(text, sub) {
  return `<html><body style="margin:0;width:440px;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
    font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;background:linear-gradient(145deg,#4C6BFF,#7A5AF8);color:#fff;text-align:center">
    <img src="${icon}" style="width:72px;height:72px;filter:drop-shadow(0 8px 16px rgba(0,0,0,.25))">
    <div style="font-size:34px;font-weight:800;letter-spacing:-.02em">Abrigo</div>
    <div style="font-size:17px;font-weight:600">${text}</div>
    <div style="font-size:13px;opacity:.8">${sub}</div>
  </body></html>`;
}

// O mesmo desenho de tools/build-icons.mjs, em vetor: nitido em qualquer
// tamanho (o PNG de 128 px esticado fica desfocado no mosaico grande).
const ICON_SVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C6BFF"/><stop offset="1" stop-color="#7A5AF8"/></linearGradient></defs>
  <rect width="24" height="24" rx="6" fill="url(#g)"/>
  <g transform="translate(12 12.4) scale(0.72) translate(-12 -12)">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="#fff"/>
    <path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke="#4C5FEF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`;

// Mosaico grande (1400x560), usado se a loja destacar a extensao.
function marquee(title, sub) {
  return `<html><body style="margin:0;width:1400px;height:560px;display:flex;align-items:center;gap:56px;padding:0 120px;box-sizing:border-box;
    font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif;background:linear-gradient(135deg,#4C6BFF,#7A5AF8);color:#fff">
    <div style="filter:drop-shadow(0 16px 32px rgba(0,0,0,.3));line-height:0">${ICON_SVG(200)}</div>
    <div>
      <div style="font-size:84px;font-weight:800;letter-spacing:-.03em;line-height:1">Abrigo</div>
      <div style="font-size:34px;font-weight:600;margin-top:14px">${title}</div>
      <div style="font-size:22px;opacity:.85;margin-top:10px">${sub}</div>
    </div>
  </body></html>`;
}

const MARQUEE = {
  pt: ['Bloqueio de conteúdo adulto', 'Gratuito · Sem anúncios · Nada sai do seu computador'],
  en: ['Adult content blocker', 'Free · No ads · Nothing leaves your computer'],
  es: ['Bloqueo de contenido adulto', 'Gratis · Sin anuncios · Nada sale de tu ordenador'],
  fr: ['Bloqueur de contenu pour adultes', 'Gratuit · Sans publicité · Rien ne quitte votre ordinateur']
};

// Icone da loja: diretrizes da Google pedem o desenho em 96x96 com 16 px
// transparentes a volta, dentro de 128x128. O icone da extensao ocupa tudo.
{
  const browser = await puppeteer.launch({ executablePath: exe, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 128, height: 128, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <img src="${icon}" style="width:96px;height:96px;margin:16px;display:block"></body></html>`);
  await page.screenshot({ path: join(OUT, 'store-icon-128.png'), omitBackground: true });
  await browser.close();
  console.log('icone da loja 128x128 (96 + margem 16)');
}

const BROWSER_LANG = { pt: 'pt-PT', en: 'en-US', es: 'es-ES', fr: 'fr-FR' };

for (const lang of ['pt', 'en', 'es', 'fr']) {
  const dir = join(tmpdir(), 'abrigo-store-' + lang);
  rmSync(dir, { recursive: true, force: true });
  const browser = await puppeteer.launch({
    executablePath: exe, headless: true, pipe: true, enableExtensions: true, userDataDir: dir,
    args: ['--no-first-run', `--lang=${BROWSER_LANG[lang]}`]
  });
  const id = await browser.installExtension(ROOT);
  await browser.waitForTarget(t => t.type() === 'service_worker' && t.url().includes(id));
  await new Promise(r => setTimeout(r, 1500));
  const base = `chrome-extension://${id}`;
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);

  // 1. Popup dentro da moldura
  await page.setViewport({ width: 340, height: 600, deviceScaleFactor: 2 });
  await page.goto(`${base}/popup/popup.html`);
  await new Promise(r => setTimeout(r, 800));
  const h = await page.evaluate(() => document.body.scrollHeight);
  const popupShot = 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64', clip: { x: 0, y: 0, width: 340, height: h } });
  // Composta numa pagina em branco: a CSP das paginas da extensao bloqueia imagens data:.
  const comp = await browser.newPage();
  await comp.goto('about:blank');
  await comp.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  await comp.setContent(frame(...COPY[lang].popup, popupShot));
  await new Promise(r => setTimeout(r, 300));
  await comp.screenshot({ path: join(OUT, `${lang}-1-popup.png`) });
  // Separadores de fundo nao sao desenhados -- cada um vem para a frente antes da captura.
  await page.bringToFront();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  // 2-4. Paginas reais em 1280x800
  // Dominio de exemplo na lingua da imagem (aparece na pagina de bloqueio).
  const exampleDomain = { pt: 'exemplo-adulto.com', en: 'example-adult.com', es: 'ejemplo-adulto.com', fr: 'exemple-adulte.com' }[lang];
  const shots = [
    ['2-blocked-site', `${base}/blocked/blocked.html?cat=adult&reason=site&domain=${exampleDomain}`],
    ['3-blocked-search', `${base}/blocked/blocked.html?cat=adult&reason=search&domain=google.com`],
    ['4-settings', `${base}/options/options.html`]
  ];
  for (const [name, url] of shots) {
    await page.goto(url);
    await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: join(OUT, `${lang}-${name}.png`) });
  }

  // Imagem promocional pequena
  await comp.bringToFront();
  await comp.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });
  await comp.setContent(tile(COPY[lang].tile, COPY[lang].tileSub));
  await new Promise(r => setTimeout(r, 300));
  await comp.screenshot({ path: join(OUT, `${lang}-promo-440x280.png`) });

  await comp.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });
  await comp.setContent(marquee(...MARQUEE[lang]));
  await new Promise(r => setTimeout(r, 300));
  await comp.screenshot({ path: join(OUT, `${lang}-marquee-1400x560.png`) });

  await browser.close();
  console.log(`${lang}: 4 capturas + promo`);
}
