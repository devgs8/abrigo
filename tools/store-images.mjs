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

for (const lang of ['pt', 'en']) {
  const dir = join(tmpdir(), 'abrigo-store-' + lang);
  rmSync(dir, { recursive: true, force: true });
  const browser = await puppeteer.launch({
    executablePath: exe, headless: true, pipe: true, enableExtensions: true, userDataDir: dir,
    args: ['--no-first-run', `--lang=${lang === 'pt' ? 'pt-PT' : 'en-US'}`]
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
  const shots = [
    ['2-site-bloqueado', `${base}/blocked/blocked.html?cat=adult&reason=site&domain=exemplo-adulto.com`],
    ['3-pesquisa-bloqueada', `${base}/blocked/blocked.html?cat=adult&reason=search&domain=google.com`],
    ['4-definicoes', `${base}/options/options.html`]
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

  await browser.close();
  console.log(`${lang}: 4 capturas + promo`);
}
