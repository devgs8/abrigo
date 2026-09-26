// Gera dist/abrigo-<versao>.zip para submeter na Chrome Web Store / Edge Add-ons.
//   node tools/pack.mjs
// Leva so o que a extensao precisa para correr; fica de fora o que e do
// repositorio (tools, deploy, store, docs) e o que o browser gera (_metadata).

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = ['manifest.json', '_locales', 'background', 'blocked', 'content-scripts', 'icons', 'options', 'popup', 'rules', 'ui', 'LICENSE'];

function walk(p) {
  return statSync(p).isDirectory() ? readdirSync(p).flatMap(f => walk(join(p, f))) : [p];
}

const files = INCLUDE.flatMap(p => walk(join(ROOT, p)));

// Data/hora no formato DOS -- a zero (00/00/1980) e invalida e ha validadores
// que recusam o ficheiro por isso.
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

// Formato ZIP minimo (entradas deflate + diretorio central), sem dependencias.
const local = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = Buffer.from(relative(ROOT, file).split(sep).join('/'));
  const data = readFileSync(file);
  const comp = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6);
  lh.writeUInt16LE(8, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26);
  local.push(lh, name, comp);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(8, 10); ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, name);

  offset += lh.length + name.length + comp.length;
}
const cd = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);

const { version } = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
mkdirSync(join(ROOT, 'dist'), { recursive: true });
const out = join(ROOT, 'dist', `abrigo-${version}.zip`);
writeFileSync(out, Buffer.concat([...local, cd, end]));
console.log(`${relative(ROOT, out)}: ${files.length} ficheiros, ${(statSync(out).size / 1e6).toFixed(1)} MB`);
