// Video de demonstracao (1920x1080, 30 fps, ~37 s) a partir das paginas reais
// da extensao. Cada fotograma e desenhado para um instante exato e enviado ao
// ffmpeg -- nada de gravacao de ecra, por isso sai sempre igual e fluido.
//   npm i puppeteer-core   (uma vez, fora da pasta da extensao)
//   node tools/make-video.mjs <chrome.exe> <ffmpeg.exe> [pt|en ...]
// Saida: store/video/abrigo-demo.<idioma>.mp4

import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [chrome, ffmpeg, ...langsArg] = process.argv.slice(2);
if (!chrome || !ffmpeg) { console.error('uso: node tools/make-video.mjs <chrome.exe> <ffmpeg.exe> [pt|en ...]'); process.exit(2); }
const LANGS = langsArg.length ? langsArg : ['pt', 'en'];
const OUT = join(ROOT, 'store', 'video');
mkdirSync(OUT, { recursive: true });

const FPS = 30;
const DURATION = 37;
const W = 1920, H = 1080;

const TEXT = {
  pt: {
    browserLang: 'pt-PT',
    tagline: 'Bloqueio gratuito de conteúdo adulto',
    sub: 'Para Chrome e Edge',
    cap1: 'Pesquisas explícitas são bloqueadas',
    cap1b: 'mesmo disfarçadas com números ou espaços',
    cap2: '477 mil sites adultos bloqueados',
    cap2b: 'e sites novos detetados pelo conteúdo',
    cap3: 'Escolha o que bloquear',
    cap3b: 'apostas, redes sociais, YouTube',
    cap4: 'Um PIN mantém a proteção ligada',
    cap4b: 'ninguém a desliga sem o PIN',
    end1: 'Nada sai do seu computador',
    end2: 'Sem anúncios · Sem contas · Gratuito e open source',
    end3: 'Instale grátis no Chrome e no Edge',
    search: 'Pesquisar',
    site: 'site-desconhecido.example',
    example: 'site-desconhecido.example'
  },
  en: {
    browserLang: 'en-US',
    tagline: 'Free adult content blocker',
    sub: 'For Chrome and Edge',
    cap1: 'Explicit searches are blocked',
    cap1b: 'even when disguised with numbers or spaces',
    cap2: '477,000 adult sites blocked',
    cap2b: 'and new sites detected by their content',
    cap3: 'Choose what to block',
    cap3b: 'gambling, social media, YouTube',
    cap4: 'A PIN keeps protection on',
    cap4b: 'nobody can switch it off without it',
    end1: 'Nothing leaves your computer',
    end2: 'No ads · No accounts · Free and open source',
    end3: 'Install free on Chrome and Edge',
    search: 'Search',
    site: 'unknown-site.example',
    example: 'unknown-site.example'
  }
};

const ICON_SVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <defs><linearGradient id="g${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4C6BFF"/><stop offset="1" stop-color="#7A5AF8"/></linearGradient></defs>
  <rect width="24" height="24" rx="6" fill="url(#g${size})"/>
  <g transform="translate(12 12.4) scale(0.72) translate(-12 -12)">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" fill="#fff"/>
    <path d="m8.6 12 2.4 2.4 4.4-4.6" fill="none" stroke="#4C5FEF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g></svg>`;

// ── 1. Capturar as paginas reais da extensao ────────────────────────────────
async function captureAssets(lang) {
  const t = TEXT[lang];
  const dir = join(tmpdir(), 'abrigo-video-' + lang);
  rmSync(dir, { recursive: true, force: true });
  const browser = await puppeteer.launch({
    executablePath: chrome, headless: true, pipe: true, enableExtensions: true, userDataDir: dir,
    args: ['--no-first-run', `--lang=${t.browserLang}`]
  });
  const id = await browser.installExtension(ROOT);
  await browser.waitForTarget(x => x.type() === 'service_worker' && x.url().includes(id));
  await new Promise(r => setTimeout(r, 1500));
  const base = `chrome-extension://${id}`;
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  const shot = async (opts) => 'data:image/png;base64,' + await page.screenshot({ encoding: 'base64', ...opts });

  const assets = {};
  await page.setViewport({ width: 1500, height: 800, deviceScaleFactor: 1 });
  await page.goto(`${base}/blocked/blocked.html?cat=adult&reason=search&domain=search.example`);
  await new Promise(r => setTimeout(r, 900));
  assets.searchBlocked = await shot({});
  await page.goto(`${base}/blocked/blocked.html?cat=adult&reason=content&domain=${t.example}`);
  await new Promise(r => setTimeout(r, 900));
  assets.siteBlocked = await shot({});

  await page.setViewport({ width: 340, height: 700, deviceScaleFactor: 2 });
  await page.goto(`${base}/popup/popup.html`);
  await new Promise(r => setTimeout(r, 900));
  const h = await page.evaluate(() => document.body.scrollHeight);
  assets.popup = await shot({ clip: { x: 0, y: 0, width: 340, height: h } });

  await page.setViewport({ width: 520, height: 420, deviceScaleFactor: 2 });
  await page.goto(`${base}/options/options.html`);
  // Abre o dialogo de "Definir PIN" diretamente (o clique no botao depende das
  // definicoes ja estarem carregadas) e espera que fique visivel.
  await page.waitForFunction(() => typeof openPinDialog === 'function');
  await page.evaluate(() => {
    openPinDialog(chrome.i18n.getMessage('pinSet'), true);
    document.getElementById('pinInput').value = '1234';
    document.getElementById('pinConfirmInput').value = '1234';
  });
  await page.waitForSelector('#pinOverlay:not(.hidden) .pin-dialog', { visible: true });
  await new Promise(r => setTimeout(r, 500));
  const box = await page.$eval('.pin-dialog', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  assets.pin = await shot({ clip: box, omitBackground: true });

  await browser.close();
  return assets;
}

// ── 2. O "palco": uma pagina com todas as cenas, desenhada por render(t) ────
function stage(t, a) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; font-family: 'Segoe UI', system-ui, sans-serif; color: #101828;
         background: radial-gradient(1200px 700px at 75% 10%, #E2E7FF, #F3F5FA 65%); }
  .abs { position: absolute; }
  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; inset: 0; text-align: center; }
  #title h1 { font-size: 128px; font-weight: 800; letter-spacing: -.03em; margin-top: 36px; }
  #title h2 { font-size: 44px; font-weight: 600; color: #3D4A7A; margin-top: 10px; }
  #title p  { font-size: 30px; color: #667085; margin-top: 14px; }
  #caption { left: 0; right: 0; top: 44px; text-align: center; }
  #caption .c1 { font-size: 54px; font-weight: 800; letter-spacing: -.02em; }
  #caption .c2 { font-size: 30px; color: #475467; margin-top: 6px; }
  #window { left: 210px; top: 190px; width: 1500px; height: 856px; border-radius: 18px; overflow: hidden; background: #fff;
            box-shadow: 0 40px 80px -30px rgba(16,24,40,.45); border: 1px solid #E4E7EF; }
  #bar { height: 56px; background: #F1F3F8; display: flex; align-items: center; gap: 10px; padding: 0 20px; border-bottom: 1px solid #E4E7EF; }
  .dot { width: 14px; height: 14px; border-radius: 50%; }
  #url { margin-left: 18px; flex: 1; height: 36px; border-radius: 18px; background: #fff; border: 1px solid #E4E7EF;
         display: flex; align-items: center; padding: 0 18px; font-size: 19px; color: #344054; }
  #content { position: relative; height: 800px; }
  #content > * { position: absolute; inset: 0; }
  #searchMock { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px; background: #fff; }
  #searchMock .logo { font-size: 56px; font-weight: 700; color: #98A2B3; letter-spacing: -.02em; }
  #searchMock .box { width: 760px; height: 64px; border-radius: 32px; border: 1px solid #D0D5E1; display: flex; align-items: center;
                     padding: 0 28px; font-size: 26px; color: #101828; box-shadow: 0 4px 14px rgba(16,24,40,.08); }
  .caret { display: inline-block; width: 2px; height: 30px; background: #3D5AFE; margin-left: 3px; }
  #dim { inset: 190px auto auto 210px; width: 1500px; height: 856px; border-radius: 18px; background: rgba(12,17,29,.45); }
  #popup { top: 214px; right: 250px; width: 440px; border-radius: 20px; box-shadow: 0 40px 80px -20px rgba(0,0,0,.5); }
  #pin { left: 50%; top: 360px; width: 560px; margin-left: -280px; border-radius: 22px; box-shadow: 0 40px 80px -20px rgba(0,0,0,.5); }
  #end h1 { font-size: 64px; font-weight: 800; letter-spacing: -.02em; margin-top: 30px; }
  #end p  { font-size: 32px; color: #475467; margin-top: 16px; }
  #end .cta { margin-top: 44px; font-size: 30px; font-weight: 700; color: #fff; background: #3D5AFE; padding: 18px 40px; border-radius: 16px; }
  #end .url { margin-top: 22px; font-size: 24px; color: #667085; }
  </style></head><body>
  <div id="title" class="abs center">${ICON_SVG(180)}<h1>Abrigo</h1><h2>${t.tagline}</h2><p>${t.sub}</p></div>
  <div id="caption" class="abs"><div class="c1"></div><div class="c2"></div></div>
  <div id="window" class="abs">
    <div id="bar"><span class="dot" style="background:#F97066"></span><span class="dot" style="background:#FDB022"></span><span class="dot" style="background:#32D583"></span>
      <div id="url"></div></div>
    <div id="content">
      <div id="searchMock"><div class="logo">search.example</div><div class="box"><span id="q"></span><span class="caret"></span></div></div>
      <div id="blank" style="background:#fff"></div>
      <img id="searchBlocked" src="${a.searchBlocked}">
      <img id="siteBlocked" src="${a.siteBlocked}">
    </div>
  </div>
  <div id="dim" class="abs"></div>
  <img id="popup" class="abs" src="${a.popup}">
  <img id="pin" class="abs" src="${a.pin}">
  <div id="end" class="abs center">${ICON_SVG(140)}<h1>${t.end1}</h1><p>${t.end2}</p><div class="cta">${t.end3}</div><div class="url">github.com/devgs8/abrigo</div></div>
  </body></html>`;
}

// Desenha o instante t (segundos). Corre dentro da pagina.
function render(t, T) {
  const $ = (id) => document.getElementById(id);
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  const vis = (start, end, fade = 0.45) => ease(clamp((t - start) / fade)) * ease(clamp((end - t) / fade));
  const type = (text, start, cps = 12) => text.slice(0, Math.max(0, Math.floor((t - start) * cps)));

  const set = (id, o, transform = '') => { const el = $(id); el.style.opacity = o; el.style.transform = transform; el.style.visibility = o > 0.001 ? 'visible' : 'hidden'; };

  // Abertura
  const ti = vis(0, 4.2, 0.6);
  set('title', ti, `scale(${0.96 + 0.04 * ti})`);

  // Janela do browser (cenas 2 a 5)
  const wi = vis(4, 31.2, 0.6);
  set('window', wi, `translateY(${(1 - wi) * 40}px)`);

  // Legendas por cena
  const caps = [[4.3, 12, T.cap1, T.cap1b], [12, 19, T.cap2, T.cap2b], [19, 26, T.cap3, T.cap3b], [26, 31.2, T.cap4, T.cap4b]];
  let cap = null, co = 0;
  for (const [s, e, c1, c2] of caps) { const o = vis(s, e, 0.4); if (o > co) { co = o; cap = [c1, c2]; } }
  set('caption', co, `translateY(${(1 - co) * -14}px)`);
  if (cap) { document.querySelector('#caption .c1').textContent = cap[0]; document.querySelector('#caption .c2').textContent = cap[1]; }

  // Cena 2: pesquisa (tapada) -> Pesquisa bloqueada
  const query = '█████ ██████';
  $('q').textContent = type(query, 4.9, 9);
  const blockedS = ease(clamp((t - 7.4) / 0.35));
  // Cena 3: endereco escrito -> Site bloqueado
  const inScene3 = t >= 12;
  const url = inScene3 ? type(T.site, 12.4, 16) : (t < 7.4 ? 'https://search.example' : 'https://search.example/?q=' + '█'.repeat(8));
  $('url').textContent = url;
  set('searchMock', inScene3 ? 0 : 1);
  set('searchBlocked', inScene3 ? 0 : blockedS);
  set('blank', inScene3 && t < 14.4 ? 1 : 0);
  set('siteBlocked', inScene3 ? ease(clamp((t - 14.4) / 0.35)) : 0);

  // Cena 4: popup; Cena 5: PIN
  const dim = vis(19, 31.2, 0.4);
  set('dim', dim * wi);
  const po = vis(19.2, 26, 0.5);
  set('popup', po, `translateX(${(1 - po) * 120}px)`);
  const pi = vis(26.1, 31.2, 0.45);
  set('pin', pi, `scale(${0.94 + 0.06 * pi})`);

  // Fecho
  const en = vis(31.3, 99, 0.6);
  set('end', en, `translateY(${(1 - en) * 30}px)`);
}

// ── 3. Desenhar cada fotograma e enviar ao ffmpeg ───────────────────────────
for (const lang of LANGS) {
  const T = TEXT[lang];
  console.log(`[${lang}] a capturar paginas da extensao...`);
  const assets = await captureAssets(lang);

  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto('about:blank');
  await page.setContent(stage(T, assets), { waitUntil: 'load' });
  await page.evaluate(`window.render = ${render.toString()}`);

  // PREVIEW=1: so alguns fotogramas-chave em PNG, para rever o enquadramento.
  if (process.env.PREVIEW) {
    for (const t of [2, 6, 8.5, 13.2, 16, 22, 28.5, 34]) {
      await page.evaluate((t, T) => window.render(t, T), t, T);
      await page.screenshot({ path: join(OUT, `preview-${lang}-${String(t).replace('.', '_')}s.png`) });
    }
    await browser.close();
    console.log(`[${lang}] pre-visualizacao em ${OUT}`);
    continue;
  }

  const out = join(OUT, `abrigo-demo.${lang}.mp4`);
  const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    // Os JPEG vem em gama completa; converter para a gama de video padrao (TV,
    // BT.709). Sem isto sai yuvj420p e as cores ficam lavadas nalguns leitores.
    '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg saiu com ' + c))));

  const frames = FPS * DURATION;
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t, T) => window.render(t, T), f / FPS, T);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % (FPS * 5) === 0) console.log(`[${lang}] ${Math.round(f / FPS)}s / ${DURATION}s`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`[${lang}] pronto: ${out}`);
}
