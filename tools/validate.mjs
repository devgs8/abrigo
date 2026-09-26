// Valida o pacote antes de o submeter, com as regras que a Chrome Web Store
// aplica ao carregar (as que o Chrome instalado tolera mas a loja recusa).
//   node tools/validate.mjs dist/abrigo-<versao>.zip
// Sai com codigo 1 se houver algum erro.

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

// Lista oficial de locales aceites pelo Chrome / Chrome Web Store.
const LOCALES = new Set(('ar am bg bn ca cs da de el en en_AU en_GB en_US es es_419 et fa fi fil fr gu he hi hr hu ' +
  'id it ja kn ko lt lv ml mr ms nl no pl pt_BR pt_PT ro ru sk sl sr sv sw ta te th tr uk vi zh_CN zh_TW').split(' '));
const KNOWN_PERMISSIONS = new Set(['storage', 'declarativeNetRequest', 'declarativeNetRequestWithHostAccess',
  'declarativeNetRequestFeedback', 'tabs', 'webNavigation', 'alarms', 'scripting', 'activeTab', 'contextMenus']);

const zipPath = process.argv[2];
if (!zipPath) { console.error('uso: node tools/validate.mjs <ficheiro.zip>'); process.exit(2); }

// ── Ler o ZIP (diretorio central) ────────────────────────────────────────────
const buf = readFileSync(zipPath);
const errors = [];
const warn = [];
const files = new Map();

const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd < 0) { console.error('ERRO: nao e um ZIP valido'); process.exit(1); }
const count = buf.readUInt16LE(eocd + 10);
let p = buf.readUInt32LE(eocd + 16);
for (let i = 0; i < count; i++) {
  if (buf.readUInt32LE(p) !== 0x02014b50) { errors.push('diretorio central do ZIP corrompido'); break; }
  const method = buf.readUInt16LE(p + 10), time = buf.readUInt16LE(p + 12), date = buf.readUInt16LE(p + 14);
  const csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
  const off = buf.readUInt32LE(p + 42);
  const name = buf.toString('utf8', p + 46, p + 46 + nlen);
  p += 46 + nlen + xlen + clen;

  const month = (date >> 5) & 15, day = date & 31;
  if (month < 1 || month > 12 || day < 1) errors.push(`${name}: data invalida no ZIP`);
  if (name.includes('\\')) errors.push(`${name}: separador "\\" no caminho (tem de ser "/")`);

  const lnlen = buf.readUInt16LE(off + 26), lxlen = buf.readUInt16LE(off + 28);
  const raw = buf.subarray(off + 30 + lnlen + lxlen, off + 30 + lnlen + lxlen + csize);
  try { files.set(name, method === 8 ? inflateRawSync(raw) : raw); }
  catch { errors.push(`${name}: nao descomprime`); }
}

const text = (f) => files.get(f)?.toString('utf8');
const json = (f) => {
  const t = text(f);
  if (t === undefined) { errors.push(`${f}: nao existe no pacote`); return null; }
  if (t.charCodeAt(0) === 0xfeff) errors.push(`${f}: tem BOM UTF-8`);
  try { return JSON.parse(t); } catch (e) { errors.push(`${f}: JSON invalido (${e.message})`); return null; }
};
const need = (f, why) => { if (f && !files.has(f.replace(/^\//, ''))) errors.push(`${why}: "${f}" nao existe no pacote`); };

// ── Estrutura ────────────────────────────────────────────────────────────────
for (const name of files.keys()) {
  const top = name.split('/')[0];
  if (top.startsWith('_') && top !== '_locales') errors.push(`${name}: nomes começados por "_" sao reservados`);
  if (top === '__MACOSX' || name.endsWith('.DS_Store')) errors.push(`${name}: ficheiro de sistema no pacote`);
}

const m = json('manifest.json');
if (m) {
  if (m.manifest_version !== 3) errors.push('manifest_version tem de ser 3');
  if (!/^\d+(\.\d+){0,3}$/.test(m.version || '')) errors.push(`version invalida: "${m.version}"`);

  // ── Idiomas ────────────────────────────────────────────────────────────────
  const localeDirs = [...new Set([...files.keys()].filter(f => f.startsWith('_locales/')).map(f => f.split('/')[1]))];
  if (localeDirs.length && !m.default_locale) errors.push('ha _locales mas falta default_locale');
  if (m.default_locale && !LOCALES.has(m.default_locale)) errors.push(`default_locale "${m.default_locale}" nao e um locale aceite pela loja`);
  if (m.default_locale && !localeDirs.includes(m.default_locale)) errors.push(`falta _locales/${m.default_locale}/`);
  for (const l of localeDirs) if (!LOCALES.has(l)) errors.push(`_locales/${l}: codigo de idioma nao aceite pela loja (usar p.ex. pt_PT / pt_BR)`);

  const msgs = {};
  for (const l of localeDirs) msgs[l] = json(`_locales/${l}/messages.json`) || {};
  const base = msgs[m.default_locale] || {};
  const manifestKeys = [...JSON.stringify(m).matchAll(/__MSG_(\w+)__/g)].map(x => x[1]);
  for (const l of localeDirs) {
    for (const k of manifestKeys) if (!msgs[l][k]) errors.push(`_locales/${l}: falta "${k}" usado no manifest`);
    for (const k of Object.keys(base)) if (!msgs[l][k]) warn.push(`_locales/${l}: falta "${k}" (cai para ${m.default_locale})`);
    const resolve = (v) => (v || '').replace(/__MSG_(\w+)__/g, (_, k) => msgs[l][k]?.message ?? base[k]?.message ?? '');
    const name = resolve(m.name), desc = resolve(m.description), short = resolve(m.short_name);
    if (!name) errors.push(`_locales/${l}: nome vazio`);
    if (name.length > 75) errors.push(`_locales/${l}: nome com ${name.length} caracteres (max 75)`);
    if (desc.length > 132) errors.push(`_locales/${l}: descricao com ${desc.length} caracteres (max 132)`);
    if (short.length > 12) warn.push(`_locales/${l}: short_name com ${short.length} caracteres (recomendado <= 12)`);
  }

  // ── Ficheiros referidos ────────────────────────────────────────────────────
  for (const [size, f] of Object.entries(m.icons || {})) {
    need(f, 'icons');
    const png = files.get(f);
    if (png && png.readUInt32BE(0) === 0x89504e47) {
      const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
      if (w !== +size || h !== +size) errors.push(`${f}: tem ${w}x${h}, o manifest diz ${size}x${size}`);
    } else if (png) errors.push(`${f}: nao e PNG`);
  }
  if (!m.icons?.['128']) errors.push('falta o icone de 128x128 (obrigatorio na loja)');
  need(m.background?.service_worker, 'background.service_worker');
  need(m.action?.default_popup, 'action.default_popup');
  need(m.options_ui?.page, 'options_ui.page');
  for (const cs of m.content_scripts || []) for (const f of [...(cs.js || []), ...(cs.css || [])]) need(f, 'content_scripts');
  for (const r of m.declarative_net_request?.rule_resources || []) {
    need(r.path, `regras "${r.id}"`);
    const rules = files.has(r.path) ? json(r.path) : null;
    if (rules && !Array.isArray(rules)) errors.push(`${r.path}: tem de ser uma lista de regras`);
  }
  for (const w of m.web_accessible_resources || []) for (const f of w.resources || []) if (!f.includes('*')) need(f, 'web_accessible_resources');

  // ── Permissoes ─────────────────────────────────────────────────────────────
  for (const perm of m.permissions || []) if (!KNOWN_PERMISSIONS.has(perm)) warn.push(`permissao desconhecida para este validador: ${perm}`);
  if ((m.permissions || []).includes('declarativeNetRequestFeedback')) warn.push('declarativeNetRequestFeedback so serve para depuracao');
  if (m.key) warn.push('o campo "key" e ignorado/recusado pela loja');

  console.log(`manifest: ${m.version} | idiomas: ${localeDirs.join(', ')} (default ${m.default_locale}) | permissoes: ${(m.permissions || []).join(', ')}`);
}

console.log(`ficheiros no pacote: ${files.size}`);
for (const w of warn) console.log('AVISO:', w);
for (const e of errors) console.log('ERRO: ', e);
console.log(errors.length ? `\n${errors.length} erro(s) — NAO submeter.` : '\nOK — pacote pronto para a loja.');
process.exit(errors.length ? 1 : 0);
