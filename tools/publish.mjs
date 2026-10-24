// Carrega dist/abrigo-<versao>.zip e submete para revisao nas lojas.
//   node tools/publish.mjs              -> Chrome Web Store e Edge Add-ons
//   node tools/publish.mjs chrome       -> so uma loja (chrome | edge)
//   node tools/publish.mjs --status     -> estado atual nas lojas, sem carregar nada
// Gerar e validar o pacote antes: node tools/pack.mjs
//
// Credenciais fora do repositorio, em %USERPROFILE%\.abrigo\publish.json:
//   {
//     "chrome": { "publisherId": "...", "serviceAccountKey": "C:\\Users\\...\\.abrigo\\cws-key.json" },
//     "edge":   { "productId": "<GUID do Partner Center>", "clientId": "...", "apiKey": "..." }
//   }
// Chrome: API v2 com conta de servico (Google Cloud) registada no painel da loja.
// Edge: Publish API v1.1 do Partner Center (a chave expira; renovar la).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createSign } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(homedir(), '.abrigo', 'publish.json');
const CHROME_ITEM = 'hpacahhegipipgmpiihbohdbjoecnlli';
const EDGE_CRX = 'mgnpemfmkngonkkfmdjhbcgcnnokbhbb';

const args = process.argv.slice(2);
const statusOnly = args.includes('--status');
const stores = args.filter(a => !a.startsWith('--'));
const targets = stores.length ? stores : ['chrome', 'edge'];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const b64url = s => Buffer.from(s).toString('base64url');

async function check(res, what) {
  const text = await res.text();
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// --- Chrome Web Store (API v2) ---

async function chromeToken(cfg) {
  const key = JSON.parse(readFileSync(cfg.serviceAccountKey, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` }),
  });
  return (await check(res, 'token Google')).access_token;
}

async function chrome(cfg, zip) {
  const auth = { Authorization: `Bearer ${await chromeToken(cfg)}` };
  const item = `publishers/${cfg.publisherId}/items/${CHROME_ITEM}`;
  const status = async () => check(await fetch(`https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`, { headers: auth }), 'fetchStatus');

  if (statusOnly) { console.log('Chrome:', JSON.stringify(await status(), null, 2)); return; }

  const up = await check(await fetch(`https://chromewebstore.googleapis.com/upload/v2/${item}:upload`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/zip' }, body: zip,
  }), 'upload Chrome');
  let state = up.uploadState;
  for (let i = 0; state === 'IN_PROGRESS' && i < 30; i++) {
    await sleep(5000);
    state = (await status()).lastAsyncUploadState;
  }
  if (state !== 'SUCCEEDED') throw new Error(`upload Chrome: ${state} ${JSON.stringify(up)}`);
  console.log(`Chrome: pacote ${up.crxVersion ?? ''} carregado`);

  const pub = await check(await fetch(`https://chromewebstore.googleapis.com/v2/${item}:publish`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}',
  }), 'publish Chrome');
  console.log(`Chrome: submetido para revisao (${pub.state})`);
  for (const w of pub.warningInfo?.warnings ?? []) console.log(`  aviso: ${w.reason} -- ${w.description}`);
}

// --- Edge Add-ons (Publish API v1.1) ---

async function edgeOperation(url, headers, what) {
  for (let i = 0; i < 60; i++) {
    const op = await check(await fetch(url, { headers }), what);
    if (op.status !== 'InProgress') {
      if (op.status !== 'Succeeded') throw new Error(`${what}: ${op.status} ${op.message ?? ''} ${JSON.stringify(op.errors ?? [])}`);
      return op;
    }
    await sleep(5000);
  }
  throw new Error(`${what}: sem resposta ao fim de 5 minutos`);
}

async function edge(cfg, zip, version) {
  if (statusOnly) {
    const res = await fetch(`https://microsoftedge.microsoft.com/addons/getproductdetailsbycrxid/${EDGE_CRX}`);
    const d = await check(res, 'detalhes Edge');
    console.log(`Edge: publicada ${d.version}, ${d.activeInstallCount} instalacoes ativas`);
    return;
  }

  const base = `https://api.addons.microsoftedge.microsoft.com/v1/products/${cfg.productId}/submissions`;
  const headers = { Authorization: `ApiKey ${cfg.apiKey}`, 'X-ClientID': cfg.clientId };
  const opId = res => res.headers.get('location')?.split('/').pop();

  let res = await fetch(`${base}/draft/package`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: zip });
  if (res.status !== 202) throw new Error(`upload Edge: HTTP ${res.status} ${await res.text()}`);
  await edgeOperation(`${base}/draft/package/operations/${opId(res)}`, headers, 'upload Edge');
  console.log('Edge: pacote carregado');

  res = await fetch(base, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: `Abrigo ${version}. Sem pedidos de rede; listas de bloqueio locais.` }),
  });
  if (res.status !== 202) throw new Error(`publish Edge: HTTP ${res.status} ${await res.text()}`);
  await edgeOperation(`${base}/operations/${opId(res)}`, headers, 'publish Edge');
  console.log('Edge: submetido para revisao');
}

// --- main ---

if (!existsSync(CONFIG)) { console.error(`falta ${CONFIG} (ver o cabecalho deste ficheiro)`); process.exit(2); }
const config = JSON.parse(readFileSync(CONFIG, 'utf8'));

const { version } = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const zipPath = join(ROOT, 'dist', `abrigo-${version}.zip`);
let zip;
if (!statusOnly) {
  if (!existsSync(zipPath)) { console.error(`falta ${zipPath} -- correr node tools/pack.mjs`); process.exit(2); }
  const v = spawnSync(process.execPath, [join(ROOT, 'tools', 'validate.mjs'), zipPath], { stdio: 'inherit' });
  if (v.status !== 0) process.exit(1);
  zip = readFileSync(zipPath);
}

let failed = false;
for (const t of targets) {
  try {
    if (!config[t] && !(statusOnly && t === 'edge')) throw new Error(`sem credenciais "${t}" em ${CONFIG}`);
    if (t === 'chrome') await chrome(config[t], zip);
    else if (t === 'edge') await edge(config[t], zip, version);
    else throw new Error(`loja desconhecida: ${t}`);
  } catch (e) {
    failed = true;
    console.error(`ERRO ${t}: ${e.message}`);
  }
}
// exitCode e nao process.exit(): no Windows, sair com ligacoes do fetch ainda
// a fechar faz o Node abortar (assert do libuv).
process.exitCode = failed ? 1 : 0;
