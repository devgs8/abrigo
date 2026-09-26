// Gera rules/adult.json a partir de listas publicas de dominios adultos
// (OISD NSFW + HaGeZi NSFW) mais a lista manual abaixo.
//
//   node tools/build-adult-rules.mjs            -> descarrega as listas e gera
//   node tools/build-adult-rules.mjs --offline  -> usa tools/lists/*.txt ja guardados
//
// Depois de gerar: chrome://extensions -> botao recarregar (↻) em CADA perfil.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LISTS_DIR = join(ROOT, 'tools', 'lists');

const SOURCES = [
  { file: 'oisd-nsfw.txt',   url: 'https://nsfw.oisd.nl/domainswild2' },
  { file: 'hagezi-nsfw.txt', url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/wildcard/nsfw-onlydomains.txt' }
];

// Sempre bloqueados, mesmo que as listas publicas os percam.
const MANUAL = [
  'pornhub.com','xvideos.com','xnxx.com','xhamster.com','redtube.com','youporn.com','tube8.com',
  'spankbang.com','chaturbate.com','livejasmin.com','cam4.com','myfreecams.com','stripchat.com',
  'bongacams.com','onlyfans.com','fansly.com','erome.com','redgifs.com','rule34.xxx','e621.net',
  'hanime.tv','nhentai.net','hentaihaven.xxx','imagefap.com','motherless.com','adultfriendfinder.com',
  'ashleymadison.com','sex.com','porn.com','porntrex.com','tnaflix.com','brazzers.com',
  'naughtyamerica.com','realitykings.com','mofos.com','bangbros.com','digitalplayground.com',
  'kink.com','metart.com','twistys.com','wankz.com','faphouse.com','pornone.com','porndoe.com',
  'pornyub.com','empflix.com','porndig.com','txxx.com','beeg.com','drtuber.com','hardsextube.com',
  'streamate.com','imlive.com','camsoda.com','xcams.com','flirt4free.com','penthouse.com',
  'playboy.com','hustler.com','fapello.com','thothub.to','coomer.party','coomer.su','kemono.party',
  'kemono.su','musasbrasil.com','gatasnuas.com','peladas.com','fotospeladas.net','sexlog.com.br',
  'sexolog.com.br','amateurporn.com','pornmd.com','kushub.com','naijared.com','xvideos.red',
  'xnxx.tv','xhamsterlive.com','xhamster.desi','eporner.com','hqporner.com','pornpics.com',
  'sxyprn.com','youjizz.com','fuq.com','4tube.com','porntube.com','pornhat.com','pornhd.com',
  'xgroovy.com','tubegalore.com','ixxx.com','cliphunter.com','hclips.com','hdzog.com',
  'upornia.com','vjav.com','javhd.com','javlibrary.com','missav.com','supjav.com','jable.tv',
  'hitomi.la','e-hentai.org','exhentai.org','rule34.paheal.net','gelbooru.com','danbooru.donmai.us',
  'sankakucomplex.com','f95zone.to','nutaku.net','scrolller.com','nudostar.com','influencersgonewild.com',
  'thisvid.com','cumlouder.com','xvideosporno.blog.br','xvideos-br.com','pornocarioca.com',
  'mundoproibido.com','tocadacoelha.net','novinhasdozap.com','porno.com.br','videosdesexo.blog.br'
];

async function loadSource({ file, url }, offline) {
  const path = join(LISTS_DIR, file);
  if (!offline) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    writeFileSync(path, await res.text());
  }
  if (!existsSync(path)) throw new Error(`falta ${path} (corre sem --offline)`);
  return readFileSync(path, 'utf8');
}

function parse(text) {
  const out = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.trim().toLowerCase();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    line = line.replace(/^\*\./, '').replace(/^\|\|/, '').replace(/\^$/, '');
    if (/^[a-z0-9.-]+\.[a-z0-9-]+$/.test(line)) out.push(line);
  }
  return out;
}

// requestDomains ja apanha subdominios, por isso a.b.com e redundante se b.com
// estiver na lista. Cortar isto reduz bastante o tamanho do ficheiro.
function collapse(domains) {
  const set = new Set(domains);
  const kept = [];
  for (const d of set) {
    const parts = d.split('.');
    let covered = false;
    for (let i = 1; i < parts.length - 1; i++) {
      if (set.has(parts.slice(i).join('.'))) { covered = true; break; }
    }
    if (!covered) kept.push(d);
  }
  return kept.sort();
}

// Palavras que, no nome do dominio, denunciam um site adulto que ainda nao
// esta em nenhuma lista. So vale para o hostname (nao o caminho), e so palavras
// sem colisoes comuns -- "sex" fica de fora por causa de essex/sussex.
const HOST_KEYWORDS = [
  'porn','xxx','xvideo','xnxx','xhamster','hentai','nsfw','brazzers','onlyfans','camgirl',
  'sexcam','livesex','freesex','sexvid','sextube','sexporn','putaria','novinhas','pelad',
  'safadas','gostosas','xvideos','pornhub','redtube','youporn','fapello','nudes','nudez',
  'erotic','erotik','milfs','bdsm','fetish','rule34','javhd','jav-'
];

const CHUNK = 10000;
const SUBRESOURCE_TYPES = [
  'sub_frame','stylesheet','script','image','font','object','xmlhttprequest',
  'ping','csp_report','media','websocket','webtransport','webbundle','other'
];
// O Chrome so deixa redirecionar para a propria extensao via extensionPath
// (regexSubstitution para chrome-extension:// falha). Sem o dominio no URL,
// o blocked.js pede-o ao service worker, que regista cada navegacao.
const BLOCKED = { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html?cat=adult&reason=site' } };

function buildRules(domains) {
  const rules = [];
  let id = 1;

  // 1. Palavra-chave no hostname (dominios novos que as listas ainda nao tem).
  //    Em grupos de 8: o Chrome limita cada regex a 2 KB compilados e descarta
  //    em silencio as que passam (a versao com as 36 palavras juntas nunca
  //    chegou a funcionar -- isRegexSupported diz "memoryLimitExceeded").
  for (let i = 0; i < HOST_KEYWORDS.length; i += 8) {
    const kw = HOST_KEYWORDS.slice(i, i + 8).join('|');
    rules.push({
      id: id++, priority: 2,
      action: BLOCKED,
      condition: { regexFilter: `^https?://[^/:?#]*(?:${kw})`, resourceTypes: ['main_frame'] }
    });
    rules.push({
      id: id++, priority: 2,
      action: { type: 'block' },
      condition: { regexFilter: `^[a-z]+://[^/:?#]*(?:${kw})`, resourceTypes: SUBRESOURCE_TYPES }
    });
  }

  // 2. Listas de dominios, em blocos. Cada bloco da duas regras: a pagina
  //    principal vai para blocked.html; tudo o resto (videos embutidos,
  //    imagens, iframes noutros sites) e cortado.
  for (let i = 0; i < domains.length; i += CHUNK) {
    const requestDomains = domains.slice(i, i + CHUNK);
    rules.push({
      id: id++, priority: 1,
      action: BLOCKED,
      condition: { requestDomains, resourceTypes: ['main_frame'] }
    });
    rules.push({
      id: id++, priority: 1,
      action: { type: 'block' },
      condition: { requestDomains, resourceTypes: SUBRESOURCE_TYPES }
    });
  }
  return rules;
}

const offline = process.argv.includes('--offline');
let all = [...MANUAL];
for (const src of SOURCES) {
  const list = parse(await loadSource(src, offline));
  console.log(`${src.file}: ${list.length} dominios`);
  all = all.concat(list);
}
const domains = collapse(all);
const rules = buildRules(domains);

// Uma regra por linha: o ficheiro fica legivel em diffs sem ficar gigante.
const json = '[\n' + rules.map(r => JSON.stringify(r)).join(',\n') + '\n]\n';
writeFileSync(join(ROOT, 'rules', 'adult.json'), json);
// Lido pelo popup e pelas definicoes (o adult.json tem 19 MB, grande demais para isso).
writeFileSync(join(ROOT, 'rules', 'stats.json'),
  JSON.stringify({ adultDomains: domains.length, generated: new Date().toISOString().slice(0, 10) }) + '\n');
console.log(`rules/adult.json: ${domains.length} dominios em ${rules.length} regras (${(json.length / 1e6).toFixed(1)} MB)`);
